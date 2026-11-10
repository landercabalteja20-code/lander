# Adapted from the What-If cartoon studio (branch claude/zealous-ramanujan-vyot46, studio/audio.py).
"""Voices (Kokoro TTS), lip-sync envelopes, an original synth music bed, SFX and the final mix.

Everything is generated here — no stock audio — so the result is royalty-free.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "assets/models/kokoro/model.onnx"
VOICES = ROOT / "assets/models/kokoro/voices.npz"

_kokoro = None


def _tts_engine():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        if not MODEL.exists():
            raise SystemExit("Voice model missing - run ./setup.sh first")
        _kokoro = Kokoro(str(MODEL), str(VOICES))
    return _kokoro


def _resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out:
        return x
    n = int(round(len(x) * sr_out / sr_in))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def _trim(x: np.ndarray, thr: float = 0.012, pad: float = 0.03) -> np.ndarray:
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p): min(len(x), idx[-1] + p)]


@dataclass
class Line:
    who: str
    text: str
    voice: str
    speed: float = 1.0
    pitch: float = 0.0        # semitones
    caption: str = ""         # on-screen text (defaults to `text`)
    engine: str = "kokoro"    # kokoro | chatterbox (expressive)
    emotion: float = 0.7      # chatterbox exaggeration
    pace: float = 0.4         # chatterbox cfg weight (lower = faster, looser)
    seed: int = 0
    bleed: bool = False       # line may run over the next shot (J-cut)
    audio: np.ndarray | None = None
    start: float = 0.0        # global seconds (set by the timeline)
    env: np.ndarray | None = None
    vis: np.ndarray | None = None

    @property
    def dur(self) -> float:
        return 0.0 if self.audio is None else len(self.audio) / SR


REF_TEXT = ("Oh my gosh, okay, you will not believe what just happened! I was literally walking down the street, "
            "and everyone was staring at me. Like... why? Okay, I'm fine. Totally fine. Love that for me.")
TTS_PY = ROOT / ".venv-tts/bin/python"


def _key(line: Line) -> str:
    parts = [line.text, line.voice, line.speed, line.pitch]
    if line.engine == "chatterbox":
        parts += ["cb", line.emotion, line.pace, line.seed]
    return hashlib.sha1(json.dumps(parts).encode()).hexdigest()[:16]


def _finish(a: np.ndarray, sr: int, line: Line) -> np.ndarray:
    a = _resample(np.asarray(a, dtype=np.float32), sr, SR)
    if abs(line.pitch) > 0.01:
        a = _pitch_shift(a, line.pitch)
    if abs(line.speed - 1.0) > 0.01 and line.engine == "chatterbox":
        a = _tempo(a, line.speed)
    a = _trim(a)
    rms = float(np.sqrt(np.mean(a ** 2)) + 1e-9)
    a = a * (0.1 / rms)
    peak = float(np.max(np.abs(a)) + 1e-9)
    if peak > 0.89:
        a = a * (0.89 / peak)
    return a


def _tempo(a: np.ndarray, speed: float) -> np.ndarray:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-af", f"rubberband=tempo={speed:.4f}:formant=preserved", "-f", "f32le", "-"],
        input=a.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def ref_clip(voice: str, cache: Path) -> Path:
    """Short clean reference clip (Kokoro) that Chatterbox clones the character's timbre from."""
    d = cache / "refs"
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{voice}.wav"
    if not p.exists():
        a, sr = _tts_engine().create(REF_TEXT, voice=voice, speed=1.0, lang="en-gb" if voice.startswith("b") else "en-us")
        sf.write(p, a, sr)
    return p


