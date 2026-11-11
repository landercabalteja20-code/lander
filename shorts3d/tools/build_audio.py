"""Build an episode's soundtrack and timing from episodes/<ep>/lines.json.

    .venv/bin/python tools/build_audio.py animals-talk [--engine kokoro|chatterbox]

Writes episodes/<ep>/build/:
  timeline.json   line + word timings, per-frame mouth envelopes (the 3D episode reads this)
  voice.wav       dialogue only;  mix.wav  final mix (-12 LUFS integrated, -1 dBTP)
  captions.ass    2-3 word captions, burned in by engine/render.cjs
"""
from __future__ import annotations

import difflib
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import audio_lib as A  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SR = A.SR


# ------------------------------------------------------------------ voices
_voices = None


def voice_style(spec: str):
    """'am_michael*0.6+am_fenrir*0.4' -> blended style array; plain names pass through."""
    global _voices
    if "+" not in spec and "*" not in spec:
        return spec
    if _voices is None:
        _voices = np.load(A.VOICES)
    out = 0
    for term in spec.split("+"):
        name, _, w = term.partition("*")
        out = out + _voices[name.strip()] * float(w or 1)
    return out.astype(np.float32)


def squawk(a: np.ndarray) -> np.ndarray:
    """Parrot mimicry: band-limited, slightly overdriven, with a fast flutter."""
    spec = np.fft.rfft(a)
    f = np.fft.rfftfreq(len(a), 1 / SR)
    spec *= np.clip((f - 500) / 400, 0, 1) * np.clip((5200 - f) / 1500, 0, 1)
    b = np.fft.irfft(spec, len(a)).astype(np.float32)
    t = np.arange(len(b)) / SR
    b = np.tanh(b * 3.0) * (0.85 + 0.15 * np.sin(2 * np.pi * 31 * t))
    return (b / (np.max(np.abs(b)) + 1e-9) * 0.8).astype(np.float32)


def synth(line: dict, vcfg: dict, engine: str, cache: Path) -> np.ndarray:
    key = hashlib.sha1(json.dumps([line["text"], vcfg, engine]).encode()).hexdigest()[:16]
    p = cache / f"{line['id']}_{key}.wav"
    if p.exists():
        return sf.read(p, dtype="float32")[0]
    voice = vcfg["voice"]
    if engine == "chatterbox":
        ln = A.Line(who=line["who"], text=line["text"], voice=voice.split("*")[0], speed=vcfg.get("speed", 1.0),
                    pitch=vcfg.get("pitch", 0.0), engine="chatterbox", emotion=vcfg.get("emotion", 0.6), pace=0.45)
        A.synth_lines([ln], cache / "cb")
        a = ln.audio
    else:
        k = A._tts_engine()
        lang = "en-gb" if voice.startswith("b") else "en-us"
        a, sr = k.create(line["text"], voice=voice_style(voice), speed=vcfg.get("speed", 1.0), lang=lang,
                         sentence_pause=0.12, clause_pause=0.06)
        a = A._resample(np.asarray(a, np.float32), sr, SR)
        if abs(vcfg.get("pitch", 0)) > 0.01:
            a = A._pitch_shift(a, vcfg["pitch"])
        a = A._trim(a, thr=0.01, pad=0.02)
    if vcfg.get("fx") == "squawk":
        a = squawk(a)
    elif vcfg.get("fx") == "rasp":      # crow: gritty, band-limited
        rng = np.random.default_rng(3)
        env = np.abs(a); env = np.convolve(env, np.ones(240) / 240, mode="same")
        a = np.tanh(a * 5.0) * 0.6 + rng.standard_normal(len(a)).astype(np.float32) * env * 0.9
        spec = np.fft.rfft(a); f = np.fft.rfftfreq(len(a), 1 / SR)
        spec *= np.clip((f - 250) / 200, 0, 1) * np.clip((4500 - f) / 1500, 0, 1)
        a = np.fft.irfft(spec, len(a)).astype(np.float32)
    elif vcfg.get("fx") == "chorus":    # a crowd chanting: detuned, staggered copies
        out = a.copy()
        for semis, delay, g in ((1.8, 0.035, 0.8), (-2.2, 0.07, 0.8), (3.5, 0.11, 0.55)):
            b = A._pitch_shift(a, semis) * g
            i = int(delay * SR)
            out = np.pad(out, (0, max(0, i + len(b) - len(out))))
            out[i:i + len(b)] += b
        a = out
    elif vcfg.get("fx") == "whine":     # mosquito: thin, whiny, with a high buzzing edge
        t = np.arange(len(a)) / SR
        spec = np.fft.rfft(a); f = np.fft.rfftfreq(len(a), 1 / SR)
        spec *= np.clip((f - 700) / 300, 0, 1)
        a = np.fft.irfft(spec, len(a)).astype(np.float32)
        env = np.convolve(np.abs(a), np.ones(480) / 480, mode="same")
        a = a * (0.8 + 0.2 * np.sin(2 * np.pi * 420 * t)) + 0.25 * env * np.sign(np.sin(2 * np.pi * 620 * t))
    elif vcfg.get("fx") == "buzz":      # bee: fast tremolo + a little ring modulation
        t = np.arange(len(a)) / SR
        a = a * (0.72 + 0.28 * np.sin(2 * np.pi * 190 * t)) * (0.9 + 0.1 * np.sin(2 * np.pi * 23 * t))
    a = a * (0.1 / (np.sqrt(np.mean(a ** 2)) + 1e-9))
    a = a * min(1.0, 0.9 / (np.max(np.abs(a)) + 1e-9))
    cache.mkdir(parents=True, exist_ok=True)
    sf.write(p, a, SR)
    return a


