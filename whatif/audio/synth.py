"""Tiny offline synth for What-If episodes (numpy + scipy).

Instruments: additive formant-synthesised singing voice, detuned-saw pads, FM bell arpeggio,
sub bass, kick/clap/hat/shaker, risers, crowd cheers, whale calls, rain.
Effects: convolution reverb, ping-pong delay, cheap-PA filter, tape stop, bus compression.
Everything is deterministic (seeded).
"""
import numpy as np
from scipy import signal

SR = 44100
VOWELS = {  # soprano formants: freqs (Hz), bandwidths (Hz), gains (dB)
    'a': ([800, 1150, 2900, 3900, 4950], [80, 90, 120, 130, 140], [0, -6, -32, -20, -50]),
    'e': ([350, 2000, 2800, 3600, 4950], [60, 100, 120, 150, 200], [0, -20, -15, -40, -56]),
    'i': ([270, 2140, 2950, 3900, 4950], [60, 90, 100, 120, 120], [0, -12, -26, -26, -44]),
    'o': ([450, 800, 2830, 3800, 4950], [70, 80, 100, 130, 135], [0, -11, -22, -22, -50]),
    'u': ([325, 700, 2700, 3800, 4950], [50, 60, 170, 180, 200], [0, -16, -35, -40, -60]),
    'm': ([260, 1800, 2600, 3300, 4200], [70, 250, 300, 300, 300], [0, -32, -40, -44, -52]),
}
VOWEL_OPEN = {'a': 1.0, 'o': 0.8, 'e': 0.65, 'i': 0.45, 'u': 0.4, 'm': 0.0}
VOWEL_LIST = ['a', 'e', 'i', 'o', 'u', 'm']


def mtof(m):
    return 440.0 * 2 ** ((np.asarray(m, dtype=np.float64) - 69) / 12)


NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n2m(name):
    """'A4', 'C#5', 'Bb3' -> midi"""
    pc = NOTE[name[0]]
    rest = name[1:]
    if rest.startswith('#'):
        pc += 1; rest = rest[1:]
    elif rest.startswith('b'):
        pc -= 1; rest = rest[1:]
    return 12 * (int(rest) + 1) + pc


def rng(seed):
    return np.random.default_rng(seed)


def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    e = np.full(n, s, dtype=np.float32)
    a = min(a, n)
    e[:a] = np.linspace(0, 1, a, dtype=np.float32)
    dd = min(d, max(0, n - a))
    e[a:a + dd] = np.linspace(1, s, dd, dtype=np.float32)
    if r > 0:
        rr = min(r, n)
        e[n - rr:] *= np.linspace(1, 0, rr, dtype=np.float32)
    return e


def place(buf, x, t, gain=1.0):
    """mix mono or stereo x into stereo buf at time t (s)"""
    i = int(round(t * SR))
    if i >= buf.shape[1]:
        return
    if x.ndim == 1:
        x = np.stack([x, x])
    if i < 0:
        x = x[:, -i:]; i = 0
    n = min(x.shape[1], buf.shape[1] - i)
    if n <= 0:
        return
    buf[:, i:i + n] += x[:, :n] * gain


def pan(x, p):
    """equal-power pan, p in [-1, 1]"""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)])


# ------------------------------------------------------------------------------------------------
# singing voice (additive, formant envelope)
def _formant_env(freqs, F, BW, G):
    """freqs: (K, T) harmonic freqs; F/BW/G: (5, T) -> amplitude (K, T)"""
    out = np.zeros_like(freqs)
    f = np.maximum(freqs, 1.0)
    for i in range(5):
        Fi, Bi, Gi = F[i][None, :], BW[i][None, :], 10 ** (G[i][None, :] / 20)
        out += Gi / np.sqrt(1 + ((f * f - Fi * Fi) / (f * Bi)) ** 2)
    return out


