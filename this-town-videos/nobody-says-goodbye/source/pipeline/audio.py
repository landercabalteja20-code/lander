# Soundtrack for "Nobody is allowed to say goodbye": synthesized score + SFX + narration -> mix.wav (48 kHz stereo)
import sys, json, numpy as np, soundfile as sf
from scipy import signal
P = sys.argv[1]
SR = 48000
tl = json.load(open(f"{P}/timeline.json")); words = json.load(open(f"{P}/words.json"))
DUR = tl[-1]["end"] + 1.6
CUT = tl[173]["end"] + 0.5                     # hard cut to black at the very end
N = int(DUR * SR) + SR
rng = np.random.default_rng(11)

def W(line, word, n=1):
    k = 0
    for w in words:
        if w["line"] == line and w["w"].lower().strip('.,!?;:"“”…‘’').startswith(word.lower()):
            k += 1
            if k == n: return w["t"]
    raise KeyError((line, word))
L = lambda i: tl[i]["start"]
LE = lambda i: tl[i]["end"]

def sos(kind, f, order=4): return signal.butter(order, f, btype=kind, fs=SR, output="sos")
def filt(x, kind, f, order=4): return signal.sosfilt(sos(kind, f, order), x, axis=0)
def env(n, a=0.01, r=0.2):
    e = np.ones(n); na = min(n, max(1, int(a * SR))); nr = min(n, max(1, int(r * SR)))
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

music = np.zeros((N, 2)); sfx = np.zeros((N, 2)); amb = np.zeros((N, 2))

# ======================= score =======================
BEAT = 60 / 70
Dm, Bb, F, C, Gm, A, Eb, Am = [50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55], [43, 46, 50], [45, 49, 52], [51, 55, 58], [45, 48, 52]
def pad(notes, t0, dur, cutoff, gain, att=0.9, rel=1.4):
    for m in notes:
        for det, pan in ((-0.07, -0.5), (0.07, 0.5)):
            x = tone(midi(m) * 2 ** (det / 12), dur, (1, 2, 3, 4, 5), (1, 0.5, 0.33, 0.25, 0.2))
            mix(music, filt(x, "lowpass", cutoff, 2) * env(len(x), att, rel), t0, gain * 0.05, pan)
def musicbox(m, t0, gain, detune=0.0, dec=0.7):
    d = dec * 3; f = midi(m) * 2 ** (detune / 12)
    x = tone(f, d, (1, 3.0, 5.98, 9.2), (1, 0.28, 0.1, 0.04)) * expdec(int(d * SR), dec) * env(int(d * SR), 0.002, 0.05)
    mix(music, x, t0, gain, rng.uniform(-0.5, 0.5))
def piano(m, t0, gain, dec=1.3, pan=None):
    d = dec * 3; f = midi(m); n = int(d * SR)
    x = tone(f, d, (1, 2, 3, 4, 5.03, 6.07), (1, 0.42, 0.22, 0.11, 0.06, 0.035)) * (0.6 * expdec(n, dec * 0.25) + 0.4 * expdec(n, dec)) * env(n, 0.004, 0.08)
    mix(music, filt(x, "lowpass", 3800, 2), t0, gain, (m - 62) / 30 if pan is None else pan)
def drone(t0, t1, notes, gain, cutoff=300, att=2.5, rel=2.5):
    d = t1 - t0
    if d <= 0: return
    for m in notes:
        x = tone(midi(m), d, (1, 2, 3), (1, 0.3, 0.1)); lfo = 0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * np.arange(len(x)) / SR + m)
        mix(music, filt(x * lfo, "lowpass", cutoff, 2) * env(len(x), att, rel), t0, gain)
def glass(t0, t1, m, gain):          # thin high sustained tone for unease
    d = t1 - t0; x = tone(midi(m) * (1 + 0.002 * np.sin(2 * np.pi * 5 * np.arange(int(d * SR)) / SR)), d, (1, 2), (1, 0.2))
    mix(music, x * env(len(x), 2.0, 2.0), t0, gain)