def synth_lines(lines: list[Line], cache: Path) -> None:
    """Synthesize every line (cached). Chatterbox lines are batched into one worker process."""
    cache.mkdir(parents=True, exist_ok=True)
    todo = []
    for ln in lines:
        p = cache / f"{_key(ln)}.wav"
        if p.exists():
            ln.audio = sf.read(p, dtype="float32")[0].astype(np.float32)
        elif ln.engine == "chatterbox":
            todo.append((ln, p))
        else:
            synth_line(ln, cache)
    if not todo:
        return
    if not TTS_PY.exists():
        print("  WARNING: .venv-tts missing (run ./setup.sh) - using Kokoro voices instead of expressive ones")
        for ln, p in todo:
            ln.engine = "kokoro"
            synth_line(ln, cache)
        return
    raw = cache / "raw"
    raw.mkdir(exist_ok=True)
    items = [{"text": ln.text, "ref": str(ref_clip(ln.voice, cache)), "out": str(raw / p.name), "emotion": ln.emotion,
              "pace": ln.pace, "seed": ln.seed} for ln, p in todo]
    job = cache / "job.json"
    job.write_text(json.dumps({"items": items, "threads": os.cpu_count() or 4}))
    print(f"  expressive voices: {len(items)} lines (Chatterbox, CPU)...", flush=True)
    subprocess.run([str(TTS_PY), str(Path(__file__).with_name("tts_chatterbox.py")), str(job)], check=True,
                   env={**os.environ, "TQDM_DISABLE": "1", "PYTHONWARNINGS": "ignore"})
    for ln, p in todo:
        a, sr = sf.read(raw / p.name, dtype="float32")
        if a.ndim > 1:
            a = a.mean(axis=1)
        a = _finish(a, sr, ln)
        sf.write(p, a, SR)
        ln.audio = a


def synth_line(line: Line, cache: Path) -> None:
    """Generate (or load cached) speech for one line, 48 kHz mono float32."""
    cache.mkdir(parents=True, exist_ok=True)
    p = cache / f"{_key(line)}.wav"
    if p.exists():
        a, _ = sf.read(p, dtype="float32")
    else:
        k = _tts_engine()
        a, sr = k.create(line.text, voice=line.voice, speed=line.speed, lang="en-gb" if line.voice.startswith("b") else "en-us")
        a = _resample(np.asarray(a, dtype=np.float32), sr, SR)
        if abs(line.pitch) > 0.01:
            a = _pitch_shift(a, line.pitch)
        a = _trim(a)
        rms = float(np.sqrt(np.mean(a ** 2)) + 1e-9)
        a = a * (0.1 / rms)                       # loudness match across voices
        peak = float(np.max(np.abs(a)) + 1e-9)
        if peak > 0.89:
            a = a * (0.89 / peak)
        sf.write(p, a, SR)
    line.audio = a.astype(np.float32)


def _pitch_shift(a: np.ndarray, semis: float) -> np.ndarray:
    """Formant-preserving pitch shift through ffmpeg's rubberband filter."""
    ratio = 2 ** (semis / 12)
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
         "-af", f"rubberband=pitch={ratio:.5f}:formant=preserved", "-f", "f32le", "-"],
        input=a.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def mouth_envelope(a: np.ndarray, fps: int) -> tuple[np.ndarray, np.ndarray]:
    """Per-frame mouth openness (0..1) and viseme shape (-1 round .. +1 wide) from audio."""
    hop = SR // fps
    n = int(np.ceil(len(a) / hop))
    env = np.zeros(n, np.float32)
    vis = np.zeros(n, np.float32)
    win = np.hanning(hop * 2).astype(np.float32)
    freqs = np.fft.rfftfreq(hop * 2, 1 / SR)
    for i in range(n):
        seg = a[i * hop: i * hop + hop * 2]
        if len(seg) < hop * 2:
            seg = np.pad(seg, (0, hop * 2 - len(seg)))
        env[i] = np.sqrt(np.mean(seg ** 2))
        spec = np.abs(np.fft.rfft(seg * win))
        band = (freqs > 200) & (freqs < 4000)
        cen = float((spec[band] * freqs[band]).sum() / (spec[band].sum() + 1e-9))
        vis[i] = np.clip((cen - 1300) / 900, -1, 1)
    ref = np.percentile(env, 92) + 1e-6
    env = np.clip(env / ref, 0, 1.2)
    env = np.where(env < 0.12, 0, env)
    # attack fast, release slower -> snappier mouth
    out = np.zeros_like(env)
    v = 0.0
    for i, e in enumerate(env):
        v = e if e > v else v * 0.55 + e * 0.45
        out[i] = v
    return np.clip(out, 0, 1), vis