def sing(notes, dur, *, seed=1, detune_cents=0.0, vib_rate=5.3, vib_depth=32, breath=0.08, tilt=1.15,
         ctrl_rate=1000, kmax_hz=9000, scoop=45, glide=0.045, attack=0.07, release=0.16, formant_shift=1.0,
         return_ctrl=False):
    """notes: list of (start_s, end_s, midi, vowel, vel). vowel may be 'ma', 'na', 'la' etc. (onset + vowel).
    Returns mono float32 array of length dur*SR (and optional control curves)."""
    R = rng(seed)
    N = int(dur * SR)
    T = int(dur * ctrl_rate) + 2
    tc = np.arange(T) / ctrl_rate
    target = np.full(T, np.nan)
    amp = np.zeros(T)
    vib_env = np.zeros(T)
    vowel_idx = np.full(T, -1, dtype=np.int64)
    onset_m = np.zeros(T)  # 1 at nasal onset, decays to 0
    notes = sorted(notes, key=lambda n: n[0])
    for k, (s, e, m, v, vel) in enumerate(notes):
        i0, i1 = int(s * ctrl_rate), min(T, int(e * ctrl_rate))
        if i1 <= i0:
            continue
        target[i0:i1] = m
        nxt = notes[k + 1][0] if k + 1 < len(notes) else 1e9
        legato_out = nxt - e < 0.04
        prv = notes[k - 1][1] if k > 0 else -1e9
        legato_in = s - prv < 0.04
        L = i1 - i0
        a = np.ones(L)
        na = int(attack * ctrl_rate)
        if not legato_in and na > 0:
            a[:na] = np.linspace(0, 1, min(na, L))[:L] if na <= L else np.linspace(0, 1, L)
        nr = int(release * ctrl_rate)
        if not legato_out and nr > 0:
            nr = min(nr, L)
            a[L - nr:] *= np.linspace(1, 0, nr) ** 1.5
        # gentle swell on long notes
        if e - s > 0.6:
            a *= 0.88 + 0.12 * np.sin(np.linspace(0, np.pi, L))
        amp[i0:i1] = np.maximum(amp[i0:i1], a * vel)
        vt = (np.arange(L) / ctrl_rate)
        vib_env[i0:i1] = np.clip((vt - 0.22) / 0.35, 0, 1)
        vv = v[-1]
        vowel_idx[i0:i1] = VOWEL_LIST.index(vv)
        if len(v) > 1 and v[0] in 'mnl':
            nm = min(L, int(0.075 * ctrl_rate))
            onset_m[i0:i0 + nm] = np.linspace(1, 0, nm) ** 0.7
    # fill pitch gaps with last value (so glides start from previous note)
    idx = np.where(~np.isnan(target), np.arange(T), 0)
    np.maximum.accumulate(idx, out=idx)
    target = target[idx]
    target[np.isnan(target)] = notes[0][2] if notes else 60
    # portamento (one-pole on midi)
    a_g = np.exp(-1 / (glide * ctrl_rate))
    pitch = signal.lfilter([1 - a_g], [1, -a_g], target, zi=[target[0] * a_g])[0]
    # onset scoop
    for (s, e, m, v, vel) in notes:
        i0 = int(s * ctrl_rate)
        n = min(T - i0, int(0.09 * ctrl_rate))
        if n > 0:
            pitch[i0:i0 + n] -= (scoop / 100) * np.linspace(1, 0, n) ** 2
    # vibrato + drift
    drift = signal.lfilter([0.002], [1, -0.998], R.standard_normal(T)) * 6
    vib = np.sin(2 * np.pi * vib_rate * tc + R.uniform(0, 6.28) + 0.3 * np.sin(2 * np.pi * 0.23 * tc)) * vib_depth * vib_env
    pitch = pitch + (vib + drift + detune_cents) / 100
    f0c = mtof(pitch)
    # formant tracks with smoothing between vowels
    vi = np.where(vowel_idx < 0, 0, vowel_idx)
    # carry last vowel into gaps
    vidx = np.where(vowel_idx >= 0, np.arange(T), 0)
    np.maximum.accumulate(vidx, out=vidx)
    vi = vi[vidx]
    F = np.zeros((5, T)); BW = np.zeros((5, T)); G = np.zeros((5, T))
    for j, vname in enumerate(VOWEL_LIST):
        mask = vi == j
        f, b, g = VOWELS[vname]
        F[:, mask] = np.array(f)[:, None] * formant_shift
        BW[:, mask] = np.array(b)[:, None]
        G[:, mask] = np.array(g)[:, None]
    fm, bm, gm = VOWELS['m']
    for arr, mv in ((F, fm), (BW, bm), (G, gm)):
        arr[:] = arr * (1 - onset_m) + np.array(mv)[:, None] * onset_m * (formant_shift if arr is F else 1)
    sm = int(0.06 * ctrl_rate)
    win = np.hanning(sm * 2 + 1); win /= win.sum()
    F = np.array([np.convolve(x, win, mode='same') for x in F])
    BW = np.array([np.convolve(x, win, mode='same') for x in BW])
    G = np.array([np.convolve(x, win, mode='same') for x in G])
    # soprano F1 tracking: raise F1 toward f0 when f0 is above it (keeps high notes full)
    F[0] = np.maximum(F[0], f0c * 1.05)
    # nasal onsets dull the tone
    amp_c = amp * (1 - 0.55 * onset_m)

    # ---- render, audio rate, only where there is sound ----
    out = np.zeros(N, dtype=np.float32)
    active = amp_c > 1e-4
    # segments of activity
    edges = np.diff(np.concatenate([[0], active.astype(np.int8), [0]]))
    starts, ends = np.where(edges == 1)[0], np.where(edges == -1)[0]
    phi0 = R.uniform(0, 6.28)
    for cs, ce in zip(starts, ends):
        cs = max(0, cs - 2); ce = min(T - 1, ce + 2)
        s0, s1 = int(cs * SR / ctrl_rate), min(N, int(ce * SR / ctrl_rate))
        if s1 - s0 < 16:
            continue
        ts = np.arange(s0, s1) / SR
        tcs = tc[cs:ce + 1]
        f0 = np.interp(ts, tcs, f0c[cs:ce + 1])
        phi = phi0 + 2 * np.pi * np.cumsum(f0) / SR
        K = int(kmax_hz / max(f0c[cs:ce + 1].min(), 80))
        K = max(4, min(K, 60))
        kk = np.arange(1, K + 1)[:, None]
        hf = kk * f0c[None, cs:ce + 1]
        env = _formant_env(hf, F[:, cs:ce + 1], BW[:, cs:ce + 1], G[:, cs:ce + 1])
        env *= kk ** (-tilt)
        env *= (hf < 10000)
        env *= amp_c[None, cs:ce + 1]
        seg = np.zeros(s1 - s0)
        # shimmer
        for k in range(K):
            a_k = np.interp(ts, tcs, env[k])
            if a_k.max() < 1e-5:
                continue
            seg += a_k * np.sin((k + 1) * phi + k * 0.7)
        out[s0:s1] += seg.astype(np.float32)
    # breath: formant-shaped noise via STFT
    if breath > 0:
        noise = R.standard_normal(N).astype(np.float32)
        fr, tt, Z = signal.stft(noise, SR, nperseg=1024, noverlap=768)
        ti = np.clip((tt * ctrl_rate).astype(int), 0, T - 1)
        ff = np.repeat(fr[:, None], len(ti), axis=1)
        envn = _formant_env(np.maximum(ff, 50), F[:, ti], BW[:, ti], G[:, ti]) * amp_c[ti][None, :]
        envn *= (0.4 + 0.6 * np.clip(ff / 4000, 0, 1.5))  # airy
        _, nb = signal.istft(Z * envn, SR, nperseg=1024, noverlap=768)
        nb = nb[:N]
        out[:len(nb)] += (nb * breath * 0.6).astype(np.float32)
    out *= 0.25
    if return_ctrl:
        return out, {'t': tc, 'amp': amp, 'vowel': vi, 'f0': f0c}
    return out