def heartbeat(t, g):
    for dt, a in ((0, 1.0), (0.2, 0.7)):
        n = int(0.4 * SR); x = tone(np.linspace(70, 42, n), 0.4) * expdec(n, 0.07); mix(music, np.tanh(2 * x), t + dt, g * a)
def strings(notes, t0, dur, gain, cutoff=2200):
    for m in notes:
        for det in (-0.1, 0.0, 0.1):
            n = int(dur * SR); vib = 1 + 0.003 * np.sin(2 * np.pi * (5 + det) * np.arange(n) / SR)
            x = tone(midi(m) * 2 ** (det / 12) * vib, dur, (1, 2, 3, 4, 5, 6), (1, 0.6, 0.45, 0.3, 0.2, 0.12))
            mix(music, filt(x, "lowpass", cutoff, 2) * env(n, 1.4, 1.6), t0, gain * 0.02, det * 4)
def progression(t0, t1, chords, bars=2, **kw):
    t = t0; k = 0; out = []
    while t < t1 - 0.2:
        d = min(bars * 4 * BEAT, t1 - t); out.append((t, d, chords[k % len(chords)])); t += d; k += 1
    return out
def silence(t0, t1, fade=0.3):
    i0, i1 = int(t0 * SR), int(t1 * SR); f = int(fade * SR)
    music[i0:i0 + f] *= np.linspace(1, 0, f)[:, None]; music[i0 + f:i1] = 0

# A: the town's strange rule — music box over a soft pad, clock ticking (lines 0-13)
for t, d, ch in progression(0.2, L(14), [Dm, Bb, F, C]):
    pad(ch, t, d + 1.2, 1300, 0.75)
    for k in range(int(d / (BEAT / 2))):
        musicbox(ch[[0, 1, 2, 1][k % 4]] + 24 + (12 if k % 8 == 6 else 0), t + k * BEAT / 2, 0.05)
# B: the mother's goodbye — piano, poignant (lines 14-19 'stopped')
STOP = W(19, "stopped")
for t, d, ch in progression(L(14), STOP, [Dm, Bb, Gm, A], bars=1):
    pad(ch, t, d + 1.0, 1100, 0.7)
    piano(ch[0] - 12, t, 0.10)
    for k, i in enumerate([0, 1, 2, 1]): piano(ch[i] + 12, t + k * BEAT, 0.055)
silence(STOP - 0.05, STOP + 0.1, 0.06)
# C: erased — dissonant low drone, glassy tone, lone piano notes (19-29)
drone(STOP + 0.4, L(30) + 1.5, [38, 39, 45], 0.05, 260)
glass(STOP + 1.0, L(30), 86, 0.006)
for t in np.arange(STOP + 2.0, L(30) - 1, 4.3): piano(int(rng.choice([38, 41, 45, 46])), t, 0.07, 2.0)
# D: night / the lost passengers' terminal — wide drone, sparse pentatonic piano (30-45)
drone(L(30), L(46) + 1.0, [33, 40, 45], 0.055, 320)
for t in np.arange(L(31), L(46) - 1, 2.6): piano(int(rng.choice([62, 65, 67, 69, 72, 74])), t + rng.uniform(0, 0.6), 0.045, 2.2)
pad(Am, L(34), L(46) - L(34), 700, 0.45, 2.0, 2.0)
# E: the photographs and the ledger — heartbeat pulse, rising pad (46-70)
for t, d, ch in progression(L(46), L(71), [Dm, Bb, Gm, A]):
    cut = 700 + 900 * (t - L(46)) / (L(71) - L(46)); pad(ch, t, d + 1.2, cut, 0.8)