# ======================================================================== synthesis helpers
def _t(dur: float) -> np.ndarray:
    return np.arange(int(dur * SR), dtype=np.float32) / SR


def _midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def _adsr(n: int, a: float = 0.005, d: float = 0.1, s: float = 0.6, r: float = 0.1) -> np.ndarray:
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S = max(0, n - A - D - R)
    env = np.concatenate([np.linspace(0, 1, A, endpoint=False), np.linspace(1, s, D, endpoint=False),
                          np.full(S, s), np.linspace(s, 0, R)]) if n > 0 else np.zeros(0)
    return np.pad(env, (0, max(0, n - len(env))))[:n].astype(np.float32)


def _place(track: np.ndarray, sig: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    i = int(at * SR)
    if i >= track.shape[0] or i + len(sig) <= 0:
        return
    j = min(track.shape[0], i + len(sig))
    s = sig[: j - i] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    track[i:j, 0] += s * l * 1.414
    track[i:j, 1] += s * r * 1.414


def _lowpass(x: np.ndarray, k: int) -> np.ndarray:
    if k <= 1:
        return x
    ker = np.hanning(k).astype(np.float32)
    ker /= ker.sum()
    return np.convolve(x, ker, mode="same").astype(np.float32)


def _reverb(x: np.ndarray, secs: float = 1.2, mix: float = 0.25, seed: int = 3) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-np.linspace(0, 7, n)).astype(np.float32)
    ir = _lowpass(ir, 9)
    ir /= np.sqrt((ir ** 2).sum()) + 1e-9
    out = np.empty_like(x)
    L = x.shape[0] + n
    nfft = 1 << (L - 1).bit_length()
    IR = np.fft.rfft(ir, nfft)
    for c in range(x.shape[1]):
        wet = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * IR, nfft)[: x.shape[0]]
        out[:, c] = x[:, c] * (1 - mix) + wet.astype(np.float32) * mix * 0.6
    return out


def _pluck(freq: float, dur: float = 0.5, bright: float = 1.0) -> np.ndarray:
    t = _t(dur)
    sig = (np.sin(2 * np.pi * freq * t) + 0.45 * bright * np.sin(4 * np.pi * freq * t) * np.exp(-t * 18)
           + 0.2 * bright * np.sin(6 * np.pi * freq * t) * np.exp(-t * 30))
    return (sig * np.exp(-t * 7) * _adsr(len(t), 0.003, 0.05, 1.0, 0.05)).astype(np.float32)


def _bell(freq: float, dur: float = 1.2) -> np.ndarray:
    t = _t(dur)
    parts = [(1, 1.0, 3.0), (2.76, 0.45, 5.0), (5.4, 0.25, 8.0), (8.93, 0.12, 12.0)]
    sig = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * d) for m, a, d in parts)
    return (sig * _adsr(len(t), 0.002, 0.02, 1.0, 0.05)).astype(np.float32)


def _pad(freqs: list[float], dur: float) -> np.ndarray:
    t = _t(dur)
    sig = np.zeros_like(t)
    for fr in freqs:
        for det in (-0.004, 0.004):
            for k in range(1, 6):
                sig += np.sin(2 * np.pi * fr * (1 + det) * k * t + k) / (k ** 1.6)
    return (sig * _adsr(len(t), 0.25, 0.2, 0.8, 0.35) / (len(freqs) * 2)).astype(np.float32)


def _kick() -> np.ndarray:
    t = _t(0.35)
    f = 48 + 110 * np.exp(-t * 40)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 9) + 0.15 * np.sin(ph * 2) * np.exp(-t * 30)).astype(np.float32)