# ------------------------------------------------------------------ word timings
def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def align_words(script_words: list[str], heard: list[dict], dur: float) -> list[dict]:
    """Give every script word a start/end by aligning it with Whisper's words; interpolate gaps."""
    a = [norm(w) for w in script_words]
    b = [norm(h["w"]) for h in heard]
    times: list[list[float] | None] = [None] * len(a)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        tag, i1, i2, j1, j2 = blk
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                times[i1 + k] = [heard[j1 + k]["s"], heard[j1 + k]["e"]]
        elif tag == "replace" and j2 > j1:  # e.g. "165" heard as "a hundred and sixty-five"
            s, e = heard[j1]["s"], heard[j2 - 1]["e"]
            for k in range(i2 - i1):
                times[i1 + k] = [s + (e - s) * k / (i2 - i1), s + (e - s) * (k + 1) / (i2 - i1)]
    known = [i for i, t in enumerate(times) if t]
    for i in range(len(times)):
        if times[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            s = times[prev][1] if prev is not None else 0.0
            e = times[nxt][0] if nxt is not None else dur
            times[i] = [s, max(s + 0.05, e)]
    return [{"w": w, "s": round(t[0], 3), "e": round(t[1], 3)} for w, t in zip(script_words, times)]


# ------------------------------------------------------------------ captions
ASS_HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00141414,&H96000000,-1,0,0,0,100,100,0,0,1,{outline},{shadow},5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ts(t: float) -> str:
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"


def chunk_words(words: list[dict], max_words: int = 3, max_chars: int = 16) -> list[list[dict]]:
    chunks, cur = [], []
    for w in words:
        if cur and (len(cur) >= max_words or len(" ".join(x["w"] for x in cur + [w])) > max_chars):
            chunks.append(cur); cur = []
        cur.append(w)
        if re.search(r"[,.?!…]$", w["w"]):
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)
    # never leave a lonely short word at the end of a sentence
    out = []
    for c in chunks:
        if out and len(c) == 1 and len(c[0]["w"]) <= 3 and not re.search(r"[,.?!…]$", out[-1][-1]["w"]) and len(out[-1]) < 3:
            out[-1] = out[-1] + c
        else:
            out.append(c)
    return out


