"""Audio + timing build for "What if a Gen Z time-traveled to the Philippines in 1850?"

  1. Kokoro TTS, one clip per line, per-character voice (EN narrator + Gen Z, ES/TL locals)
  2. faster-whisper word timestamps, aligned back onto the script text
  3. original score (Karplus-Strong rondalla / habanera, lo-fi intro, tension, night...) + SFX
  4. ffmpeg: duck music under dialogue, loudness-normalise -> public/genz/mix.mp3
  5. src/genz/timeline.json

Run: .venv/bin/python tools/genz/build_audio.py
"""
from __future__ import annotations

import difflib
import json
import re
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src/genz/script.json"
TIMELINE = ROOT / "src/genz/timeline.json"
WORK = ROOT / "tools/genz/.work"
OUT_MP3 = ROOT / "public/genz/mix.mp3"
SR = 48000
RNG = np.random.default_rng(1850)

WHISPER_LANG = {"narrator": "en", "migo": "en", "officer": "es", "friar": "es", "lola": "tl", "vendor": "tl", "kid": "tl"}


# =============================================================== helpers
def t_axis(n):
    return np.arange(n) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, clip, at_s, gain=1.0):
    i = int(at_s * SR)
    if i >= len(buf) or i + len(clip) <= 0:
        return
    if i < 0:
        clip, i = clip[-i:], 0
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i] * gain


def env(n, a=0.01, r=0.1):
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, "low", fs=SR, output="sos"), x)