for t in np.arange(L(46), L(71) - 0.5, BEAT): heartbeat(t, 0.10)
for t in np.arange(L(51), L(58), BEAT * 2): musicbox(int(rng.choice([74, 77, 81])), t, 0.03, -0.25)
# F: confronting his mother, the basement — tense half-step pad, heartbeat speeds toward the truth (71-90)
FATHER = W(90, "father")
for t, d, ch in progression(L(71), L(90), [Dm, Eb], bars=1): pad(ch, t, d + 1.0, 800, 0.8)
drone(L(71), FATHER, [26, 38], 0.05, 200)
t = L(82)
while t < FATHER - 0.3:
    k = (t - L(82)) / (FATHER - L(82)); heartbeat(t, 0.1 + 0.05 * k); t += BEAT * (1 - 0.45 * k)
silence(LE(90), L(92) - 0.2, 0.05)
glass(FATHER + 0.5, L(92), 93, 0.008)                                      # ringing ears
# G: her memories (sepia) — bittersweet detuned music box (92-101)
MEL = [69, 72, 74, 76, 74, 72, 69, 67, 65, 67, 69, 72, 69, 65, 64, 62]
for t, d, ch in progression(L(92), L(102), [F, C, Dm, Bb]): pad(ch, t, d + 1.4, 900, 0.65)
for k, t in enumerate(np.arange(L(92) + 0.3, L(102) - 0.5, BEAT)): musicbox(MEL[k % len(MEL)] + 12, t, 0.045, -0.18)
# H: the tickets — drone + ticking + pulse (102-121)
drone(L(102), L(122) + 1, [38, 45, 51], 0.05, 280)
for t in np.arange(L(102), L(122) - 0.4, BEAT * 2): heartbeat(t, 0.07)
for t, d, ch in progression(L(113), L(122), [Am, F], bars=2): pad(ch, t, d + 1.2, 750, 0.55)
# I: "because you asked me to" — slow piano and pad (122-139)
for t, d, ch in progression(L(122), L(140), [Dm, Bb, F, C]):
    pad(ch, t, d + 1.2, 1000, 0.7); piano(ch[0] - 12, t, 0.09, 2.0)
    for k, i in enumerate([0, 2, 1, 2, 0, 2, 1, 2]): piano(ch[i] + 12, t + k * BEAT, 0.045, 1.6)
# J: the last goodbye — piano melody, strings swell toward "Goodbye" (140-156)
GB = W(155, "goodbye")
JM = [(69, 2), (69, 1), (67, 1), (65, 2), (64, 2), (65, 1), (64, 1), (62, 2), (74, 2), (72, 1), (70, 1), (69, 2), (67, 2), (69, 1), (72, 1), (69, 4)]
for t, d, ch in progression(L(140), GB + 1.5, [Dm, Bb, F, C, Gm, Bb, C, Dm]):
    k = (t - L(140)) / (GB - L(140)); pad(ch, t, d + 1.4, 1000 + 1200 * k, 0.7 + 0.35 * k); piano(ch[0] - 12, t, 0.1, 2.2)
    if t > L(146) - 1: strings([n + 12 for n in ch], t, d + 1.5, 0.6 + 0.8 * k)
t = L(146); i = 0
while t < GB - 0.5:
    m, b = JM[i % len(JM)]; piano(m + 12, t, 0.075, 1.6); t += b * BEAT; i += 1
strings([62, 69, 74, 77], GB - 0.3, LE(156) - GB + 2.5, 1.5)                 # the swell under "Goodbye", fading with the picture
music[int(LE(156) * SR):int(L(157) * SR)] *= np.linspace(1, 0.25, int(L(157) * SR) - int(LE(156) * SR))[:, None]
# K: the oldest photograph again — eerie, out-of-tune music box over a low drone (157-166)
drone(L(157), LE(166) + 1.5, [38, 44], 0.05, 220)
for k, t in enumerate(np.arange(L(157) + 0.4, LE(166), BEAT * 1.25)): musicbox(MEL[k % len(MEL)] + 12, t, 0.05, -0.45 + 0.3 * np.sin(k), 1.1)
# L: epilogue — cold, sparse high piano, unresolved (167-173), reversed swell into the cut
for t, d, ch in progression(L(167), L(173), [Am, F], bars=2): pad(ch, t, d + 1.5, 900, 0.5, 1.5, 1.5)
for t in np.arange(L(167) + 0.8, L(173), 2.8): piano(int(rng.choice([76, 81, 84, 79])), t, 0.04, 2.5)
n = int((CUT - L(173)) * SR); sw = sum(tone(midi(m), CUT - L(173), (1, 2, 3), (1, 0.4, 0.2)) for m in (45, 57, 64, 70))
mix(music, filt(sw, "lowpass", 1500, 2) * np.linspace(0, 1, n) ** 3, L(173), 0.04)