def _clap(rng) -> np.ndarray:
    t = _t(0.22)
    n = np.diff(rng.standard_normal(len(t) + 1)).astype(np.float32)
    env = np.exp(-t * 22) + 0.6 * np.exp(-((t - 0.012) * 300) ** 2) + 0.4 * np.exp(-((t - 0.024) * 300) ** 2)
    return (_lowpass(n, 3) * env * 0.5).astype(np.float32)


def _hat(rng, open_: bool = False) -> np.ndarray:
    t = _t(0.12 if open_ else 0.04)
    n = np.diff(np.diff(rng.standard_normal(len(t) + 2))).astype(np.float32)
    return (n * np.exp(-t * (25 if open_ else 90)) * 0.25).astype(np.float32)


CHORDS = [  # F maj7 - G6 - E m7 - A m7  (bubbly Y2K pop progression)
    ([53, 57, 60, 64], 41), ([55, 59, 62, 64], 43), ([52, 55, 59, 62], 40), ([57, 60, 64, 67], 45)]
PENTA = [72, 74, 76, 79, 81, 84, 86, 88]


def music_bed(duration: float, bpm: float = 112, seed: int = 7, intensity: float = 1.0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    beat = 60.0 / bpm
    bar = beat * 4
    n = int((duration + 2) * SR)
    drums = np.zeros((n, 2), np.float32)
    keys = np.zeros((n, 2), np.float32)
    bass = np.zeros((n, 2), np.float32)
    kick = _kick()
    nbars = int(duration / bar) + 2
    for b in range(nbars):
        chord, root = CHORDS[b % 4]
        t0 = b * bar
        _place(keys, _pad([_midi(x) for x in chord], bar + 0.3), t0, 0.07)
        for e in range(8):  # pluck arpeggio, 8ths
            note = chord[(e * 2 + (b % 2)) % 4] + 12
            _place(keys, _pluck(_midi(note), 0.45), t0 + e * beat / 2, 0.1, pan=-0.35 if e % 2 else 0.35)
        for e in range(8):  # bass 8ths, root/octave bounce
            note = root + (12 if e in (3, 7) else 0)
            sig = _pluck(_midi(note), 0.3, bright=0.4)
            _place(bass, np.tanh(sig * 1.6), t0 + e * beat / 2, 0.16)
        for q in range(4):
            if q in (0, 2):
                _place(drums, kick, t0 + q * beat, 0.42)
            if q in (1, 3):
                _place(drums, _clap(rng), t0 + q * beat, 0.13)
            if q == 2 and b % 2 == 1:
                _place(drums, kick, t0 + q * beat + beat / 2, 0.28)
        for s in range(16):
            _place(drums, _hat(rng, open_=(s % 8 == 6)), t0 + s * beat / 4, 0.022 if s % 2 else 0.012,
                   pan=0.2 if s % 2 else -0.2)
        if b % 2 == 1:  # little bell melody every other bar
            for k in range(3):
                _place(keys, _bell(_midi(PENTA[rng.integers(len(PENTA))]), 0.8), t0 + (k * 1.5 + 0.5) * beat, 0.03,
                       pan=rng.uniform(-0.6, 0.6))
    mix = drums * 0.9 * intensity + _reverb(keys, 1.4, 0.3) + bass
    # gentle intro fade
    fade = np.clip(np.arange(n) / (SR * 0.6), 0, 1)[:, None]
    return (mix * fade)[: int(duration * SR)].astype(np.float32)


STYLES = {
    # name: bpm, chords [(notes, root)], drum kit, arp notes per beat, pluck decay, gains (pad, arp, bass, drums)
    "pop": dict(bpm=112, chords=CHORDS, drums="pop", arp=2, decay=0.45, gains=(0.07, 0.1, 0.16, 0.9)),
    "comedy": dict(bpm=128, chords=[([60, 64, 67, 72], 48), ([57, 61, 64, 67], 45), ([62, 65, 69, 74], 50),
                                    ([55, 59, 62, 65], 43)], drums="comedy", arp=2, decay=0.18,
                   gains=(0.03, 0.13, 0.2, 0.8)),
    "sad": dict(bpm=72, chords=[([57, 60, 64, 69], 45), ([53, 57, 60, 65], 41), ([48, 52, 55, 60], 48),
                                ([55, 59, 62, 67], 43)], drums=None, arp=1, decay=1.4, gains=(0.09, 0.11, 0.09, 0.0)),
    "warm": dict(bpm=96, chords=[([60, 64, 67, 72], 48), ([55, 59, 62, 67], 43), ([57, 60, 64, 69], 45),
                                 ([53, 57, 60, 65], 41)], drums="soft", arp=2, decay=0.7, gains=(0.08, 0.1, 0.14, 0.6)),
    "party": dict(bpm=124, chords=[([57, 60, 64, 69], 45), ([53, 57, 60, 65], 41), ([60, 64, 67, 72], 48),
                                   ([55, 59, 62, 67], 43)], drums="house", arp=4, decay=0.22, gains=(0.06, 0.08, 0.2, 1.0)),
}


def _groove(duration: float, style: str, seed: int = 7) -> np.ndarray:
    cfg = STYLES[style]
    if style == "pop":
        return music_bed(duration, cfg["bpm"], seed)
    rng = np.random.default_rng(seed)
    beat = 60.0 / cfg["bpm"]
    bar = beat * 4
    n = int((duration + 2) * SR)
    pad_g, arp_g, bass_g, dr_g = cfg["gains"]
    keys = np.zeros((n, 2), np.float32)
    bass = np.zeros((n, 2), np.float32)
    drums = np.zeros((n, 2), np.float32)
    kick = _kick()
    for b in range(int(duration / bar) + 2):
        chord, root = cfg["chords"][b % 4]
        t0 = b * bar
        _place(keys, _pad([_midi(x) for x in chord], bar + 0.4), t0, pad_g)
        steps = 4 * cfg["arp"]
        for e in range(steps):
            note = chord[(e + (b % 2)) % 4] + (12 if style != "sad" else 0)
            if style == "comedy" and e % 2 == 0:
                continue  # offbeat staccato
            sig = _pluck(_midi(note), cfg["decay"] + 0.05, bright=1.0 if style != "sad" else 0.6)
            sig = sig * np.exp(-np.arange(len(sig)) / SR / cfg["decay"]).astype(np.float32)
            _place(keys, sig, t0 + e * beat / cfg["arp"], arp_g, pan=-0.3 if e % 2 else 0.3)
        if style == "sad":
            _place(bass, _pluck(_midi(root), 2.0, bright=0.2), t0, bass_g)
        elif style == "comedy":
            for q in (0, 2):
                _place(bass, np.tanh(_pluck(_midi(root - (0 if q == 0 else 5)), 0.3, 0.3) * 1.5), t0 + q * beat, bass_g)
        elif style == "party":
            for e in range(8):
                if e % 2 == 1:
                    _place(bass, np.tanh(_pluck(_midi(root), 0.25, 0.5) * 2), t0 + e * beat / 2, bass_g)
        else:
            for e in range(4):
                _place(bass, np.tanh(_pluck(_midi(root + (12 if e == 3 else 0)), 0.5, 0.4) * 1.4), t0 + e * beat, bass_g)
        kit = cfg["drums"]
        for q in range(4):
            if kit == "house":
                _place(drums, kick, t0 + q * beat, 0.45)
                if q in (1, 3):
                    _place(drums, _clap(rng), t0 + q * beat, 0.14)
                _place(drums, _hat(rng, open_=True), t0 + q * beat + beat / 2, 0.035)
            elif kit == "comedy":
                if q in (0, 2):
                    _place(drums, kick, t0 + q * beat, 0.3)
                blk = _bell(_midi(96 if q % 2 else 91), 0.08) * 0.5
                _place(drums, blk, t0 + q * beat + beat / 2, 0.12)
            elif kit == "soft":
                if q == 0 or (q == 2 and b % 2):
                    _place(drums, kick, t0 + q * beat, 0.3)
                for s_ in range(2):
                    _place(drums, _hat(rng), t0 + q * beat + s_ * beat / 2, 0.012)
        if style in ("warm", "party") and b % 2 == 1:
            for k in range(3):
                _place(keys, _bell(_midi(PENTA[rng.integers(len(PENTA))]), 0.8), t0 + (k * 1.5 + 0.5) * beat, 0.03)
    mix = _reverb(keys, 1.6 if style == "sad" else 1.2, 0.35 if style == "sad" else 0.28) + bass + drums * dr_g
    return mix[: int(duration * SR)].astype(np.float32)


def score(duration: float, sections: list[dict], seed: int = 7) -> np.ndarray:
    """Concatenate styled sections with 1 s crossfades."""
    n = int(duration * SR)
    out = np.zeros((n, 2), np.float32)
    xf = int(1.0 * SR)
    secs = sorted(sections, key=lambda d: d["at"])
    for i, sec in enumerate(secs):
        a = float(sec["at"])
        b = float(secs[i + 1]["at"]) if i + 1 < len(secs) else duration
        seg = _groove(b - a + 1.2, sec["style"], seed + i) * float(sec.get("gain", 1.0))
        i0 = int(a * SR)
        L = min(len(seg), n - i0)
        if L <= 0:
            continue
        env = np.ones(L, np.float32)
        if i > 0:
            env[:xf] = np.linspace(0, 1, min(xf, L))[:min(xf, L)] if L >= xf else np.linspace(0, 1, L)
        tail = int((b - a) * SR)
        if i + 1 < len(secs) and tail < L:
            fade_len = L - tail
            env[tail:] = np.linspace(1, 0, fade_len)
        out[i0:i0 + L] += seg[:L] * env[:, None]
    return out


# ======================================================================== sfx
def sfx(name: str, seed: int = 0) -> np.ndarray:
    sig = _sfx_raw(name, seed)
    return (sig * (0.7 / (float(np.max(np.abs(sig))) + 1e-9))).astype(np.float32)


def _sfx_raw(name: str, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed + sum(map(ord, name)))
    if name == "ding":
        return _bell(_midi(91), 1.6) * 0.6 + _bell(_midi(84), 1.6) * 0.3
    if name in ("sparkle", "magic"):
        out = np.zeros(int(1.3 * SR), np.float32)
        for k in range(9):
            sig = _bell(_midi(PENTA[rng.integers(len(PENTA))] + 12), 0.6) * 0.28
            i = int(k * 0.06 * SR)
            out[i:i + len(sig)] += sig[: len(out) - i]
        t = _t(1.3)
        shimmer = np.diff(rng.standard_normal(len(t) + 1)).astype(np.float32) * 0.05
        out += shimmer * np.sin(np.pi * np.clip(t / 1.3, 0, 1)) ** 2
        return out
    if name == "whoosh":
        t = _t(0.45)
        noise = rng.standard_normal(len(t)).astype(np.float32)
        env = np.sin(np.pi * t / 0.45) ** 2
        lo = _lowpass(noise, 24)
        hi = noise - _lowpass(noise, 6)
        mixk = np.clip(t / 0.45, 0, 1)
        return ((lo * (1 - mixk) * 2.5 + hi * mixk * 0.6) * env * 0.5).astype(np.float32)
    if name == "buzz":
        out = []
        for _ in range(2):
            t = _t(0.24)
            sig = np.tanh(3 * np.sin(2 * np.pi * 168 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 28 * t))
            out += [sig * _adsr(len(t), 0.01, 0.02, 1, 0.03) * 0.35, np.zeros(int(0.12 * SR))]
        return np.concatenate(out).astype(np.float32)
    if name == "pop":
        t = _t(0.12)
        f = 420 + 700 * np.exp(-t * 60)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 35) * 0.5).astype(np.float32)
    if name == "scratch":
        t = _t(0.42)
        f = 900 * np.exp(-t * 6) + 120
        car = np.sin(2 * np.pi * np.cumsum(f) / SR)
        noise = rng.standard_normal(len(t)).astype(np.float32)
        return ((car * 0.6 + _lowpass(noise, 4) * 0.5) * np.exp(-t * 4) * 0.45).astype(np.float32)
    if name == "boing":
        t = _t(0.6)
        f = 260 + 140 * np.sin(2 * np.pi * 9 * t) * np.exp(-t * 4) + 80 * np.exp(-t * 8)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) * 0.45).astype(np.float32)
    if name == "notify":
        a = _bell(_midi(88), 0.35) * 0.4
        b = _bell(_midi(93), 0.6) * 0.4
        out = np.zeros(int(0.8 * SR), np.float32)
        out[: len(a)] += a
        out[int(0.11 * SR): int(0.11 * SR) + len(b)] += b[: len(out) - int(0.11 * SR)]
        return out
    if name == "tada":
        out = np.zeros(int(1.8 * SR), np.float32)
        for k, nn in enumerate([72, 76, 79, 84]):
            sig = _bell(_midi(nn), 1.2) * 0.3
            i = int(k * 0.09 * SR)
            out[i:i + len(sig)] += sig[: len(out) - i]
        return out
    if name == "dun":  # dramatic sting
        t = _t(1.2)
        sig = sum(np.sin(2 * np.pi * _midi(n) * t) / (i + 1) for i, n in enumerate([38, 45, 50, 57]))
        return (np.tanh(sig * 1.5) * np.exp(-t * 2.2) * 0.45).astype(np.float32)
    if name == "deflate":
        t = _t(0.9)
        f = 950 * np.exp(-t * 2.0) + 160 + 25 * np.sin(2 * np.pi * 7 * t)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.minimum(1, t * 30) * np.exp(-t * 1.4) * 0.45).astype(np.float32)
    if name == "slide_up":
        t = _t(0.5)
        f = 300 + 1100 * (t / 0.5) ** 1.5
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.5) * 0.4).astype(np.float32)
    if name == "squeak":
        t = _t(0.14)
        f = 1700 + 900 * t / 0.14
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.14) * 0.4).astype(np.float32)
    if name == "gulp":
        t = _t(0.25)
        f = 300 - 220 * t / 0.25
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / 0.25) * 0.4).astype(np.float32)
    raise ValueError(f"unknown sfx {name}")


