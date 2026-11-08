"""Build all audio + timing data for the "What if humans shrank to the size of ants?" short.

Pipeline:
  1. Kokoro TTS  -> one narration clip per beat (src/ants/script.json)
  2. faster-whisper -> word timestamps for captions
  3. numpy/scipy synth -> original music bed + sound effects, synced to the beats
  4. ffmpeg -> duck music under voice, loudness-normalise, export public/ants/mix.mp3
  5. write src/ants/timeline.json (beat timings, caption words, rain impacts)

Run:  .venv/bin/python tools/ants/build_audio.py
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src/ants/script.json"
TIMELINE = ROOT / "src/ants/timeline.json"
WORK = ROOT / "tools/ants/.work"
OUT_MP3 = ROOT / "public/ants/mix.mp3"
SR = 48000
RNG = np.random.default_rng(7)


# ---------------------------------------------------------------- 1. TTS
def tts(script: dict) -> list[np.ndarray]:
    from kokoro_onnx import Kokoro

    k = Kokoro(str(ROOT / ".models/kokoro-v1.0.onnx"), str(ROOT / ".models/voices-v1.0.bin"))
    clips = []
    for b in script["beats"]:
        samples, sr = k.create(b["text"], voice=script["voice"], speed=script["speed"], lang="en-us")
        samples = signal.resample_poly(samples, SR, sr).astype(np.float32)
        # trim silence (keep 30ms pads)
        idx = np.where(np.abs(samples) > 0.01)[0]
        pad = int(0.03 * SR)
        samples = samples[max(0, idx[0] - pad) : idx[-1] + pad]
        sf.write(WORK / f"vo_{b['id']}.wav", samples, SR)
        clips.append(samples)
        print(f"  tts {b['id']:7s} {len(samples) / SR:5.2f}s")
    return clips


# ---------------------------------------------------------------- 2. Whisper
def words_for(beat_id: str, offset_ms: float, model) -> list[dict]:
    segs, _ = model.transcribe(str(WORK / f"vo_{beat_id}.wav"), word_timestamps=True, language="en")
    out = []
    for s in segs:
        for w in s.words:
            out.append(
                {
                    "text": w.word,
                    "startMs": round(offset_ms + w.start * 1000),
                    "endMs": round(offset_ms + w.end * 1000),
                    "timestampMs": round(offset_ms + (w.start + w.end) * 500),
                    "confidence": round(float(w.probability), 3),
                }
            )
    return out


def _norm(s: str) -> str:
    return "".join(c for c in s.lower() if c.isalnum())


def align_to_script(text: str, heard: list[dict]) -> list[dict]:
    """Show the *script's* words, timed by whisper. Fixes mis-hearings ("AntsWorld"),
    stray punctuation tokens and number formatting while keeping real timing."""
    import difflib

    heard = [w for w in heard if _norm(w["text"])]
    script_words = text.split()
    a = [_norm(w) for w in script_words]
    b = [_norm(w["text"]) for w in heard]
    timed: list[dict | None] = [None] * len(script_words)
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
                timed[i] = {"startMs": round(acc), "endMs": round(acc + d), "confidence": 0.5}
                acc += d
    # words whisper missed entirely: squeeze between neighbours
    for i, w in enumerate(timed):
        if w is None:
            prev = next((timed[k]["endMs"] for k in range(i - 1, -1, -1) if timed[k]), heard[0]["startMs"])
            nxt = next((timed[k]["startMs"] for k in range(i + 1, len(timed)) if timed[k]), prev + 200)
            timed[i] = {"startMs": prev, "endMs": max(prev + 1, nxt), "confidence": 0.3}
    out = []
    for i, (word, w) in enumerate(zip(script_words, timed)):
        w["text"] = word if i == 0 else " " + word
        w["timestampMs"] = (w["startMs"] + w["endMs"]) // 2
        out.append(w)
    return out


# ---------------------------------------------------------------- 3. Synth helpers
def t_axis(n: int) -> np.ndarray:
    return np.arange(n) / SR


def note_hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def adsr(n: int, a=0.01, r=0.2) -> np.ndarray:
    env = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    na, nr = min(na, n), min(nr, n)
    env[:na] = np.linspace(0, 1, na)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return env


def place(buf: np.ndarray, clip: np.ndarray, at_s: float, gain=1.0):
    i = int(at_s * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i] * gain


def lp(x, hz, order=2):
    return signal.sosfilt(signal.butter(order, hz, "low", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def pad_chord(midis, dur, gain=0.08):
    n = int(dur * SR)
    t = t_axis(n)
    out = np.zeros(n)
    for m in midis:
        f = note_hz(m)
        for det in (-0.12, 0.0, 0.12):  # cents-ish detune for width
            ff = f * 2 ** (det / 12)
            # soft "saw" via a few harmonics
            for h, a in ((1, 1.0), (2, 0.35), (3, 0.18), (4, 0.08)):
                out += a * np.sin(2 * np.pi * ff * h * t + RNG.uniform(0, 6.28))
    out = lp(out, 1800)
    return out * adsr(n, a=0.8, r=1.2) * gain / len(midis)


def pluck(midi, dur=0.5, gain=0.12, bright=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = note_hz(midi)
    x = np.sin(2 * np.pi * f * t) + 0.4 * bright * np.sin(2 * np.pi * 2 * f * t) + 0.15 * bright * np.sin(2 * np.pi * 3 * f * t)
    return x * np.exp(-t * 7) * adsr(n, a=0.003, r=0.05) * gain


def kick(gain=0.5):
    n = int(0.35 * SR)
    t = t_axis(n)
    f = 45 + 90 * np.exp(-t * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * gain


def noise(n):
    return RNG.standard_normal(n)


def whoosh(dur=0.45, gain=0.25):
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    x = noise(n)
    lo = bp(x, 300, 1200)
    hi = bp(x, 1500, 5000)
    mix = lo * (1 - t) + hi * t  # rising sweep
    env = np.sin(np.pi * t) ** 2
    return mix * env * gain


def thunder(dur=3.5, gain=0.9):
    n = int(dur * SR)
    t = t_axis(n)
    crack = bp(noise(n), 800, 4000) * np.exp(-t * 18) * 0.6
    rumble = lp(noise(n), 160, order=4) * 6
    rumble *= (1 - np.exp(-t * 8)) * np.exp(-t * 0.9)
    rumble *= 1 + 0.5 * np.sin(2 * np.pi * 1.7 * t)
    return (crack + rumble) * gain


def drop_impact(gain=0.6):
    n = int(0.5 * SR)
    t = t_axis(n)
    body = np.sin(2 * np.pi * (70 + 120 * np.exp(-t * 25)) * t) * np.exp(-t * 12)
    splash = bp(noise(n), 900, 6000) * np.exp(-t * 14) * 0.35
    return (body + splash) * gain


def tick(gain=0.12):
    n = int(0.02 * SR)
    t = t_axis(n)
    return bp(noise(n), 2500, 7000) * np.exp(-t * 400) * gain


# ---------------------------------------------------------------- 3b. Score
def build_music(total_s: float, beats: list[dict]) -> np.ndarray:
    n = int(total_s * SR)
    mus = np.zeros(n)
    bt = {b["id"]: b for b in beats}
    rain_s = bt["rain"]["voiceStartMs"] / 1000 - 0.15
    outro_s = bt["outro"]["voiceStartMs"] / 1000 - 0.3
    bpm = 96
    beat = 60 / bpm
    bar = beat * 4

    # Part A (curious, playful): Am - F - C - G   (2 bars each)
    prog_a = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]
    # Part B (storm): Am - Dm - E - Am low and tense
    prog_b = [[45, 52, 60], [50, 53, 57], [52, 56, 59], [45, 52, 57]]
    # Outro: F - G - Am (resolve)
    prog_c = [[53, 57, 64], [55, 59, 62], [57, 60, 64]]

    arp_pattern = [0, 2, 1, 2, 0, 2, 1, 2]
    t = 0.0
    ci = 0
    while t < rain_s:
        ch = prog_a[ci % 4]
        place(mus, pad_chord(ch, 2 * bar + 1.2), t)
        for step in range(16):  # 8th notes over 2 bars
            st = t + step * beat / 2
            if st >= rain_s or st < 1.2:  # let the hook breathe
                continue
            m = ch[arp_pattern[step % 8]] + 12 + (12 if step % 8 == 6 else 0)
            place(mus, pluck(m, gain=0.07 if step % 2 else 0.1), st)
        for b in range(8):
            st = t + b * beat
            if st < bt["bed"]["voiceStartMs"] / 1000 - 0.2 or st >= rain_s:
                continue
            if b % 2 == 0:
                place(mus, kick(0.35), st)
        t += 2 * bar
        ci += 1

    # storm section
    t = rain_s
    ci = 0
    while t < outro_s:
        ch = prog_b[ci % 4]
        place(mus, pad_chord(ch, bar + 1.0, gain=0.11), t)
        place(mus, pad_chord([ch[0] - 12], bar + 1.0, gain=0.14), t)  # sub drone
        t += bar
        ci += 1

    # outro
    t = outro_s
    for ch in prog_c:
        place(mus, pad_chord(ch, bar + 1.5, gain=0.09), t)
        for step in range(8):
            place(mus, pluck(ch[arp_pattern[step]] + 12, gain=0.06), t + step * beat / 2)
        t += bar
    fade = int(1.5 * SR)
    mus[-fade:] *= np.linspace(1, 0, fade)
    return mus


def build_sfx(total_s: float, beats: list[dict]) -> tuple[np.ndarray, list[int]]:
    n = int(total_s * SR)
    sfx = np.zeros(n)
    bt = {b["id"]: b for b in beats}
    # whoosh into every cut
    for b in beats[1:]:
        place(sfx, whoosh(), b["startMs"] / 1000 - 0.25)
    # hook: soft low "shrink" sweep down
    nn = int(2.0 * SR)
    tt = t_axis(nn)
    f = 400 * np.exp(-tt * 1.6) + 60
    place(sfx, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.2) * 0.18, 0.5)
    # fall: wind
    fb = bt["fall"]
    d = (fb["endMs"] - fb["startMs"]) / 1000
    nn = int(d * SR)
    place(sfx, bp(noise(nn), 200, 900) * adsr(nn, 0.6, 0.6) * 0.18, fb["startMs"] / 1000)
    # cat: purr rumble
    cb = bt["cat"]
    d = (cb["endMs"] - cb["startMs"]) / 1000
    nn = int(d * SR)
    tt = t_axis(nn)
    purr = lp(noise(nn), 120, 4) * 4 * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * tt)) * adsr(nn, 0.8, 0.5)
    place(sfx, purr * 0.5, cb["startMs"] / 1000 + 0.3)
    # ants: scuttling ticks
    ab = bt["ants"]
    st = ab["startMs"] / 1000 + 0.8
    while st < ab["endMs"] / 1000:
        place(sfx, tick(RNG.uniform(0.05, 0.14)), st)
        st += RNG.uniform(0.015, 0.06)
    # storm: thunder + rain bed + heavy drop impacts (shared with visuals)
    rb = bt["rain"]
    rs = rb["startMs"] / 1000
    re = bt["outro"]["startMs"] / 1000
    place(sfx, thunder(), rs + 0.05)
    nn = int((re - rs + 0.8) * SR)
    rain = bp(noise(nn), 1200, 9000) * 0.06 + lp(noise(nn), 400) * 0.08
    place(sfx, rain * adsr(nn, 1.0, 0.8), rs)
    impacts = []
    st = rs + 1.4
    while st < re - 0.4:
        impacts.append(round(st * 1000))
        place(sfx, drop_impact(RNG.uniform(0.35, 0.6)), st)
        st += RNG.uniform(0.45, 0.85)
    return sfx, impacts


# ---------------------------------------------------------------- main
def main():
    WORK.mkdir(parents=True, exist_ok=True)
    OUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    script = json.loads(SCRIPT.read_text())

    print("1/4 narration (Kokoro TTS)")
    clips = tts(script)

    beats = []
    cursor = script["leadInMs"]
    for b, clip in zip(script["beats"], clips):
        dur = len(clip) / SR * 1000
        beats.append({"id": b["id"], "voiceStartMs": round(cursor), "voiceEndMs": round(cursor + dur)})
        cursor += dur + script["gapMs"]
    total_ms = beats[-1]["voiceEndMs"] + script["outroHoldMs"]
    for i, b in enumerate(beats):
        b["startMs"] = 0 if i == 0 else b["voiceStartMs"] - 150
        b["endMs"] = beats[i + 1]["voiceStartMs"] - 150 if i + 1 < len(beats) else total_ms

    voice = np.zeros(int(total_ms / 1000 * SR) + SR)
    for b, clip in zip(beats, clips):
        place(voice, clip, b["voiceStartMs"] / 1000)
    sf.write(WORK / "voice.wav", voice, SR)

    print("2/4 word timestamps (faster-whisper)")
    from faster_whisper import WhisperModel

    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    words = []
    for b, sb in zip(beats, script["beats"]):
        words += align_to_script(sb["text"], words_for(b["id"], b["voiceStartMs"], model))

    print("3/4 music + sfx")
    total_s = len(voice) / SR
    music = build_music(total_s, beats)
    sfx, impacts = build_sfx(total_s, beats)
    music_st = np.stack([music, music], 1)
    # light stereo width on sfx
    sfx_st = np.stack([sfx, np.roll(sfx, int(0.004 * SR))], 1)
    sf.write(WORK / "music.wav", (music_st / max(1e-9, np.abs(music_st).max()) * 0.8).astype(np.float32), SR)
    sf.write(WORK / "sfx.wav", (sfx_st / max(1e-9, np.abs(sfx_st).max()) * 0.8).astype(np.float32), SR)

    print("4/4 mix (ffmpeg: duck + loudnorm)")
    fc = (
        "[0:a]aformat=channel_layouts=stereo,volume=1.0,asplit=2[v][vkey];"
        "[1:a]volume=0.32[m];"
        "[m][vkey]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[mduck];"
        "[2:a]volume=0.55[s];"
        "[v][mduck][s]amix=inputs=3:normalize=0,"
        f"atrim=0:{total_ms / 1000:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[out]"
    )
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", WORK / "voice.wav", "-i", WORK / "music.wav", "-i", WORK / "sfx.wav",
         "-filter_complex", fc, "-map", "[out]", "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k", OUT_MP3],
        check=True,
    )

    TIMELINE.write_text(
        json.dumps({"totalMs": total_ms, "beats": beats, "words": words, "impactsMs": impacts}, indent=1) + "\n"
    )
    print(f"done: {total_ms / 1000:.1f}s, {len(words)} words, {len(impacts)} rain impacts -> {OUT_MP3.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
