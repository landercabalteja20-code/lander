# Builds the soundtrack: synthesized music bed + SFX + narration -> mix.wav (48 kHz stereo)
import sys, json, numpy as np, soundfile as sf
from scipy import signal
P = sys.argv[1]; M = sys.argv[2]
SR = 48000
tl = json.load(open(f"{P}/timeline.json")); words = json.load(open(f"{P}/words.json"))
DUR = tl[-1]["end"] + 0.5
N = int(DUR * SR) + SR
rng = np.random.default_rng(7)

def W(line, word, n=1):
    k = 0
    for w in words:
        if w["line"] == line and w["w"].lower().strip('.,!?;:"“”…').startswith(word.lower()):
            k += 1
            if k == n: return w["t"]
    return tl[line]["start"]
L = lambda i: tl[i]["start"]
LE = lambda i: tl[i]["end"]

def sos(kind, f, order=4): return signal.butter(order, f, btype=kind, fs=SR, output="sos")
def filt(x, kind, f, order=4): return signal.sosfilt(sos(kind, f, order), x, axis=0)
def env(n, a=0.01, r=0.2, hold=None):
    e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def expdec(n, tau): return np.exp(-np.arange(n) / (tau * SR))
def tone(f, dur, harm=(1,), amps=(1,), phase=0.0):
    t = np.arange(int(dur * SR)) / SR; f = np.broadcast_to(f, t.shape) if np.ndim(f) else np.full(t.shape, f)
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return sum(a * np.sin(h * ph) for h, a in zip(harm, amps))
def noise(dur): return rng.standard_normal(int(dur * SR))
def st(x, pan=0.0): l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4); return np.stack([x * l, x * r], 1)
def mix(buf, x, t, gain=1.0, pan=0.0):
    if x.ndim == 1: x = st(x, pan)
    i = int(t * SR)
    if i >= len(buf): return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), len(buf) - i); buf[i:i + n] += x[:n] * gain
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def reverb(x, dur=2.4, wet=0.35, damp=4000):
    n = int(dur * SR); ir = np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1) * expdec(n, dur / 6.5)[:, None]
    ir = filt(ir, "lowpass", damp, 2); ir /= np.sqrt((ir ** 2).sum(0)).max()
    if x.ndim == 1: x = st(x)
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet

music = np.zeros((N, 2)); sfx = np.zeros((N, 2))

# ---------------- music ----------------
SEC = {}; [SEC.setdefault(m["section"], m["start"]) for m in tl]
bounds = [("hook", 0, SEC["exp"]), ("exp", SEC["exp"], SEC["road"]), ("road", SEC["road"], SEC["twist"]), ("twist", SEC["twist"], SEC["horror"]), ("horror", SEC["horror"], SEC["final"]), ("final", SEC["final"], DUR)]
BEAT = 60 / 92
PROG = {"hook": [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], "exp": [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
        "road": [[57, 60, 64], [57, 60, 64], [50, 53, 57], [52, 56, 59]], "twist": [[50, 53, 57], [46, 50, 53], [53, 57, 60], [57, 61, 64]],
        "horror": [[57, 60, 64], [58, 62, 65], [57, 60, 64], [58, 62, 65]], "final": [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]]}
CUT0, CUT1 = L(109) - 0.1, W(112, "midnight")   # music silence: "A long silence follows" until the bell
def pad(notes, t0, dur, cutoff, gain):
    for k, m in enumerate(notes):
        for det, pan in ((-0.06, -0.5), (0.06, 0.5)):
            x = tone(midi(m) * 2 ** (det / 12), dur, (1, 2, 3, 4, 5), (1, 0.5, 0.33, 0.25, 0.2))
            x = filt(x, "lowpass", cutoff, 2) * env(len(x), 0.9, 1.4)
            mix(music, x, t0, gain * 0.05, pan)