def write_captions(lines: list[dict], path: Path, end_time: float, font: str, y: int = 1498) -> int:
    chunks = []
    for ln in lines:
        for c in chunk_words(ln["words"]):
            chunks.append({"s": c[0]["s"], "e": c[-1]["e"], "text": " ".join(w["w"] for w in c).rstrip(",")})
    ev = []
    for i, c in enumerate(chunks):
        nxt = chunks[i + 1]["s"] if i + 1 < len(chunks) else end_time
        end = nxt if nxt - c["e"] < 0.7 else c["e"] + 0.35   # hold through short pauses, like the reference
        text = c["text"].replace("...", "…")
        if text.endswith(".") and not text.endswith(("a.m.", "p.m.", "…")):   # like the reference: no full stops
            text = text[:-1]
        pop = r"{\an5\pos(540,%d)\fscx90\fscy90\t(0,90,\fscx100\fscy100)}" % y
        ev.append(f"Dialogue: 0,{ts(c['s'] - 0.03)},{ts(end - 0.03)},Cap,,0,0,0,,{pop}{text}")   # ends as the next one starts: no doubled frame
    path.write_text(ASS_HEAD.format(font=font, size=88, outline=6, shadow=3) + "\n".join(ev) + "\n")
    return len(chunks)


# ------------------------------------------------------------------ sfx + mix
def sfx(name: str) -> np.ndarray:
    rng = np.random.default_rng(sum(map(ord, name)))
    t = lambda d: np.arange(int(d * SR), dtype=np.float32) / SR
    if name == "alarm":  # digital alarm clock: two pairs of square beeps
        out = np.zeros(int(0.9 * SR), np.float32)
        for k, at in enumerate((0.0, 0.12, 0.45, 0.57)):
            tt = t(0.08)
            sq = np.sign(np.sin(2 * np.pi * 2093 * tt)) * 0.35 * np.minimum(1, tt * 400) * np.minimum(1, (0.08 - tt) * 400)
            i = int(at * SR); out[i:i + len(sq)] += sq
        return A._lowpass(out, 3)
    if name == "coo":  # pigeons cackling: warbly coos
        out = np.zeros(int(1.1 * SR), np.float32)
        for k, (at, f0) in enumerate(((0.0, 420), (0.18, 470), (0.42, 400), (0.6, 450))):
            tt = t(0.32)
            f = f0 * (1 + 0.12 * np.sin(2 * np.pi * 14 * tt)) * (1 - 0.25 * tt)
            sig = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
            env = np.sin(np.pi * np.clip(tt / 0.32, 0, 1)) ** 1.5
            i = int(at * SR); out[i:i + len(tt)] += (sig * env * 0.3).astype(np.float32)
        return out
    if name == "squawk":
        tt = t(0.32)
        f = 1400 + 900 * np.sin(np.pi * tt / 0.32) - 500 * tt
        car = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.4 + rng.standard_normal(len(tt)).astype(np.float32) * 0.25
        return (A._lowpass(car.astype(np.float32), 4) * np.sin(np.pi * tt / 0.32) ** 0.5 * 0.6).astype(np.float32)
    if name == "sniff":  # two short nasal inhales
        out = np.zeros(int(0.6 * SR), np.float32)
        for at in (0.0, 0.22):
            tt = t(0.16)
            n = rng.standard_normal(len(tt)).astype(np.float32)
            n = n - A._lowpass(n, 10)
            i = int(at * SR); out[i:i + len(tt)] += n * np.sin(np.pi * tt / 0.16) ** 2 * 0.35
        return out
    if name == "crash":  # ceramic vase shattering: thud + noisy burst + tinkly shards
        out = np.zeros(int(1.2 * SR), np.float32)
        tt = t(0.25); out[:len(tt)] += np.sin(2 * np.pi * 90 * tt) * np.exp(-tt * 18) * 0.8
        n = rng.standard_normal(int(0.5 * SR)).astype(np.float32)
        tn = np.arange(len(n)) / SR
        out[:len(n)] += (n - A._lowpass(n, 3)) * np.exp(-tn * 9) * 0.7
        for k in range(14):
            b = A._bell(2200 + rng.uniform(0, 3500), 0.25) * 0.18
            i = int(rng.uniform(0.02, 0.6) * SR); out[i:i + len(b)] += b[: len(out) - i]
        return out
    if name == "door":  # door closing: knock-thud
        tt = t(0.4)
        return (np.sin(2 * np.pi * 70 * tt) * np.exp(-tt * 14) + 0.3 * A._lowpass(rng.standard_normal(len(tt)).astype(np.float32), 6) * np.exp(-tt * 30)).astype(np.float32)
    if name == "caw":  # crow call
        out = np.zeros(int(0.9 * SR), np.float32)
        for at in (0.0, 0.42):
            tt = t(0.3)
            f = 620 - 220 * tt / 0.3
            car = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * 0.5 + rng.standard_normal(len(tt)).astype(np.float32) * 0.35
            i = int(at * SR); out[i:i + len(tt)] += A._lowpass(car.astype(np.float32), 5) * np.sin(np.pi * tt / 0.3) ** 0.7
        return out
    if name == "cluck":
        out = np.zeros(int(0.7 * SR), np.float32)
        for k, at in enumerate((0.0, 0.14, 0.26)):
            tt = t(0.09)
            f = 900 + 500 * np.exp(-tt * 40)
            i = int(at * SR); out[i:i + len(tt)] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 30) * 0.5
        return out
    if name == "moo":
        tt = t(1.1)
        f = 140 - 40 * tt + 15 * np.sin(2 * np.pi * 2.5 * tt)
        ph = 2 * np.pi * np.cumsum(f) / SR
        sig = sum(np.sin(ph * k) / k for k in range(1, 7))
        return (np.tanh(sig * 0.8) * np.sin(np.pi * np.clip(tt / 1.1, 0, 1)) ** 0.6 * 0.5).astype(np.float32)
    if name == "bzz":  # bee buzzing (1.6 s)
        tt = t(1.6)
        f = 210 + 15 * np.sin(2 * np.pi * 3.0 * tt)
        saw = 2 * ((np.cumsum(f) / SR) % 1.0) - 1
        return (saw * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * tt)) * np.sin(np.pi * tt / 1.6) * 0.35).astype(np.float32)
    if name == "splash":
        n = rng.standard_normal(int(1.0 * SR)).astype(np.float32)
        tn = np.arange(len(n)) / SR
        return (A._lowpass(n, 8) * np.exp(-tn * 5) * 1.2 + (n - A._lowpass(n, 2)) * np.exp(-tn * 9) * 0.3).astype(np.float32)
    if name == "whistle":  # dolphin chirp
        tt = t(0.5)
        f = 6000 + 3500 * np.sin(2 * np.pi * 2.2 * tt) * np.exp(-tt * 1.5)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.5) * 0.35).astype(np.float32)
    if name == "gavel":
        out = np.zeros(int(0.8 * SR), np.float32)
        for at in (0.0, 0.28):
            tt = t(0.2)
            sig = np.sin(2 * np.pi * 180 * tt) * np.exp(-tt * 35) + 0.5 * A._lowpass(rng.standard_normal(len(tt)).astype(np.float32), 3) * np.exp(-tt * 60)
            i = int(at * SR); out[i:i + len(tt)] += sig.astype(np.float32)
        return out
    if name == "whine":  # mosquito flying past the ear
        tt = t(1.8)
        f = 600 + 60 * np.sin(2 * np.pi * 1.3 * tt) + 25 * np.sin(2 * np.pi * 7 * tt)
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
        return (sig * np.sin(np.pi * tt / 1.8) ** 2 * 0.25).astype(np.float32)
    noise = lambda d: rng.standard_normal(int(d * SR)).astype(np.float32)
    if name == "tick":  # clock ticking, four ticks over a second
        out = np.zeros(int(1.0 * SR), np.float32)
        for k in range(4):
            tt = t(0.03)
            sig = np.sin(2 * np.pi * 3200 * tt) * np.exp(-tt * 300) + 0.4 * noise(0.03) * np.exp(-tt * 400)
            i = int(k * 0.25 * SR); out[i:i + len(tt)] += sig.astype(np.float32) * (0.6 if k % 2 else 0.45)
        return out
    if name == "clatter":  # phone, keys and wallet hitting the floor
        out = np.zeros(int(1.0 * SR), np.float32)
        for at, g in ((0.0, 1.0), (0.13, 0.5)):
            tt = t(0.08)
            sig = (np.sin(2 * np.pi * 520 * tt) + 0.6 * np.sin(2 * np.pi * 1380 * tt)) * np.exp(-tt * 60) + 0.5 * noise(0.08) * np.exp(-tt * 120)
            i = int(at * SR); out[i:i + len(tt)] += (sig * g * 0.6).astype(np.float32)
        for k in range(10):
            b = A._bell(3000 + rng.uniform(0, 3000), 0.18) * 0.12
            i = int(rng.uniform(0.05, 0.4) * SR); out[i:i + len(b)] += b[: len(out) - i]
        tt = t(0.12); i = int(0.3 * SR)
        out[i:i + len(tt)] += A._lowpass(noise(0.12), 12) * np.exp(-tt * 40) * 1.5
        return out
    if name == "zip":  # zipper: clicks speeding up
        tt = t(0.4)
        saw = (np.cumsum(70 + 140 * tt / 0.4) / SR) % 1.0
        n = noise(0.4)
        return ((n - A._lowpass(n, 3)) * np.exp(-saw * 25) * np.sin(np.pi * tt / 0.4) ** 0.4 * 0.7).astype(np.float32)
    if name == "shutter":  # three camera shutters
        out = np.zeros(int(0.9 * SR), np.float32)
        for at in (0.0, 0.22, 0.5):
            tt = t(0.07); n = noise(0.07)
            sig = (n - A._lowpass(n, 2)) * (np.exp(-tt * 120) + 0.7 * np.exp(-np.abs(tt - 0.045) * 250))
            i = int(at * SR); out[i:i + len(tt)] += sig * 0.6
        return out
    if name == "whoop":  # police siren chirp, two sweeps
        tt = t(0.7)
        ph = tt % 0.35
        f = 650 + 850 * (ph / 0.35) ** 0.7
        sig = np.tanh(2.5 * np.sin(2 * np.pi * np.cumsum(f) / SR))
        return (sig * np.minimum(1, ph * 60) * np.minimum(1, (0.35 - ph) * 30) * 0.3).astype(np.float32)
    if name == "cheer":  # crowd: many detuned "yay" voices, noise and claps
        d = 1.8; tt = t(d); out = np.zeros(len(tt), np.float32)
        for k in range(14):
            f0 = rng.uniform(170, 380)
            f = f0 * (1 + 0.04 * np.sin(2 * np.pi * rng.uniform(4, 7) * tt + rng.uniform(0, 6))) * (1 + 0.15 * np.minimum(1, tt * 3))
            v = A._lowpass((2 * ((np.cumsum(f) / SR) % 1.0) - 1).astype(np.float32), 6)
            st = rng.uniform(0, 0.25)
            out += v * np.clip((tt - st) * 5, 0, 1) * np.exp(-np.maximum(0, tt - st - 0.8) * 2.2) * 0.12
        n = noise(d)
        out += (A._lowpass(n, 3) - A._lowpass(n, 12)) * np.minimum(1, tt * 5) * np.exp(-np.maximum(0, tt - 0.9) * 2.2) * 0.5
        for k in range(30):
            i = int(rng.uniform(0, d - 0.05) * SR); tc = t(0.02)
            out[i:i + len(tc)] += noise(0.02) * np.exp(-tc * 300) * 0.2
        return out
    if name == "squirt":  # lotion pump
        tt = t(0.3)
        sig = np.sin(2 * np.pi * np.cumsum(500 * np.exp(-tt * 8) + 120) / SR) * 0.5 + A._lowpass(noise(0.3), 5) * 0.6
        return (sig * np.sin(np.pi * tt / 0.3) ** 0.6 * 0.5).astype(np.float32)
    if name == "beep":  # thermostat buttons: five rising beeps
        out = np.zeros(int(1.0 * SR), np.float32)
        for k in range(5):
            tt = t(0.06)
            sig = np.sin(2 * np.pi * (1800 + k * 120) * tt) * np.minimum(1, tt * 500) * np.minimum(1, (0.06 - tt) * 500)
            i = int(k * 0.17 * SR); out[i:i + len(tt)] += sig.astype(np.float32) * 0.35
        return out
    if name == "kaching":  # cash register
        out = np.zeros(int(1.2 * SR), np.float32)
        tt = t(0.15); out[:len(tt)] += A._lowpass(noise(0.15), 2) * np.exp(-tt * 40) * 0.5
        b = A._bell(A._midi(93), 1.0) * 0.5 + A._bell(A._midi(100), 1.0) * 0.3
        i = int(0.08 * SR); out[i:i + len(b)] += b[: len(out) - i]
        return out
    if name == "sizzle":  # bacon in a pan: hiss with crackles (2 s)
        d = 2.0; tt = t(d); n = noise(d)
        out = (n - A._lowpass(n, 2)) * 0.25 * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * tt))
        for k in range(90):
            i = int(rng.uniform(0, d - 0.01) * SR); tc = t(0.006)
            out[i:i + len(tc)] += noise(0.006) * np.exp(-tc * 900) * rng.uniform(0.3, 1.0)
        return (out * np.minimum(1, tt * 8) * np.minimum(1, (d - tt) * 4)).astype(np.float32)
    if name == "wind":  # winter wind (1.6 s)
        d = 1.6; tt = t(d)
        wh = np.sin(2 * np.pi * np.cumsum(420 + 120 * np.sin(2 * np.pi * 0.6 * tt)) / SR) * 0.08
        return ((A._lowpass(noise(d), 30) * 3 + wh) * np.sin(np.pi * tt / d) ** 1.2 * 0.6).astype(np.float32)
    if name == "doorbell":  # ding-dong
        out = np.zeros(int(1.6 * SR), np.float32)
        a = A._bell(A._midi(76), 1.0) * 0.5; b = A._bell(A._midi(72), 1.2) * 0.5
        out[:len(a)] += a; i = int(0.42 * SR); out[i:i + len(b)] += b[: len(out) - i]
        return out
    if name == "flop":  # flopping onto a mattress: thud + springs
        tt = t(0.6)
        thud = A._lowpass(noise(0.6), 20) * np.exp(-tt * 14) * 3
        spring = np.sin(2 * np.pi * np.cumsum(180 + 60 * np.sin(2 * np.pi * 11 * tt)) / SR) * np.exp(-tt * 6) * 0.15
        return (thud + spring).astype(np.float32)
    if name == "arf":  # small dog bark
        tt = t(0.22)
        ph = 2 * np.pi * np.cumsum(520 + 380 * np.exp(-tt * 25) - 200 * tt / 0.22) / SR
        sig = sum(np.sin(ph * k) / k for k in range(1, 6)) + A._lowpass(noise(0.22), 3) * 0.4
        return (np.tanh(sig * 1.2) * np.sin(np.pi * np.clip(tt / 0.22, 0, 1)) ** 0.4 * np.exp(-tt * 6) * 0.5).astype(np.float32)
    return A.sfx(name)