# ======================= sfx =======================
def click(t, f=2500, g=0.2, dec=0.004):
    x = filt(noise(0.03), "bandpass", [f * 0.6, f * 1.4], 2) * expdec(int(0.03 * SR), dec); mix(sfx, x, t, g)
def tick(t, g=0.18, hi=True): click(t, 3200 if hi else 2100, g)
def thud(t, f=65, g=0.6, dec=0.25):
    n = int(1.0 * SR); x = tone(np.linspace(f * 1.6, f, n), 1.0) * expdec(n, dec); mix(sfx, np.tanh(1.5 * x), t, g)
def hit(t, g=0.6):
    n = int(2.5 * SR); x = tone(np.geomspace(110, 38, n), 2.5) * expdec(n, 0.5); y = filt(noise(2.5), "lowpass", 800, 2) * expdec(n, 0.08)
    mix(sfx, reverb(np.tanh(2 * x) + 0.35 * y, 3.0, 0.4), t, g)
def whoosh(t, dur=0.7, g=0.3, f0=150, f1=2500):
    n = int(dur * SR); x = noise(dur); lo = filt(x, "bandpass", [f0, f0 * 3], 2); hi = filt(x, "bandpass", [f1 / 3, f1], 2); w = np.linspace(0, 1, n)
    mix(sfx, (lo * (1 - w) + hi * w) * np.sin(np.pi * np.arange(n) / n) ** 2 * 1.5, t, g)
def sparkle(t, dur, g=0.1):
    for _ in range(int(dur * 9)):
        tt = t + rng.uniform(0, dur); f = rng.uniform(1500, 4200); x = tone(f, 0.25, (1, 2.7), (1, 0.3)) * expdec(int(0.25 * SR), 0.05); mix(sfx, x, tt, g, rng.uniform(-0.8, 0.8))
def popfx(t, g=0.2):
    x = tone(np.linspace(700, 1400, int(0.07 * SR)), 0.07) * expdec(int(0.07 * SR), 0.02); mix(sfx, x, t, g)
def vanish(t, g=0.2):                     # reversed shimmer that sucks out
    n = int(0.6 * SR); x = (filt(noise(0.6), "bandpass", [2000, 7000], 2) * np.linspace(0, 1, n) ** 3)
    mix(sfx, x, t - 0.45, g); popfx(t + 0.1, g * 0.6)
def creak(t, dur=1.4, g=0.3):
    n = int(dur * SR); f = 230 + 70 * np.cumsum(rng.standard_normal(n)) / np.sqrt(n) * 3 + 40 * np.sin(2 * np.pi * 3 * np.arange(n) / SR)
    x = tone(f, dur, (1, 2, 3), (1, 0.5, 0.3)) * (0.5 + 0.5 * (rng.random(n) > 0.3)); mix(sfx, filt(x, "bandpass", [150, 2500], 2) * env(n, 0.1, 0.3), t, g)
def slam(t, g=0.5): thud(t, 70, g, 0.12); click(t + 0.01, 1200, g * 0.5, 0.02)
def steps(t0, n, gap, g=0.2, f=1100):
    for k in range(n): thud(t0 + k * gap, 95, g * 0.6, 0.05); click(t0 + k * gap, f, g * 0.4, 0.01)
def page(t, g=0.2):
    n = int(0.35 * SR); x = filt(noise(0.35), "bandpass", [1500, 7000], 2) * np.sin(np.pi * np.arange(n) / n) ** 3; mix(sfx, x, t, g, rng.uniform(-0.4, 0.4))