def hp(x, f, o=2):
    return signal.sosfilt(signal.butter(o, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, o=2):
    return signal.sosfilt(signal.butter(o, [lo, hi], "band", fs=SR, output="sos"), x)


def noise(n):
    return RNG.standard_normal(n)


# =============================================================== 1. TTS
def tts(script):
    from kokoro_onnx import Kokoro

    k = Kokoro(str(ROOT / ".models/kokoro-v1.0.onnx"), str(ROOT / ".models/voices-v1.0.bin"))
    clips = []
    for i, ln in enumerate(script["lines"]):
        v = script["voices"][ln["speaker"]]
        say = ln["text"]
        if v["lang"].startswith("en"):  # respell Filipino words for the English voices
            for word, spoken in script.get("pron", {}).items():
                say = re.sub(rf"\b{word}\b", spoken, say)
        s, sr = k.create(say, voice=v["voice"], speed=v["speed"], lang=v["lang"])
        pitch = v.get("pitch", 1.0)
        # pitch up by resampling (also shortens a little: fine for a kid / higher voice)
        s = signal.resample_poly(s, SR, int(sr * pitch)).astype(np.float32)
        idx = np.where(np.abs(s) > 0.01)[0]
        pad = int(0.03 * SR)
        s = s[max(0, idx[0] - pad) : idx[-1] + pad]
        s = s / max(1e-6, np.abs(s).max()) * 0.9
        sf.write(WORK / f"line_{i:02d}.wav", s, SR)
        clips.append(s)
        print(f"  {i:02d} {ln['speaker']:8s} {len(s) / SR:5.2f}s  {ln['text'][:60]}")
    return clips


# =============================================================== 2. word timing
def _norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def align(text, heard):
    heard = [w for w in heard if _norm(w["text"])]
    words = text.split()
    a = [_norm(w) for w in words]
    b = [_norm(w["text"]) for w in heard]
    timed = [None] * len(words)
    if heard:
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
            if op == "equal":
                for k in range(i2 - i1):
                    timed[i1 + k] = dict(heard[j1 + k])
            elif op == "replace":
                s, e = heard[j1]["startMs"], heard[j2 - 1]["endMs"]
                lens = [max(1, len(a[i])) for i in range(i1, i2)]
                acc = s
                for k, i in enumerate(range(i1, i2)):
                    d = (e - s) * lens[k] / sum(lens)
                    timed[i] = {"startMs": round(acc), "endMs": round(acc + d)}
                    acc += d
    first = heard[0]["startMs"] if heard else 0
    for i, w in enumerate(timed):
        if w is None:
            prev = next((timed[k]["endMs"] for k in range(i - 1, -1, -1) if timed[k]), first)
            nxt = next((timed[k]["startMs"] for k in range(i + 1, len(timed)) if timed[k]), prev + 250)
            timed[i] = {"startMs": prev, "endMs": max(prev + 1, nxt)}
    return [{"text": w, "startMs": t["startMs"], "endMs": t["endMs"]} for w, t in zip(words, timed)]


def word_times(i, speaker, offset_ms, model):
    segs, _ = model.transcribe(
        str(WORK / f"line_{i:02d}.wav"), word_timestamps=True, language=WHISPER_LANG[speaker],
        initial_prompt="Binondo, Manila, tsokolate, batirol, bibingka, cuadrilleros, Clavería, polo y servicio, falla, pandesal, Rizal, Lola, Taglish.",
    )
    out = []
    for s in segs:
        for w in s.words:
            out.append({"text": w.word, "startMs": round(offset_ms + w.start * 1000), "endMs": round(offset_ms + w.end * 1000)})
    return out


# =============================================================== 3. instruments
def ks(freq, dur, bright=0.6, decay=0.996, gain=0.3):
    """Karplus-Strong plucked string."""
    n = int(dur * SR)
    N = max(2, int(SR / freq))
    exc = noise(N)
    exc = lp(exc, 800 + bright * 9000) if bright < 1 else exc
    x = np.zeros(n)
    x[: min(N, n)] = exc[: min(N, n)]
    a = np.zeros(N + 2)
    a[0] = 1
    a[N] = -decay * 0.5
    a[N + 1] = -decay * 0.5
    y = signal.lfilter([1.0], a, x)
    y *= env(n, 0.001, min(0.05, dur * 0.3))
    return y / (np.abs(y).max() + 1e-9) * gain


def tremolo(m, dur, rate=13, gain=0.16, bright=0.85):
    out = np.zeros(int(dur * SR) + SR // 2)
    t = 0.0
    k = 0
    while t < dur:
        g = gain * (0.8 + 0.2 * ((k % 2) == 0))
        place(out, ks(hz(m), 0.25, bright, 0.994, g), t)
        t += 1 / rate
        k += 1
    return out


def strum(midis, dur, gain=0.12, bright=0.45, spread=0.018):
    out = np.zeros(int((dur + 0.3) * SR))
    for i, m in enumerate(midis):
        place(out, ks(hz(m), dur + 0.2, bright, 0.997, gain), i * spread)
    return out


def epiano(midis, dur, gain=0.07):
    n = int(dur * SR)
    t = t_axis(n)
    out = np.zeros(n)
    for m in midis:
        f = hz(m)
        mod = np.sin(2 * np.pi * f * 2 * t) * 1.2 * np.exp(-t * 3)
        out += np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.2)
    return lp(out, 2500) * env(n, 0.005, 0.3) * gain / len(midis)


def pad(midis, dur, gain=0.06):
    n = int(dur * SR)
    t = t_axis(n)
    out = np.zeros(n)
    for m in midis:
        for d in (-0.08, 0.08):
            f = hz(m) * 2 ** (d / 12)
            out += np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    return lp(out, 1500) * env(n, 0.6, 0.8) * gain / len(midis)


def kick(g=0.5):
    n = int(0.35 * SR)
    t = t_axis(n)
    f = 48 + 110 * np.exp(-t * 32)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 8) * g


def snare(g=0.25):
    n = int(0.25 * SR)
    t = t_axis(n)
    return (bp(noise(n), 1200, 7000) * 0.7 + np.sin(2 * np.pi * 190 * t) * 0.5) * np.exp(-t * 18) * g


def hat(g=0.06):
    n = int(0.06 * SR)
    return hp(noise(n), 7000) * np.exp(-t_axis(n) * 70) * g


def timpani(m=38, g=0.5):
    n = int(1.6 * SR)
    t = t_axis(n)
    f = hz(m) * (1 + 0.04 * np.exp(-t * 10))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * lp(noise(n), 200) * np.exp(-t * 20)) * np.exp(-t * 2.2) * g