def choir_voice(notes, dur, seed=1, voices=3, spread=0.5, cents=9, **kw):
    """unison stack of sing() voices with detune/timing/vibrato variation -> stereo"""
    out = np.zeros((2, int(dur * SR)), dtype=np.float32)
    pans = np.linspace(-spread, spread, voices) if voices > 1 else [0]
    dets = np.linspace(-cents, cents, voices) if voices > 1 else [0]
    for i in range(voices):
        sh = 0.0 if i == voices // 2 else (0.011 * (i + 1))
        nn = [(s + sh, e + sh, m, v, vel) for (s, e, m, v, vel) in notes]
        x = sing(nn, dur, seed=seed * 31 + i, detune_cents=dets[i], vib_rate=5.0 + 0.35 * i, **kw)
        out += pan(x, pans[i]) / np.sqrt(voices)
    return out


# ------------------------------------------------------------------------------------------------
# instruments
def saw(f, n, phase=0.0):
    ph = (phase + np.cumsum(np.broadcast_to(f, (n,))) / SR) % 1.0
    return (2 * ph - 1).astype(np.float32)


def lowpass(x, fc, order=2):
    sos = signal.butter(order, fc, 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1).astype(np.float32)


def highpass(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1).astype(np.float32)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1).astype(np.float32)