def stamp(t, g=0.5): thud(t, 80, g, 0.08); click(t, 900, g * 0.6, 0.015)
def beep(t, g=0.12):
    for k in range(2): mix(sfx, tone(330, 0.16, (1, 3, 5), (1, 0.3, 0.15)) * env(int(0.16 * SR), 0.005, 0.03), t + k * 0.22, g)
def chime(t, g=0.18):
    for k, m in enumerate((76, 72)):
        n = int(2.2 * SR); x = tone(midi(m), 2.2, (1, 2, 3), (1, 0.25, 0.08)) * expdec(n, 0.6) * env(n, 0.005, 0.2); mix(sfx, reverb(x, 2.0, 0.35), t + k * 0.55, g)
def shutter(t, g=0.15): click(t, 3000, g); click(t + 0.06, 1800, g * 0.8)
def bell(t, f0=180, g=0.45):
    d = 6.0; n = int(d * SR); x = np.zeros(n)
    for r, a, dec in ((0.5, 0.6, 3.5), (1, 1, 2.6), (1.183, 0.5, 2.0), (1.506, 0.45, 1.8), (2, 0.35, 1.4), (2.514, 0.25, 1.1)): x += a * tone(f0 * r, d) * expdec(n, dec)
    mix(sfx, reverb(x * env(n, 0.004, 0.5), 3.5, 0.4), t, g)
def whistle(t, dur=2.2, g=0.4, far=False):
    n = int(dur * SR); vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * np.arange(n) / SR); bend = np.minimum(1, 0.94 + 0.06 * np.arange(n) / (0.25 * SR))
    x = sum(a * tone(f * vib * bend, dur, (1, 2, 3), (1, 0.35, 0.15)) for f, a in ((466, 1), (554, 0.8), (698, 0.6)))
    x = x + 0.25 * filt(noise(dur), "bandpass", [600, 3000], 2); x *= env(n, 0.12, 0.6)
    if far: x = filt(x, "lowpass", 1400, 2)
    mix(sfx, reverb(x, 3.0, 0.55 if far else 0.35), t, g)
def hiss(t, dur, g=0.15):
    n = int(dur * SR); x = filt(noise(dur), "highpass", 2500, 2) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.8 * np.arange(n) / SR)); mix(amb, x * env(n, 0.4, 0.8), t, g)
def idle(t, dur, g=0.2):
    n = int(dur * SR); x = filt(noise(dur), "lowpass", 140, 4) * 5 * (0.75 + 0.25 * np.sin(2 * np.pi * 2.2 * np.arange(n) / SR)); mix(amb, x * env(n, 0.8, 1.0), t, g)
def chug(t, dur, g=0.3, r0=1.2, r1=5.0):
    tt = t; k = 0
    while tt < t + dur:
        r = r0 + (r1 - r0) * (tt - t) / dur; n = int(0.22 * SR)
        x = filt(noise(0.22), "bandpass", [300, 2500], 2) * expdec(n, 0.05) * (1.0 if k % 2 == 0 else 0.6)
        mix(sfx, x, tt, g * (1 - 0.6 * (tt - t) / dur)); tt += 1 / (2 * r); k += 1
def rain(t, dur, g=0.15):
    n = int(dur * SR); x = filt(noise(dur), "bandpass", [800, 9000], 2) * 0.5
    for _ in range(int(dur * 40)):
        i = rng.integers(0, max(1, n - 900)); x[i:i + 900] += filt(noise(900 / SR), "bandpass", [2000, 8000], 2) * expdec(900, 0.002) * rng.uniform(0.4, 1.5)
    mix(amb, x * env(n, 0.6, 0.8), t, g)
def wind(t, dur, g=0.15):
    n = int(dur * SR); lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.11 * np.arange(n) / SR) * np.sin(2 * np.pi * 0.07 * np.arange(n) / SR + 1)
    mix(amb, filt(noise(dur), "bandpass", [180, 900], 2) * lfo * env(n, 1.5, 1.5), t, g)