# ======================================================================== mix
def mixdown(total: float, lines: list[Line], cues: list[tuple[float, str, float]], music: dict | None,
            out_wav: Path) -> None:
    n = int((total + 0.5) * SR)
    voice = np.zeros((n, 2), np.float32)
    for ln in lines:
        _place(voice, ln.audio, ln.start, 1.0)
    fx = np.zeros((n, 2), np.float32)
    for at, name, gain in cues:
        _place(fx, sfx(name), at, gain)
    mix = voice + fx
    if music:
        if music.get("sections"):
            bed = score(total + 0.5, music["sections"], seed=music.get("seed", 7))[:n]
        else:
            bed = music_bed(total + 0.5, bpm=music.get("bpm", 112), seed=music.get("seed", 7),
                            intensity=music.get("intensity", 1.0))[:n]
        if len(bed) < n:
            bed = np.pad(bed, ((0, n - len(bed)), (0, 0)))
        # duck under dialogue
        v = np.abs(voice[:, 0])
        k = int(0.25 * SR)
        env = np.convolve(v, np.ones(k, np.float32) / k, mode="same")
        duck = 1 - 0.55 * np.clip(env / 0.03, 0, 1)
        vol = music.get("volume", 0.35)
        fade_out = np.clip((total + 0.5 - np.arange(n) / SR) / 1.2, 0, 1)
        mix += bed * (vol * duck * fade_out)[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    peak = float(np.max(np.abs(mix)) + 1e-9)
    mix = mix * min(1.0, 0.95 / peak)
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    sf.write(out_wav, mix, SR, subtype="PCM_16")