def taiko(g=0.6):
    n = int(0.7 * SR)
    t = t_axis(n)
    f = 70 + 60 * np.exp(-t * 20)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * lp(noise(n), 600) * np.exp(-t * 30)) * np.exp(-t * 6) * g


def bell(m=60, g=0.3, dur=4.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = hz(m)
    out = np.zeros(n)
    for ratio, amp, dec in ((0.5, 0.6, 0.8), (1, 1, 1.0), (1.19, 0.5, 1.6), (1.56, 0.4, 2.0), (2.0, 0.35, 2.4), (2.74, 0.2, 3.5), (3.0, 0.15, 4)):
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return out * env(n, 0.002, 0.5) * g


# =============================================================== 3b. score sections
CH = {  # chord -> midi (mid register)
    "D": [50, 57, 62, 66], "A7": [45, 52, 61, 67], "G": [43, 55, 59, 62], "Bm": [47, 54, 59, 62],
    "Em": [40, 52, 55, 59], "C": [48, 55, 60, 64], "B7": [47, 51, 57, 63], "F#": [42, 54, 58, 61],
    "Fmaj7": [53, 57, 60, 64], "Em7": [52, 55, 59, 62], "Dm7": [50, 53, 57, 60], "Cmaj7": [48, 52, 55, 59],
}
HAB_PROG = ["D", "A7", "A7", "D", "G", "D", "A7", "D"]
HAB_MEL = [  # (midi, beats) per bar, 2/4
    [(69, .75), (66, .25), (69, .5), (74, .5)], [(73, .75), (71, .25), (69, .5), (67, .5)],
    [(64, .75), (67, .25), (73, .5), (76, .5)], [(74, 1.5), (69, .5)],
    [(71, .75), (74, .25), (79, .5), (78, .5)], [(78, .75), (76, .25), (74, .5), (69, .5)],
    [(67, .5), (71, .5), (76, .5), (73, .5)], [(74, 1.5), (None, .5)],
]


def habanera(buf, s, e, bpm=100, melody=True, gain=1.0, prog=HAB_PROG, mel=HAB_MEL, transpose=0):
    beat = 60 / bpm
    bar = 2 * beat
    t = s
    k = 0
    while t < e - 0.05:
        ch = [m + transpose for m in CH[prog[k % len(prog)]]]
        root, fifth = ch[0] - 12, ch[1] - 12
        for off, m in ((0, root), (0.75, root + 7), (1.0, fifth), (1.5, root + 7)):
            if t + off * beat < e:
                place(buf, ks(hz(m), 0.6, 0.35, 0.995, 0.22 * gain), t + off * beat)
        for off in (0.5, 1.0, 1.5):
            if t + off * beat < e:
                place(buf, strum(ch[1:], 0.35, 0.07 * gain, 0.5), t + off * beat)
        if melody and (k // 8) % 2 == 0:
            mt = t
            for m, b in mel[k % 8]:
                if m is not None and mt < e:
                    m += 12 + transpose
                    if b >= 0.75:
                        place(buf, tremolo(m, b * beat * 0.95, gain=0.09 * gain), mt)
                    else:
                        place(buf, ks(hz(m), b * beat + 0.3, 0.9, 0.995, 0.16 * gain), mt)
                mt += b * beat
        t += bar
        k += 1


def lofi(buf, s, e, bpm=84):
    beat = 60 / bpm
    prog = ["Fmaj7", "Em7", "Dm7", "Cmaj7"]
    t, k = s, 0
    while t < e - 0.05:
        ch = CH[prog[k % 4]]
        place(buf, epiano(ch, 4 * beat + 0.4), t)
        place(buf, ks(hz(ch[0] - 12), 2 * beat, 0.3, 0.996, 0.25), t)
        for b in range(4):
            bt = t + b * beat
            if bt >= e:
                break
            if b in (0, 2):
                place(buf, kick(0.45), bt)
            if b in (1, 3):
                place(buf, snare(0.2), bt)
            for h in (0, 0.55):
                place(buf, hat(0.05 if h else 0.07), bt + h * beat)
        place(buf, kick(0.3), t + 2.5 * beat)
        t += 4 * beat
        k += 1
    n = int((e - s) * SR)
    crackle = np.zeros(n)
    idx = RNG.integers(0, n, n // 900)
    crackle[idx] = RNG.uniform(-1, 1, len(idx))
    place(buf, lp(crackle, 5000) * 0.25 + lp(noise(n), 3000) * 0.01, s)


def tension(buf, s, e, bpm=100):
    beat = 60 / bpm
    walk = [35, 38, 42, 41, 35, 38, 43, 42]  # B minor pizzicato walk
    t, k = s, 0
    while t < e - 0.05:
        place(buf, ks(hz(walk[k % 8]), 0.25, 0.4, 0.98, 0.3), t)
        place(buf, ks(hz(walk[k % 8] + 12), 0.2, 0.6, 0.97, 0.12), t + beat / 2)
        if k % 8 == 0:
            place(buf, timpani(35, 0.35), t)
        t += beat
        k += 1
    place(buf, pad([47, 54, 59], e - s, 0.05), s)


def work(buf, s, e, bpm=84):
    beat = 60 / bpm
    prog = ["Em", "C", "D", "B7"]
    t, k = s, 0
    while t < e - 0.05:
        ch = CH[prog[(k // 4) % 4]]
        if k % 2 == 0:
            place(buf, taiko(0.55), t)
        else:
            place(buf, taiko(0.25), t)
        if k % 4 == 0:
            place(buf, strum(ch, 1.6, 0.08, 0.35), t)
        if k % 4 == 2:
            place(buf, tremolo(ch[-1] + 12, beat * 1.8, gain=0.07), t)
        t += beat
        k += 1


def night(buf, s, e, bpm=66):
    beat = 60 / bpm
    prog = ["G", "Em", "C", "D"]
    t, k = s, 0
    while t < e - 0.05:
        ch = CH[prog[(k // 6) % 4]]
        notes = [ch[0], ch[1], ch[2], ch[3], ch[2], ch[1]]
        place(buf, ks(hz(notes[k % 6]), 1.2, 0.3, 0.998, 0.12), t)
        t += beat / 2
        k += 1


def gentle(buf, s, e, bpm=72):
    beat = 60 / bpm
    prog = ["D", "A7", "Bm", "G"]
    mel = [74, 73, 71, 67]
    t, k = s, 0
    while t < e - 0.05:
        ch = CH[prog[k % 4]]
        place(buf, strum(ch, 4 * beat, 0.06, 0.35, 0.05), t)
        place(buf, tremolo(mel[k % 4] + 12, 3 * beat, gain=0.06), t + beat)
        t += 4 * beat
        k += 1


def build_up(buf, s, e):
    d = e - s
    place(buf, pad([50, 57, 62, 66], d, 0.05), s)
    n = int(d * SR)
    t = t_axis(n)
    roll = np.zeros(n)
    k = 0.0
    while k < d:
        place(roll, timpani(38, 0.06 + 0.12 * k / d)[: int(0.3 * SR)], k)
        k += max(0.06, 0.3 - 0.24 * k / d)
    place(buf, roll * np.linspace(0.3, 1, n), s)


# =============================================================== SFX
def whoosh(dur=0.45, g=0.22):
    n = int(dur * SR)
    tt = np.linspace(0, 1, n)
    x = noise(n)
    return (bp(x, 300, 1200) * (1 - tt) + bp(x, 1500, 6000) * tt) * np.sin(np.pi * tt) ** 2 * g


def riser(dur, g=0.35):
    n = int(dur * SR)
    tt = np.linspace(0, 1, n)
    f = 200 + 1800 * tt**2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.2
    return (tone + hp(noise(n), 2000) * tt * 0.6) * tt**1.5 * g


def boom(g=0.8):
    n = int(2.5 * SR)
    t = t_axis(n)
    return (lp(noise(n), 120, 4) * 5 + np.sin(2 * np.pi * 45 * t)) * np.exp(-t * 2) * g


def crowd(dur, g=0.06):
    n = int(dur * SR)
    t = t_axis(n)
    x = bp(noise(n), 250, 2500)
    am = 0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t) * np.sin(2 * np.pi * 0.23 * t + 1)
    return x * am * env(n, 1.0, 1.0) * g


def hooves(dur, g=0.12):
    n = int(dur * SR)
    out = np.zeros(n)
    t = 0.3
    while t < dur - 0.2:
        for off, f in ((0, 1800), (0.14, 1300)):
            m = int(0.04 * SR)
            click = bp(noise(m), f * 0.7, f * 1.4) * np.exp(-t_axis(m) * 120)
            place(out, click, t + off)
        t += 0.52
    return out * g


def coins(g=0.25):
    out = np.zeros(int(0.8 * SR))
    for k in range(4):
        n = int(0.4 * SR)
        t = t_axis(n)
        f = 3000 + RNG.uniform(0, 1500)
        c = sum(np.sin(2 * np.pi * f * r * t) for r in (1, 1.48, 2.3)) * np.exp(-t * 18)
        place(out, c, k * 0.09 + RNG.uniform(0, 0.03))
    return out * g / 3


def thump(g=0.6):
    n = int(0.4 * SR)
    t = t_axis(n)
    return (np.sin(2 * np.pi * (60 + 80 * np.exp(-t * 30)) * t) + lp(noise(n), 900) * 0.6) * np.exp(-t * 14) * g


def page(g=0.12):
    n = int(0.25 * SR)
    tt = np.linspace(0, 1, n)
    return bp(noise(n), 1500, 8000) * np.sin(np.pi * tt) * g


def scratch(g=0.5):
    n = int(0.45 * SR)
    t = t_axis(n)
    f = 900 * np.abs(np.sin(2 * np.pi * 2.2 * t)) + 150
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + bp(noise(n), 500, 4000) * 0.6) * env(n, 0.01, 0.1) * g


def power_down(g=0.35):
    out = np.zeros(int(1.2 * SR))
    for i, m in enumerate([84, 79, 72, 67]):
        n = int(0.25 * SR)
        t = t_axis(n)
        place(out, np.sin(2 * np.pi * hz(m) * t) * np.exp(-t * 10), i * 0.18)
    return out * g


def ping(g=0.35):
    out = np.zeros(int(1.5 * SR))
    for i, m in enumerate([88, 95]):
        n = int(1.0 * SR)
        t = t_axis(n)
        place(out, (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(4 * np.pi * hz(m) * t)) * np.exp(-t * 4), i * 0.12)
    return out * g


def crickets(dur, g=0.05):
    n = int(dur * SR)
    out = np.zeros(n)
    t = 0.0
    while t < dur:
        m = int(0.12 * SR)
        tt = t_axis(m)
        chirp = np.sin(2 * np.pi * 4300 * tt) * (np.sin(2 * np.pi * 45 * tt) > 0) * np.sin(np.pi * tt / 0.12)
        place(out, chirp, t)
        t += RNG.uniform(0.25, 0.7)
    return out * env(n, 0.8, 0.8) * g


def fire(dur, g=0.08):
    n = int(dur * SR)
    base = lp(noise(n), 900) * 0.5
    pops = np.zeros(n)
    idx = RNG.integers(0, n, int(dur * 9))
    pops[idx] = RNG.uniform(0.3, 1, len(idx))
    pops = bp(pops, 1000, 6000) * 4
    return (base + pops) * env(n, 0.5, 0.5) * g


def water(dur, g=0.07):
    n = int(dur * SR)
    t = t_axis(n)
    return lp(noise(n), 700) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.4 * t)) * env(n, 0.8, 0.8) * g


def stone_work(dur, g=0.25):
    out = np.zeros(int(dur * SR))
    t = 0.6
    while t < dur - 0.3:
        place(out, thump(0.5), t)
        n = int(0.15 * SR)
        place(out, bp(noise(n), 2000, 6000) * np.exp(-t_axis(n) * 40) * 0.5, t + 0.55)
        t += RNG.uniform(1.1, 1.8)
    return out * g


# =============================================================== main
def main():
    WORK.mkdir(parents=True, exist_ok=True)
    OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    script = json.loads(SCRIPT.read_text())

    print("1/4 dialogue (Kokoro TTS)")
    clips = tts(script)

    lines = []
    cur = script["leadInMs"]
    prev_scene = None
    for i, (ln, clip) in enumerate(zip(script["lines"], clips)):
        if prev_scene is not None and ln["scene"] != prev_scene:
            cur += 250  # a breath at every scene change
        dur = len(clip) / SR * 1000
        lines.append({"i": i, "scene": ln["scene"], "speaker": ln["speaker"], "voiceStartMs": round(cur), "voiceEndMs": round(cur + dur)})
        cur += dur + script["gapMs"]
        prev_scene = ln["scene"]
    total_ms = lines[-1]["voiceEndMs"] + script["outroHoldMs"]

    scenes = []
    for ln in lines:
        if not scenes or scenes[-1]["id"] != ln["scene"]:
            scenes.append({"id": ln["scene"], "startMs": 0 if not scenes else ln["voiceStartMs"] - 220})
    for k, sc in enumerate(scenes):
        sc["endMs"] = scenes[k + 1]["startMs"] if k + 1 < len(scenes) else total_ms

    # lip-sync: loudness envelope per line at 30 fps, as digits 0-9
    for ln, clip in zip(lines, clips):
        hop = SR // 30
        rms = np.array([np.sqrt(np.mean(clip[k:k + hop] ** 2)) for k in range(0, len(clip), hop)])
        rms = np.clip(rms / (np.percentile(rms, 95) + 1e-6), 0, 1)
        ln["mouth"] = "".join(str(int(round(v * 9))) for v in rms)

    voice = np.zeros(int(total_ms / 1000 * SR) + SR)
    for ln, clip in zip(lines, clips):
        place(voice, clip, ln["voiceStartMs"] / 1000)
    sf.write(WORK / "voice.wav", voice, SR)

    print("2/4 word timestamps (faster-whisper)")
    from faster_whisper import WhisperModel

    model = WhisperModel("small", device="cpu", compute_type="int8")
    for ln, sl in zip(lines, script["lines"]):
        ln["words"] = align(sl["text"], word_times(ln["i"], ln["speaker"], ln["voiceStartMs"], model))

    print("3/4 score + sfx")
    total_s = len(voice) / SR
    mus = np.zeros(len(voice))
    sfx = np.zeros(len(voice))
    sc = {s["id"]: (s["startMs"] / 1000, s["endMs"] / 1000) for s in scenes}
    L = lambda scene, n=0: [l for l in lines if l["scene"] == scene][n]  # noqa: E731

    warp_s = sc["warp"][0]
    # lo-fi intro with tape-stop into the warp
    lofi_buf = np.zeros(len(voice))
    lofi(lofi_buf, 0.0, warp_s + 1.0)
    n0, n1 = int(warp_s * SR), int((warp_s + 0.9) * SR)
    seg = lofi_buf[n0:n1].copy()
    rate = np.linspace(1, 0, len(seg))
    pos = np.cumsum(rate)
    stopped = np.interp(pos, np.arange(len(seg)), seg) * np.linspace(1, 0, len(seg))
    lofi_buf[n0:n1] = stopped
    lofi_buf[n1:] = 0
    mus += lofi_buf
    place(sfx, scratch(0.35), warp_s)
    place(sfx, riser(sc["warp"][1] - warp_s, 0.4), warp_s + 0.2)
    plaza_s = sc["plaza"][0]
    place(sfx, boom(0.7), plaza_s)
    place(sfx, bell(60, 0.25, 5), plaza_s + 0.1)
    place(sfx, bell(55, 0.18, 5), plaza_s + 1.6)

    habanera(mus, plaza_s + 0.6, sc["food"][1])
    tension(mus, sc["police"][0], sc["catalog"][1])
    place(sfx, timpani(31, 0.9), L("police", 1)["voiceStartMs"] / 1000 - 0.1)
    work(mus, sc["polo"][0], sc["polo"][1])
    night(mus, sc["night"][0], sc["night"][1])
    # friar: playful, then record scratch + silence, then sheepish plucks
    friar_line = L("friar", 3)["voiceStartMs"] / 1000
    habanera(mus, sc["friar"][0], friar_line - 0.15, bpm=108, melody=False, gain=0.8)
    place(sfx, scratch(0.55), friar_line - 0.3)
    place(sfx, timpani(31, 0.6), friar_line - 0.05)
    pan = L("friar", 4)["voiceStartMs"] / 1000
    for k, m in enumerate([67, 66, 64, 62]):
        place(mus, ks(hz(m), 0.4, 0.6, 0.99, 0.18), pan + 0.2 + k * 0.32)
    gentle(mus, sc["river"][0], sc["river"][1])
    build_up(mus, sc["ending"][0], sc["ending"][1] - 0.2)
    ping_t = sc["ending"][0] + (lines[[l["scene"] for l in lines].index("ending")]["voiceEndMs"] / 1000 - sc["ending"][0]) * 0.62
    habanera(mus, sc["outro"][0], total_s - 0.2, bpm=104, gain=1.0)

    # ambience & spot effects
    for s in scenes[1:]:
        if s["id"] not in ("plaza",):
            place(sfx, whoosh(), s["startMs"] / 1000 - 0.25)
    place(sfx, crowd(sc["food"][1] - plaza_s), plaza_s + 0.5)
    place(sfx, hooves(sc["plaza"][1] - plaza_s), plaza_s + 0.8)
    phone_die = L("phone", 1)["voiceStartMs"] / 1000 - 0.9
    place(sfx, power_down(), phone_die)
    place(sfx, coins(), L("food", 2)["voiceEndMs"] / 1000 - 0.6)
    cat_s = sc["catalog"][0]
    place(sfx, thump(0.5), cat_s + 0.4)
    for k in range(5):
        place(sfx, page(), cat_s + 1.2 + k * 0.22)
    place(sfx, thump(0.8), L("catalog", 1)["voiceEndMs"] / 1000 - 0.35)  # stamp!
    place(sfx, stone_work(sc["polo"][1] - sc["polo"][0]), sc["polo"][0])
    place(sfx, crickets(sc["night"][1] - sc["night"][0]), sc["night"][0])
    place(sfx, fire(sc["night"][1] - sc["night"][0]), sc["night"][0])
    place(sfx, crowd(sc["friar"][1] - sc["friar"][0], 0.04), sc["friar"][0])
    place(sfx, bell(57, 0.12, 4), sc["friar"][0] + 0.3)
    place(sfx, water(sc["river"][1] - sc["river"][0]), sc["river"][0])
    place(sfx, crickets(sc["ending"][1] - sc["ending"][0], 0.035), sc["ending"][0])
    place(sfx, ping(), ping_t)
    place(sfx, riser(1.4, 0.25), ping_t + 0.2)

    m_st = np.stack([mus, mus], 1)
    s_st = np.stack([sfx, np.roll(sfx, int(0.005 * SR))], 1)
    sf.write(WORK / "music.wav", (m_st / max(1e-9, np.abs(m_st).max()) * 0.8).astype(np.float32), SR)
    sf.write(WORK / "sfx.wav", (s_st / max(1e-9, np.abs(s_st).max()) * 0.8).astype(np.float32), SR)

    print("4/4 mix")
    fc = (
        "[0:a]aformat=channel_layouts=stereo,asplit=2[v][vk];"
        "[1:a]volume=0.30[m];"
        "[m][vk]sidechaincompress=threshold=0.03:ratio=5:attack=25:release=400[md];"
        "[2:a]volume=0.5[s];"
        f"[v][md][s]amix=inputs=3:normalize=0,atrim=0:{total_ms / 1000:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[out]"
    )
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", WORK / "voice.wav", "-i", WORK / "music.wav", "-i", WORK / "sfx.wav",
         "-filter_complex", fc, "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", OUT_MP3],
        check=True,
    )
    TIMELINE.write_text(json.dumps({"totalMs": total_ms, "scenes": scenes, "lines": lines, "pingMs": round(ping_t * 1000)}, indent=1) + "\n")
    print(f"done: {total_ms / 1000:.1f}s, {len(lines)} lines, {len(scenes)} scenes -> {OUT_MP3.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