def crickets(t, dur, g=0.04):
    for tt in np.arange(t, t + dur - 0.3, 0.55):
        for k in range(3): mix(amb, tone(4600, 0.03) * np.hanning(int(0.03 * SR)), tt + k * 0.05 + rng.uniform(0, 0.05), g, rng.uniform(-0.8, 0.8))
def birds(t, dur, g=0.06):
    for _ in range(int(dur * 3)):
        tt = t + rng.uniform(0, dur)
        for k in range(rng.integers(2, 4)):
            f0 = rng.uniform(3200, 4800); x = tone(np.linspace(f0, f0 * rng.uniform(1.1, 1.4), int(0.06 * SR)), 0.06) * np.hanning(int(0.06 * SR)); mix(amb, x, tt + k * 0.08, g, rng.uniform(-0.7, 0.7))
def murmur(t, dur, g=0.1):                   # crowd babble: band-limited noise with syllable-rate modulation
    n = int(dur * SR); out = np.zeros(n)
    for f0 in (350, 600, 900, 1400, 2300):
        mod = filt(np.abs(rng.standard_normal(n)), "lowpass", 5, 2); mod /= np.abs(mod).max() + 1e-9
        out += filt(noise(dur), "bandpass", [f0 * 0.8, f0 * 1.25], 2) * mod
    mix(amb, out * env(n, 1.0, 1.0), t, g)
def roomtone(t, dur, g=0.06, lo=60, hi=400): n = int(dur * SR); mix(amb, filt(noise(dur), "bandpass", [lo, hi], 2) * env(n, 1.0, 1.0), t, g)
def crackle(t, dur, g=0.15):
    n = int(dur * SR); x = np.zeros(n)
    for _ in range(int(dur * 30)):
        i = rng.integers(0, max(1, n - 600)); x[i:i + 600] += filt(noise(600 / SR), "bandpass", [1500, 6000], 2) * expdec(600, 0.002) * rng.uniform(0.3, 1.5)
    mix(amb, x + 0.15 * filt(noise(dur), "lowpass", 500, 2), t, g)
def projector(t, dur, g=0.1):
    n = int(dur * SR); x = filt(noise(dur), "bandpass", [200, 1600], 2) * (0.6 + 0.4 * (np.sin(2 * np.pi * 24 * np.arange(n) / SR) > 0)); mix(amb, x * env(n, 0.5, 0.5), t, g); crackle(t, dur, g * 0.8)
def ticking(t0, t1, g=0.12, period=1.0):
    for k, t in enumerate(np.arange(t0, t1, period)): tick(t, g, k % 2 == 0)
def rewind(t, dur, g=0.12):
    tt = t; k = 0
    while tt < t + dur:
        n = int(0.05 * SR); x = filt(noise(0.05), "bandpass", [1800, 4200], 2) * np.linspace(0, 1, n) ** 3; mix(sfx, x, tt, g)
        tt += max(0.06, 0.5 - 0.06 * k); k += 1