def pad_chord(midis, dur, seed=1, cutoff=1600, attack=0.6, release=0.9, detune=0.11):
    R = rng(seed)
    n = int((dur + release) * SR)
    L = np.zeros(n, np.float32); Rr = np.zeros(n, np.float32)
    for m in midis:
        f = float(mtof(m))
        for k, d in enumerate((-detune, 0.0, detune)):
            ff = f * 2 ** (d / 12)
            s = saw(ff, n, R.uniform())
            if k != 1:
                (L if k == 0 else Rr)[:] += s * 0.9
                (Rr if k == 0 else L)[:] += s * 0.25
            else:
                L += s * 0.6; Rr += s * 0.6
    st = np.stack([L, Rr]) / (len(midis) * 2.2)
    st = lowpass(st, cutoff, 2)
    e = env_adsr(n, attack, 0.3, 0.85, release)
    # slow breathing filter feel
    tt = np.arange(n) / SR
    e *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * tt))
    return st * e


def fm_bell(f, dur=0.6, ratio=2.0, index=2.6, decay=0.32, seed=0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    ie = index * np.exp(-t / 0.12) + 0.25
    mod = np.sin(2 * np.pi * f * ratio * t) * ie
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / decay)
    x[:64] *= np.linspace(0, 1, 64)
    return x.astype(np.float32)


def sub_note(f, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)
    e = env_adsr(n, 0.01, 0.1, 0.8, min(0.12, dur * 0.4))
    return (x * e * 0.55).astype(np.float32)


def kick(seed=0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    f = 45 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t / 0.28)
    x[:220] += rng(seed).standard_normal(220) * np.linspace(0.5, 0, 220)
    return np.tanh(x * 1.4).astype(np.float32) * 0.9


def clap(seed=0):
    R = rng(seed)
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    e = np.zeros(n)
    for k, off in enumerate((0, 0.009, 0.019, 0.028)):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) / (0.007 if k < 3 else 0.11)) * (0.8 if k < 3 else 1)
    x = bandpass(R.standard_normal(n).astype(np.float32), 900, 3200) * e
    return (x * 0.9).astype(np.float32)


def hat(seed=0, open_=False):
    R = rng(seed)
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    x = highpass(R.standard_normal(n).astype(np.float32), 7500) * np.exp(-t / (0.08 if open_ else 0.014))
    return (x * 0.5).astype(np.float32)


def shaker(seed=0):
    R = rng(seed)
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    e = np.sin(np.pi * np.clip(t / 0.09, 0, 1)) ** 2
    return (bandpass(R.standard_normal(n).astype(np.float32), 4500, 11000) * e * 0.35).astype(np.float32)


def riser(dur=6.0, seed=0):
    R = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = R.standard_normal(n).astype(np.float32)
    # rising band via block filtering
    out = np.zeros(n, np.float32)
    B = 2048
    for i in range(0, n, B):
        u = i / n
        lo = 300 + 6000 * u ** 2
        seg = noise[max(0, i - 512):i + B]
        y = bandpass(seg, lo, min(lo * 2.2, 18000))
        out[i:i + B] = y[-min(B, n - i):] if len(y) >= min(B, n - i) else np.pad(y, (0, min(B, n - i) - len(y)))
    f = 200 * 2 ** (t / dur * 4)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    e = (t / dur) ** 2
    return ((out * 0.7 + tone) * e).astype(np.float32)


def boom(seed=0):
    n = int(3.0 * SR)
    t = np.arange(n) / SR
    f = 32 + 60 * np.exp(-t / 0.15)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    x += lowpass(rng(seed).standard_normal(n).astype(np.float32), 300) * np.exp(-t / 0.4) * 0.6
    return np.tanh(x * 1.5).astype(np.float32) * 0.8


def whale(dur=3.5, f0=160, seed=0):
    R = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = f0 * (1 + 1.4 * np.sin(np.pi * u) ** 1.5 + 0.06 * np.sin(2 * np.pi * 4 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph + 0.3) + 0.15 * np.sin(3 * ph)
    e = np.sin(np.pi * u) ** 0.8
    return (x * e * 0.4).astype(np.float32)


def crowd_cheer(dur=4.0, seed=0, pitch=1.0, voices=40, size=1.0):
    """stadium roar: shaped noise + many 'woo' glides"""
    R = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.clip(t / 0.35, 0, 1) * np.exp(-np.maximum(0, t - 1.0) / (1.4 * size))
    noise = R.standard_normal((2, n)).astype(np.float32)
    roar = bandpass(noise, 350 * pitch, 2600 * pitch) * env * 0.5
    out = roar
    for v in range(voices):
        st = R.uniform(0, 0.8)
        L = R.uniform(0.6, 1.6)
        i0 = int(st * SR); nn = min(int(L * SR), n - i0)
        if nn <= 0:
            continue
        tt = np.arange(nn) / SR
        f0 = R.uniform(260, 620) * pitch
        f = f0 * (1 + 0.35 * np.sin(np.pi * tt / L))
        ph = 2 * np.pi * np.cumsum(f) / SR
        x = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)) * np.sin(np.pi * tt / L) ** 2
        x = x.astype(np.float32) * 0.05
        p = R.uniform(-0.9, 0.9)
        out[:, i0:i0 + nn] += pan(x, p)
    return out