def mix(total: float, lines: list[dict], cues: list, music: dict | None, out_wav: Path) -> None:
    n = int((total + 0.5) * SR)
    voice = np.zeros((n, 2), np.float32)
    for ln in lines:
        A._place(voice, ln["audio"], ln["start"], 1.0)
    fx = np.zeros((n, 2), np.float32)
    for at, name, gain in cues:
        sig = sfx(name)
        A._place(fx, sig * (0.7 / (np.max(np.abs(sig)) + 1e-9)), at, gain)
    out = voice + fx
    if music:
        bed = A.score(total + 0.5, music["sections"], seed=music.get("seed", 7))[:n]
        bed = np.pad(bed, ((0, max(0, n - len(bed))), (0, 0)))
        v = np.abs(voice[:, 0])
        k = int(0.3 * SR)
        env = np.convolve(v, np.ones(k, np.float32) / k, mode="same")
        duck = 1 - music.get("duck", 0.35) * np.clip(env / 0.03, 0, 1)
        gate = np.ones(n, np.float32)
        if music.get("stop") is not None:
            i = int(music["stop"] * SR)
            gate[i:] = 0
            gate[i:i + int(0.04 * SR)] = np.linspace(1, 0, len(gate[i:i + int(0.04 * SR)]))
        intro = np.clip(np.arange(n) / (SR * 0.15), 0, 1)
        out += bed * (music.get("volume", 0.4) * duck * gate * intro)[:, None]
    out = np.tanh(out * 1.15) / np.tanh(1.15)
    out *= min(1.0, 0.97 / (np.max(np.abs(out)) + 1e-9))
    sf.write(out_wav, out, SR, subtype="PCM_24")