def pluck(m, t0, gain, dec=0.9):
    d = dec * 2.5; f = midi(m)
    x = tone(f, d, (1, 2.76, 5.4), (1, 0.35, 0.12)) * expdec(int(d * SR), dec) * env(int(d * SR), 0.003, 0.05)
    mix(music, x, t0, gain, rng.uniform(-0.6, 0.6))
def bass(m, t0, gain, dec=0.35):
    d = 0.9; x = tone(midi(m), d, (1, 2, 3), (1, 0.4, 0.15)); x = np.tanh(2 * x) * expdec(len(x), dec) * env(len(x), 0.005, 0.1)
    mix(music, filt(x, "lowpass", 400, 2), t0, gain)
for name, a, b in bounds:
    prog = PROG[name]; bar = 4 * BEAT; chord_len = 2 * bar; t = a; ci = 0
    while t < b - 0.05:
        dur = min(chord_len, b - t) + 1.2; ch = prog[ci % 4]
        cutoff = {"hook": 1400, "exp": 1700, "road": 900, "twist": 800, "horror": 550, "final": 1000}[name]
        pg = {"hook": 0.8, "exp": 0.85, "road": 0.95, "twist": 1.0, "horror": 1.1, "final": 1.05}[name]
        pad(ch, t, dur, cutoff, pg)
        nb = int(min(chord_len, b - t) / BEAT)
        for k in range(nb * 2):
            tt = t + k * BEAT / 2
            if name in ("hook", "exp") and k % 2 == 0 or name == "exp" and k % 2 == 1:
                pluck(ch[(k // 2) % 3] + 24 + (12 if k % 4 == 2 else 0), tt, 0.05 if name == "hook" else 0.045)
            if name in ("twist",) and k % 4 == 0: pluck(ch[(k // 4) % 3] + 24, tt, 0.04, 1.6)
        for k in range(nb):
            tt = t + k * BEAT
            if name == "hook":  # soft tick-tock
                c = noise(0.02) * expdec(int(0.02 * SR), 0.003); mix(music, filt(c, "bandpass", [1800, 4200] if k % 2 else [900, 2200], 2), tt, 0.05)
            if name in ("exp", "road", "final"): bass(ch[0] - 12, tt, {"exp": 0.08, "road": 0.1, "final": 0.12}[name])
            if name == "final" and tt > L(89): bass(ch[0] - 12, tt + BEAT / 2, 0.09)
        t += chord_len; ci += 1
# drones
def drone(t0, t1, notes, gain, cutoff=300):
    d = t1 - t0
    for m in notes:
        x = tone(midi(m), d, (1, 2, 3), (1, 0.3, 0.1)); lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * np.arange(len(x)) / SR + m)
        mix(music, filt(x * lfo, "lowpass", cutoff, 2) * env(len(x), 2.5, 2.5)[:, None].T[0], t0, gain)
drone(SEC["road"], SEC["twist"] + 2, [33, 40], 0.06)
drone(SEC["twist"], SEC["horror"] + 2, [38, 45], 0.05)
drone(SEC["horror"], SEC["final"] + 2, [33, 34, 45], 0.06, 260)
drone(SEC["final"], CUT0, [33, 40, 45], 0.07, 320)
drone(L(110), CUT1, [33, 34], 0.035, 200)                         # barely-there tension under the whisper
# riser into the crowd shout
d = L(102) - L(101); x = filt(noise(d), "bandpass", [400, 6000], 2) * np.linspace(0, 1, int(d * SR)) ** 2
mix(music, x, L(101), 0.05)
# silence window
i0, i1 = int(CUT0 * SR), int(CUT1 * SR); fade = int(0.35 * SR)
music[i0:i0 + fade] *= np.linspace(1, 0, fade)[:, None]; music[i0 + fade:i1] *= 0.0
drone_keep = np.zeros_like(music)
# music box returns for the wake-up
for k, m in enumerate([69, 72, 76, 72, 69, 76, 74, 72]):
    pluck(m + 12, L(114) + 0.2 + k * BEAT / 2, 0.06, 1.1)
pad([57, 60, 64], L(114), DUR - L(114), 1200, 0.6)

# ---------------- sfx ----------------
def popfx(t, g=0.25):
    x = tone(np.linspace(700, 1400, int(0.07 * SR)), 0.07) * expdec(int(0.07 * SR), 0.02); mix(sfx, x, t, g)
def whoosh(t, dur=0.7, g=0.3, f0=150, f1=2500):
    n = int(dur * SR); x = noise(dur); lo = filt(x, "bandpass", [f0, f0 * 3], 2); hi = filt(x, "bandpass", [f1 / 3, f1], 2); w = np.linspace(0, 1, n)
    mix(sfx, (lo * (1 - w) + hi * w) * np.sin(np.pi * np.arange(n) / n) ** 2 * 1.5, t, g)
def splash(t, g=0.5):
    x = filt(noise(0.5), "bandpass", [300, 3500], 2) * expdec(int(0.5 * SR), 0.09); y = tone(np.linspace(220, 70, int(0.25 * SR)), 0.25) * expdec(int(0.25 * SR), 0.06)
    mix(sfx, x, t, g); mix(sfx, y, t, g * 0.8)
def click(t, f=2500, g=0.2):
    x = filt(noise(0.03), "bandpass", [f * 0.6, f * 1.4], 2) * expdec(int(0.03 * SR), 0.004); mix(sfx, x, t, g)
def thud(t, f=65, g=0.6, dec=0.25):
    n = int(1.0 * SR); x = tone(np.linspace(f * 1.6, f, n), 1.0) * expdec(n, dec); mix(sfx, np.tanh(1.5 * x), t, g)
def metal(t, g=0.3, base=1.0, dec=0.35):
    x = tone(420 * base, 1.2, (1, 2.69, 5.26, 8.1), (1, 0.6, 0.4, 0.2)) * expdec(int(1.2 * SR), dec); mix(sfx, x + 0.3 * filt(noise(1.2), "highpass", 3000, 2) * expdec(int(1.2 * SR), 0.02), t, g, rng.uniform(-0.3, 0.3))
def engine(t, dur, g=0.25, f=55, doppler=None):
    n = int(dur * SR); fr = np.full(n, f) if doppler is None else np.linspace(doppler[0], doppler[1], n)
    x = tone(fr, dur, (1, 2, 3, 4), (1, 0.6, 0.4, 0.25)) * (1 + 0.2 * np.sin(2 * np.pi * 9 * np.arange(n) / SR))
    x = filt(x, "lowpass", 500, 2) + 0.4 * filt(noise(dur), "lowpass", 300, 2); mix(sfx, x * env(n, 0.3, 0.4), t, g)
def crackle(t, dur, g=0.25):
    n = int(dur * SR); x = filt(noise(dur), "lowpass", 600, 2) * 0.3
    for _ in range(int(dur * 25)):
        i = rng.integers(0, n - 2000); x[i:i + 600] += filt(noise(0.0125), "bandpass", [1500, 6000], 2) * expdec(600, 0.002) * rng.uniform(0.5, 2)
    mix(sfx, x * env(n, 0.4, 0.6), t, g)
def screech(t, dur=1.0, g=0.18):
    n = int(dur * SR); x = tone(2300 + 150 * np.sin(2 * np.pi * 23 * np.arange(n) / SR), dur) * 0.4 + filt(noise(dur), "bandpass", [1800, 3500], 2)
    mix(sfx, x * np.linspace(1, 0, n) ** 1.5, t, g)
def creak(t, dur=1.4, g=0.3):
    n = int(dur * SR); f = 260 + 60 * np.cumsum(rng.standard_normal(n)) / np.sqrt(n) * 3 + 40 * np.sin(2 * np.pi * 3 * np.arange(n) / SR)
    x = tone(f, dur, (1, 2, 3), (1, 0.5, 0.3)) * (0.5 + 0.5 * (rng.random(n) > 0.3)); mix(sfx, filt(x, "bandpass", [150, 2500], 2) * env(n, 0.1, 0.3), t, g)
def drip(t, g=0.18):
    x = tone(np.linspace(1700, 700, int(0.08 * SR)), 0.08) * expdec(int(0.08 * SR), 0.02); mix(sfx, x, t, g, rng.uniform(-0.8, 0.8))
def siren(t, dur, g=0.12):
    n = int(dur * SR); f = 650 + 260 * np.sin(2 * np.pi * 0.45 * np.arange(n) / SR)
    mix(sfx, tone(f, dur, (1, 2, 3), (1, 0.4, 0.2)) * env(n, 0.5, 1.0), t, g, -0.3)
def rumble(t, dur, g=0.5):
    n = int(dur * SR); x = filt(noise(dur), "lowpass", 110, 4) * 6 * (0.6 + 0.4 * np.sin(2 * np.pi * 1.7 * np.arange(n) / SR)); mix(sfx, x * env(n, 0.6, 1.0), t, g)
def grind(t, dur, g=0.25):
    n = int(dur * SR); x = tone(43 + 3 * np.sin(2 * np.pi * 0.5 * np.arange(n) / SR), dur, (1, 2, 3, 5, 7), (1, 0.7, 0.5, 0.3, 0.2)); x = np.tanh(2 * x) + 0.3 * filt(noise(dur), "bandpass", [150, 400], 2)
    mix(sfx, filt(x, "lowpass", 900, 2) * env(n, 0.8, 1.0), t, g)
    for k in np.arange(t + 0.4, t + dur - 0.3, 0.9): metal(k, 0.08, 0.5, 0.3)
def sparkle(t, dur, g=0.12):
    for _ in range(int(dur * 9)):
        tt = t + rng.uniform(0, dur); f = rng.uniform(1500, 4200); x = tone(f, 0.25, (1, 2.7), (1, 0.3)) * expdec(int(0.25 * SR), 0.05); mix(sfx, x, tt, g, rng.uniform(-0.8, 0.8))
def bell(t, f0=196, g=0.55):
    d = 7.0; n = int(d * SR); x = np.zeros(n)
    for r, a, dec in ((0.5, 0.6, 3.5), (1, 1, 2.6), (1.183, 0.5, 2.0), (1.506, 0.45, 1.8), (2, 0.35, 1.4), (2.514, 0.25, 1.1), (3.011, 0.2, 0.9)):
        x += a * tone(f0 * r, d) * expdec(n, dec)
    x *= env(n, 0.004, 0.5); mix(sfx, reverb(x, 3.5, 0.4), t, g)
def boom(t, g=0.8):
    n = int(2.2 * SR); x = tone(np.geomspace(90, 32, n), 2.2) * expdec(n, 0.6); y = filt(noise(2.2), "lowpass", 900, 2) * expdec(n, 0.12)
    mix(sfx, reverb(np.tanh(2 * x) + 0.4 * y, 2.5, 0.3), t, g)
    m = int(1.0 * SR); sw = filt(noise(1.0), "bandpass", [300, 5000], 2) * np.linspace(0, 1, m) ** 3; mix(sfx, sw, t - 1.0, g * 0.35)
def birds(t, dur, g=0.08):
    for _ in range(int(dur * 4)):
        tt = t + rng.uniform(0, dur)
        for k in range(rng.integers(2, 4)):
            f0 = rng.uniform(3200, 4800); x = tone(np.linspace(f0, f0 * rng.uniform(1.1, 1.4), int(0.06 * SR)), 0.06) * np.hanning(int(0.06 * SR)); mix(sfx, x, tt + k * 0.08, g, rng.uniform(-0.7, 0.7))
def buzz_off(t, g=0.12):
    n = int(0.25 * SR); x = (tone(120, 0.25, (1, 3, 5), (1, 0.5, 0.3))) * np.linspace(1, 0, n); mix(sfx, x, t, g)

# timeline of effects
for t, g in ((L(1) + 0.3, 0.2), (L(2) + 0.2, 0.2), (L(3) + 0.2, 0.2), (L(6) + 0.3, 0.2), (W(8, "tuesday"), 0.22), (W(11, "clara"), 0.25), (L(14) + 0.15, 0.22), (L(15) + 0.15, 0.22), (L(16) + 0.15, 0.22), (L(23) + 0.2, 0.22), (L(24) + 0.4, 0.2), (L(25) + 0.3, 0.2), (W(68, "98"), 0.25), (L(70) + 0.2, 0.2), (L(77) + 0.3, 0.2), (W(89, "11:58"), 0.25)):
    popfx(t, g)
engine(L(1), LE(1) - L(1) + 0.4, 0.28, 48, (60, 44))                                   # bus passing
splash(W(2, "drops") + 0.15 + 0.32, 0.55)
whoosh(W(3, "loses") + 0.1, 1.2, 0.18, 300, 1800)
for k in range(int(W(6, "stops") - L(6)) + 1): click(L(6) + k, 2600 if k % 2 else 1700, 0.25)
thud(W(6, "stops") + 0.1, 90, 0.25, 0.15); metal(W(6, "stops") + 0.1, 0.1, 1.6, 0.2)
for k in range(7): buzz_off(L(7) + 0.15 + k * 0.09, 0.035)
thud(L(7) + 0.25, 55, 0.2, 0.3)
birds(L(8), LE(8) - L(8) + 0.4, 0.06); click(W(8, "opens"), 3500, 0.1)
whoosh(W(14, "stops") - 0.1, 0.5, 0.25, 400, 2500); click(W(14, "stops") + 0.2, 1200, 0.2)
engine(L(15) + 0.6, 2.4, 0.35, 70, (90, 55)); whoosh(W(15, "prevents"), 0.6, 0.25, 200, 1500)
crackle(L(16), LE(16) - L(16) + 1.0, 0.35); whoosh(L(16) + 0.2, 1.2, 0.2, 100, 900)
birds(L(17), 3.0, 0.05)
splash(L(18) + 0.25 + 0.3, 0.55)
thud(L(19) + 0.45, 70, 0.7, 0.2); metal(L(19) + 0.45, 0.25, 0.8, 0.25); screech(L(19), 0.45, 0.12)
for k in range(10): click(L(19) + 0.5 + rng.uniform(0, 0.4), rng.uniform(4000, 7000), 0.08)
click(L(25) + 1.76, 900, 0.3); engine(L(25) + 1.9, LE(25) - L(25), 0.25, 50)
engine(L(26), L(29) - L(26) + 0.6, 0.3, 52); screech(L(29) + 0.05, 1.1, 0.2); thud(L(29) + 1.15, 60, 0.3, 0.2)
for k in range(3): metal(L(35) + 0.05 + k * 0.18, 0.22, 0.9 - k * 0.1, 0.4)
creak(L(35), 0.9, 0.2)
# distant shouting from below (crowd layer created later), footsteps on metal
for k in np.arange(L(38), L(42) - 0.2, 0.42): metal(k, 0.06, 1.3, 0.12)
creak(L(42) + 0.2, 1.6, 0.35); whoosh(L(42) + 0.6, 1.4, 0.15, 100, 600)
for tt in np.arange(L(43), L(83), 1.7): drip(tt + rng.uniform(0, 1.2), 0.12)
sparkle(L(63), L(66) - L(63), 0.1); whoosh(L(63), 1.0, 0.12)
rumble(L(66), 2.0, 0.35); sparkle(L(70), 2.0, 0.1); rumble(L(71), 2.0, 0.45)
thud(W(83, "red"), 60, 0.5, 0.3); buzz_off(W(83, "red"), 0.15)
siren(L(84), L(92) - L(84), 0.11)
for k in range(3): click(L(89) + 0.2 + k, 2000, 0.2)
rumble(L(90), L(94) - L(90), 0.45); grind(L(91), L(97) - L(91), 0.16)
sparkle(L(93), L(98) - L(93), 0.11);
for k in np.arange(L(93), L(98), 0.55): metal(k + rng.uniform(0, 0.3), 0.05, rng.uniform(0.6, 1.6), 0.2)
boom(W(100, "meet"), 0.5)
for tt in np.arange(L(109), L(111), 0.9): drip(tt + rng.uniform(0, 0.5), 0.14)
bell(W(112, "midnight"), 196, 0.55)
birds(L(114), LE(115) - L(114) + 0.6, 0.07); click(W(114, "wakes"), 3200, 0.08)
boom(W(116, "again") + 0.12, 0.9)

# crowd shout: many voices, reverb
from kokoro_onnx import Kokoro
k = Kokoro(f"{M}/kokoro-v1.0.onnx", f"{M}/voices-v1.0.bin")
crowd = np.zeros((int(3.5 * SR), 2))
for i, v in enumerate(["am_adam", "am_echo", "am_michael", "am_onyx", "af_bella", "af_nicole", "af_sarah", "bf_emma", "bm_george", "bm_lewis", "am_fenrir", "af_sky", "am_liam", "af_jessica"]):
    a, sr = k.create("Don't let her find the stairs!", voice=v, speed=1.12 + 0.08 * rng.random(), lang="en-gb" if v[0] == "b" else "en-us")
    shift = 2 ** (rng.uniform(-2, 2) / 12); a = signal.resample(a, int(len(a) * SR / sr / shift))
    off = int(rng.uniform(0, 0.12) * SR); seg_ = st(np.tanh(2.5 * a), rng.uniform(-0.9, 0.9)); crowd[off:off + len(seg_)] += seg_[:len(crowd) - off]
crowd = reverb(filt(crowd, "highpass", 180, 2), 2.0, 0.45); crowd /= np.abs(crowd).max()
mix(sfx, crowd, L(102) + 0.05, 0.38)
far = reverb(filt(crowd, "lowpass", 700, 2), 3.0, 0.7); far /= np.abs(far).max()
mix(sfx, far, W(37, "shouting") - 0.2, 0.16); mix(sfx, far, W(37, "shouting") + 1.4, 0.12)

# ---------------- narration + master ----------------
nar, sr = sf.read(f"{P}/narration_24k.wav", dtype="float32")
nar = signal.resample_poly(nar, 2, 1)[:N]
voiced = np.abs(nar) > 0.02; rms = np.sqrt((nar[voiced] ** 2).mean()); nar = nar * (10 ** (-17 / 20) / rms)
voice = np.zeros((N, 2)); voice[:len(nar)] = st(nar)
music = reverb(music, 2.2, 0.25)
def rmsdb(x): v = x[np.abs(x).max(1) > 1e-4]; return 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-9)
mus_gain = 10 ** ((rmsdb(voice) - 8.5 - rmsdb(music)) / 20)   # music bed ~8.5 dB under the voice
music *= mus_gain
out = voice + music + sfx * 0.32
out = out[:int(DUR * SR)]
peak = np.abs(out).max(); out = out / max(1.0, peak / 0.95)
sf.write(f"{P}/mix.wav", out, SR, subtype="PCM_24")
sf.write(f"{P}/music_only.wav", music[:int(DUR * SR)], SR, subtype="PCM_16"); sf.write(f"{P}/sfx_only.wav", sfx[:int(DUR * SR)] * 0.32, SR, subtype="FLOAT"); sf.write(f"{P}/voice_only.wav", voice[:int(DUR * SR)], SR, subtype="FLOAT")
print(f"dur {DUR:.2f}s  voice {rmsdb(voice):.1f} dBFS  music {rmsdb(music):.1f} dBFS  sfx {rmsdb(sfx):.1f} dBFS  peak {peak:.2f}")