def rain(dur, seed=0):
    R = rng(seed)
    n = int(dur * SR)
    x = R.standard_normal((2, n)).astype(np.float32)
    x = bandpass(x, 500, 9000) * 0.18
    # droplets
    drops = np.zeros((2, n), np.float32)
    for _ in range(int(dur * 40)):
        i = R.integers(0, n - 800)
        c = R.integers(0, 2)
        tt = np.arange(800) / SR
        drops[c, i:i + 800] += np.sin(2 * np.pi * R.uniform(2000, 5000) * tt) * np.exp(-tt / 0.004) * R.uniform(0.02, 0.08)
    return x + drops


# ------------------------------------------------------------------------------------------------
# effects
def make_ir(dur=3.5, seed=0, damp=0.55, predelay=0.02):
    R = rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    ir = R.standard_normal((2, n)).astype(np.float32) * np.exp(-t / (dur / 6.5))
    # darker tail
    ir = np.stack([lowpass(ir[0], 9000 * (1 - damp) + 1500), lowpass(ir[1], 9000 * (1 - damp) + 1500)])
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((2, pd), np.float32), ir], axis=1)
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def reverb(x, ir, wet=0.3):
    if x.ndim == 1:
        x = np.stack([x, x])
    y = np.stack([signal.fftconvolve(x[0], ir[0])[: x.shape[1]], signal.fftconvolve(x[1], ir[1])[: x.shape[1]]]).astype(np.float32)
    return y * wet


def pingpong(x, delay, fb=0.4, n_taps=6, lp=4000):
    if x.ndim == 1:
        x = np.stack([x, x])
    d = int(delay * SR)
    out = np.zeros_like(x)
    src = lowpass(x.mean(axis=0), lp)
    g = 1.0
    for k in range(1, n_taps + 1):
        g *= fb
        ch = k % 2
        out[ch, k * d:] += src[: x.shape[1] - k * d] * g
    return out


def cheap_pa(x, drive=2.2):
    """small outdoor PA: band-limited, mono, a bit crunchy, slapback off a wall"""
    m = x.mean(axis=0) if x.ndim == 2 else x
    m = bandpass(m, 280, 3600, order=3)
    m = np.tanh(m * drive) / np.tanh(drive)
    slap = np.zeros_like(m); d = int(0.13 * SR); slap[d:] = m[:-d] * 0.32
    m = m + slap
    return np.stack([m * 0.95, m * 0.85]).astype(np.float32)


def tape_stop(x, t0, t1, resume=None):
    """slow the audio to a halt between t0 and t1 (s); silence from t1 until `resume` (or the end)"""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    n = i1 - i0
    rate = np.linspace(1, 0, n) ** 1.3
    pos = i0 + np.cumsum(rate)
    out = x.copy()
    for c in range(x.shape[0]):
        out[c, i0:i1] = np.interp(pos, np.arange(x.shape[1]), x[c])
        out[c, i1:(int(resume * SR) if resume else x.shape[1])] = 0
    fade = int(0.02 * SR)
    out[:, i1 - fade:i1] *= np.linspace(1, 0, fade)
    return out


def compress(x, thresh=0.3, ratio=3.0, att=0.005, rel=0.12):
    lvl = np.abs(x).max(axis=0)
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    # envelope follower via lfilter on rectified signal (approximate attack/release with release coeff)
    env = signal.lfilter([1 - a_r], [1, -a_r], lvl)
    gain = np.ones_like(env)
    over = env > thresh
    gain[over] = (thresh + (env[over] - thresh) / ratio) / env[over]
    return (x * gain[None, :]).astype(np.float32)


def duck_env(n, times, depth=0.6, rel=0.22):
    """sidechain-style gain curve dipping at each time"""
    g = np.ones(n, np.float32)
    L = int(rel * 3 * SR)
    shape = 1 - depth * np.exp(-np.arange(L) / (rel * SR))
    for t in times:
        i = int(t * SR)
        if i >= n:
            continue
        m = min(L, n - i)
        g[i:i + m] = np.minimum(g[i:i + m], shape[:m])
    return g