# ------------------------------------------------------------------ main
def anchor(timeline: dict, ref: str) -> float:
    """'n2' -> line start, 'n2.end' -> line end, 'n2@165' -> start of the first word matching '165'."""
    lid, _, word = ref.partition("@")
    lid, _, edge = lid.partition(".")
    ln = next(l for l in timeline["lines"] if l["id"] == lid)
    if word:
        w = next(x for x in ln["words"] if norm(x["w"]).startswith(norm(word)))
        return w["s"]
    return ln["end"] if edge == "end" else ln["start"]


def main() -> None:
    ep = sys.argv[1]
    engine = sys.argv[sys.argv.index("--engine") + 1] if "--engine" in sys.argv else "kokoro"
    epdir = ROOT / "episodes" / ep
    build = epdir / "build"
    build.mkdir(parents=True, exist_ok=True)
    cfg = json.loads((epdir / "lines.json").read_text())
    fps = cfg.get("fps", 30)

    print("==> voices")
    t = 0.0
    lines = []
    for ln in cfg["lines"]:
        vc = {**cfg["voices"][ln["who"]], **{k: ln[k] for k in ("pitch", "speed") if k in ln}}
        a = synth(ln, vc, "kokoro" if ln["who"] == "narrator" and engine != "chatterbox" else engine, build / "tts")
        a = a * ln.get("gain", 1.0)
        lines.append({**ln, "audio": a, "start": round(t, 3), "end": round(t + len(a) / SR, 3)})
        print(f"    {ln['id']:<7} {t:6.2f}-{t + len(a) / SR:6.2f}  {ln['text']}")
        t += len(a) / SR + ln.get("gap", 0.3)
    total = lines[-1]["end"] + cfg.get("tail", 0.75)

    print("==> word timings (faster-whisper)")
    from faster_whisper import WhisperModel
    wm = WhisperModel("small.en", device="cpu", compute_type="int8")
    for ln in lines:
        a16 = A._resample(ln["audio"], SR, 16000)
        segs, _ = wm.transcribe(a16, word_timestamps=True, beam_size=5, language="en")
        heard = [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]
        cap = ln.get("caption", ln["text"])
        ln["heard"] = " ".join(h["w"] for h in heard)
        words = align_words(cap.split(), heard, len(ln["audio"]) / SR)
        ln["words"] = [{**w, "s": round(w["s"] + ln["start"], 3), "e": round(w["e"] + ln["start"], 3)} for w in words]
        print(f"    {ln['id']:<7} heard: {ln['heard']}")

    print("==> lip sync envelopes")
    for ln in lines:
        env, vis = A.mouth_envelope(ln["audio"], fps)
        ln["env"] = [round(float(x), 3) for x in env]

    timeline = {"fps": fps, "duration": round(total, 3),
                "lines": [{k: v for k, v in ln.items() if k != "audio"} for ln in lines]}
    (build / "timeline.json").write_text(json.dumps(timeline))

    print("==> music, sfx, mix")
    cues = []
    for ref, name, gain in cfg.get("sfx", []):
        try:
            at = anchor(timeline, ref.split("+")[0]) + (float(ref.split("+")[1]) if "+" in ref else 0.0)
            cues.append((at, name, gain))
        except StopIteration:
            print("    (skipped sfx anchor)", ref)
    music = cfg.get("music")
    if music and music.get("sections"):
        music = {**music, "sections": [{**s, "at": anchor(timeline, s["at"]) if isinstance(s["at"], str) else s["at"]}
                                       for s in music["sections"]]}
    if music and isinstance(music.get("stop"), str):
        ref = music["stop"]
        music["stop"] = anchor(timeline, ref.split("+")[0]) + (float(ref.split("+")[1]) if "+" in ref else 0.0)
    # level-match the narrator: every narrator line at the median loudness of speech (after timings are fixed,
    # so word timestamps and the rendered pictures can't move)
    def active_rms(a: np.ndarray) -> float:
        n = int(0.05 * SR); k = len(a) // n
        if k == 0:
            return 1e-9
        w = np.sqrt((a[:k * n].reshape(k, n) ** 2).mean(1))
        act = w[w > w.max() * 0.1]
        return float(np.sqrt((act ** 2).mean()) + 1e-12)
    nar = [ln for ln in lines if ln["who"] == "narrator"]
    if nar:
        target_rms = float(np.median([active_rms(ln["audio"]) for ln in nar]))
        for ln in nar:
            ln["audio"] = ln["audio"] * float(np.clip(target_rms / active_rms(ln["audio"]), 0.5, 2.0))
    mix(total, lines, cues, music, build / "mix_raw.wav")
    voice_only = np.zeros(int((total + 0.5) * SR), np.float32)
    for l in lines:
        i = int(l["start"] * SR); voice_only[i:i + len(l["audio"])] += l["audio"][: len(voice_only) - i]
    sf.write(build / "voice.wav", voice_only, SR, subtype="PCM_16")
    target = cfg.get("lufs", -12.0)
    meas = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(build / "mix_raw.wav"), "-af", "ebur128", "-f", "null", "-"],
                          capture_output=True, text=True).stderr
    measured = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", meas)[-1])
    gain_db = target - measured
    print(f"    integrated {measured:.1f} LUFS -> +{gain_db:.1f} dB, peak-limited at -2.2 dBFS so AAC stays under 0 dBTP (one static gain: no pumping)")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(build / "mix_raw.wav"), "-af",
                    f"aresample=48000,volume={gain_db:.2f}dB,alimiter=limit=0.78:attack=4:release=80:level=false",
                    "-t", f"{total:.3f}", "-ar", "48000", str(build / "mix.wav")], check=True)

    print("==> captions")
    font = cfg.get("font", "Inter")
    n = write_captions(timeline["lines"], build / "captions.ass", total, font)
    words = sum(len(l["words"]) for l in lines)
    speech = sum(l["end"] - l["start"] for l in lines)
    print(f"    {n} caption chunks; {words} words; {words / speech:.2f} words/s while speaking; total {total:.2f} s")


if __name__ == "__main__":
    main()