# --- the rule (0-13)
birds(0, L(4), 0.05); murmur(0.2, L(3) - 0.2, 0.03)
whoosh(W(1, "see") - 0.1, 0.5, 0.06)
rain(L(3), LE(3) - L(3) + 1.0, 0.09); bell(L(4) + 0.4, 160, 0.3)
ticking(L(4), L(6), 0.06, BEAT)
vanish(W(6, "disappears") + 0.15, 0.2); whoosh(W(8, "disappear"), 0.9, 0.12, 200, 3000)
sparkle(L(9) + 0.3, LE(9) - L(9), 0.07)
for i in range(6): popfx(L(10) + 0.25 + i * 0.12 + 0.05, 0.12)
whoosh(W(11, "names"), 0.8, 0.12, 400, 4000)
hit(LE(12) + 0.02, 0.25); popfx(W(13, "elias"), 0.2)
# --- the station goodbye (14-29)
murmur(L(15), STOP - L(15), 0.06); idle(L(15), STOP - L(15) + 0.5, 0.12); hiss(L(16), 2.5, 0.06)
ticking(L(15), STOP, 0.10, 1.0)
tick(STOP, 0.22); thud(STOP + 0.02, 55, 0.5, 0.35); whoosh(STOP - 0.35, 0.4, 0.08, 2000, 6000)
amb[int(STOP * SR):int((STOP + 4.0) * SR)] *= 0.12                         # the world goes quiet when the clock stops
creak(L(24) + 0.1, 1.2, 0.28); hit(LE(24), 0.22)
beep(W(26, "record"), 0.12); sparkle(L(27) + 0.3, 1.5, 0.06); hit(LE(28), 0.3)
# --- the lost passengers (30-58)
wind(L(30), L(34) - L(30) + 1, 0.12); crickets(L(30), L(34) - L(30), 0.035)
steps(L(31) + 0.1, 4, 0.45, 0.15); hit(LE(33), 0.3)
creak(L(34) - 0.3, 1.8, 0.3)
roomtone(L(34), L(71) - L(34), 0.07); murmur(L(34), L(51) - L(34), 0.04); crackle(L(34), L(51) - L(34), 0.05)
for t in np.arange(L(34), L(71), 2.7): click(t + rng.uniform(0, 1.5), 1600, 0.04)   # drips
wind(L(43), L(46) - L(43), 0.14); whistle(W(45, "comes") - 0.2, 3.0, 0.16, far=True)
sparkle(L(47), 2.0, 0.05); hit(LE(50), 0.4)
for i in (51, 53, 54): shutter(L(i) + 0.15, 0.1)
steps(L(59) + 0.1, 6, 0.4, 0.12)
page(L(60) + 0.2, 0.18); page(L(61) + 0.3, 0.15); stamp(W(62, "farewell") - 0.05, 0.28); stamp(W(62, "accepted") - 0.05, 0.28)
for i, t in enumerate([L(64) + 0.3, L(65) + 0.2, L(66) + 0.15, L(67) + 0.15, L(68) + 0.2]): tick(t, 0.2, i % 2 == 0); thud(t, 50, 0.22, 0.2)
hit(LE(69), 0.4); rewind(L(70), LE(70) - L(70), 0.08)
# --- home and the basement (71-91)
steps(L(71), 7, 0.22, 0.2); slam(L(71) + 1.6, 0.4)
for k in range(6): creak(L(74) + k * 0.33, 0.35, 0.08)
click(W(75, "locked"), 1500, 0.2, 0.01); creak(L(75) + 0.9, 1.4, 0.2)
for i in range(76, 80): page(L(i) + 0.2, 0.2)
hit(LE(85), 0.32)
hit(LE(90) + 0.02, 0.55)
# --- her memories (92-101)
projector(L(92), L(102) - L(92), 0.05)
rain(L(93), LE(93) - L(93) + 0.6, 0.1); birds(L(94), LE(97) - L(94), 0.04)
rewind(L(98), LE(99) - L(98), 0.07)
# --- the tickets (102-121)
roomtone(L(102), L(113) - L(102), 0.05)
creak(W(104, "opened"), 1.0, 0.2); page(L(105) + 0.2, 0.15); page(L(107) + 0.2, 0.15)
whoosh(L(110) + 0.4, 0.6, 0.12, 800, 5000); stamp(L(111) - 0.12, 0.3); hit(LE(111), 0.42)
roomtone(L(113), L(120) - L(113), 0.07); murmur(L(113), L(120) - L(113), 0.03); hit(LE(113), 0.28)
vanish(W(119, "disappear") + 0.3, 0.18); ticking(L(120), L(122), 0.08, 1.0); hit(LE(121), 0.3)
# --- "because you asked me to" (122-139)
murmur(L(122), LE(123) - L(122), 0.025); idle(L(122), LE(123) - L(122), 0.06)
page(L(127) + 0.4, 0.15); whoosh(L(130) + 0.5, 0.6, 0.1, 800, 4000)
ticking(W(139, "morning"), L(140), 0.12, 1.0)
# --- the last night (140-156)
roomtone(L(140), L(146) - L(140), 0.05)
whistle(W(146, "whistle") + 0.1, 2.4, 0.17)
hiss(L(148), L(156) - L(148), 0.07); idle(L(148), L(156) - L(148) + 1.5, 0.14)
whistle(L(156) - 0.2, 1.8, 0.22); chug(L(156) + 0.3, LE(156) - L(156) + 1.0, 0.18)
# --- the twist (157-166)
projector(L(157), LE(161) - L(157) + 0.5, 0.05)
chug(L(162), LE(162) - L(162) + 0.8, 0.1, 2.0, 4.5); whistle(L(162) + 0.3, 1.6, 0.07, far=True)
wind(L(163), LE(166) - L(163) + 1.0, 0.1)
# --- epilogue: present day (167-173)
roomtone(L(167), CUT - L(167), 0.05, 50, 250); murmur(L(167), CUT - L(167), 0.012); chime(L(167) + 0.6, 0.12)
steps(L(169) + 0.2, 4, 0.4, 0.1)
ticking(L(167), W(173, "backward") - 0.3, 0.07, 1.0)
tb = W(173, "backward") - 0.3; t = tb; k = 0
while t < CUT:                                                               # the clock runs backward, faster and faster
    n = int(0.06 * SR); x = filt(noise(0.06), "bandpass", [2000, 4500], 2) * np.linspace(0, 1, n) ** 4; mix(sfx, x, t, 0.12)
    t += max(0.07, 0.6 * 0.82 ** k); k += 1

# ======================= narration + master =======================
nar, sr = sf.read(f"{P}/narration_24k.wav", dtype="float32")
nar = signal.resample_poly(nar, 2, 1)[:N]
voiced = np.abs(nar) > 0.02; rms = np.sqrt((nar[voiced] ** 2).mean()); nar = nar * (10 ** (-17 / 20) / rms)
voice = np.zeros((N, 2)); voice[:len(nar)] = st(nar)
music = reverb(music, 2.2, 0.25); sfx = reverb(sfx, 1.2, 0.12)
def rmsdb(x): v = x[np.abs(x).max(1) > 1e-4]; return 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-9)
music *= 10 ** ((rmsdb(voice) - 9.0 - rmsdb(music)) / 20)       # score sits ~9 dB under the voice
out = voice + music + sfx * 0.32 + amb * 0.32
i = int(CUT * SR); out[i:] = 0                                   # cut to black: silence
out = out[:int(DUR * SR)]
peak = np.abs(out).max(); out = out / max(1.0, peak / 0.95)
sf.write(f"{P}/mix.wav", out, SR, subtype="PCM_24")
print(f"dur {DUR:.2f}s  voice {rmsdb(voice):.1f}  music {rmsdb(music):.1f}  sfx {rmsdb(sfx * 0.32):.1f}  amb {rmsdb(amb * 0.32):.1f} dBFS  peak {peak:.2f}")
# ---- level report: loudest effect moments vs the voice around them
def strms(x, win=0.4):
    k = int(win * SR); c = signal.fftconvolve((x[:int(DUR * SR)] ** 2).mean(1), np.ones(k) / k, "same"); return 10 * np.log10(np.maximum(c, 1e-12))
s_ = strms(sfx * 0.32 + amb * 0.32); v_ = strms(voice); m_ = strms(music)
vmed = np.median(v_[v_ > -60]); print(f"voice median (400ms) {vmed:.1f} dB")
order = np.argsort(s_)[::-1]; picked = []
for i in order:
    if all(abs(i - j) > SR * 1.5 for j in picked): picked.append(i)
    if len(picked) == 12: break
for i in sorted(picked): print(f"  t={i / SR:7.2f}s  fx {s_[i]:6.1f}  voice {v_[i]:6.1f}  music {m_[i]:6.1f}")
