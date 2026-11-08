"""Expressive voices for the Gen Z episode (run with .venv-tts, Python 3.11).

- Migo (Gen Z): Chatterbox TTS with per-line emotion ("exaggeration"), voice cloned from a
  Filipino-English (en-PH) reference so he sounds like a Manila Gen Z.
- Tagalog speakers (Lola, Mang Tomas, Buboy): native Filipino neural voices (fil-PH) via edge-tts.

Writes tools/genz/.work/ext_XX.wav for every line whose voice engine is not "kokoro".
Results are cached by a hash of text + settings, so only changed lines are regenerated.

Run: .venv-tts/bin/python tools/genz/tts_expressive.py   (then .venv/bin/python tools/genz/build_audio.py)
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import re
import subprocess
from pathlib import Path

import certifi

# This session's HTTPS proxy re-signs TLS; trust its CA bundle (verification stays on).
_CA = Path("/root/.ccr/ca-bundle.crt")
if _CA.exists():
    certifi.where = lambda: str(_CA)  # type: ignore[assignment]

import edge_tts  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src/genz/script.json"
WORK = ROOT / "tools/genz/.work"
REF_TEXT = (
    "Okay so, honestly? I just wanted my milk tea, and now I'm stuck here. Like, what even is this place? "
    "No signal, no WiFi, nothing. This is so not the vibe."
)


def tts_text(text: str, pron: dict[str, str]) -> str:
    """What the engine reads: respell Filipino words, and turn SHOUTED words into normal case
    (emphasis comes from punctuation + the emotion setting, not from capitals)."""
    out = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).capitalize() if m.start() == 0 else m.group(1).lower(), text)
    for word, spoken in pron.items():
        out = re.sub(rf"\b{word}\b", spoken, out)
    return out


async def edge_line(text: str, voice: str, rate: str, pitch: str, out_mp3: Path):
    await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(str(out_mp3))


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    script = json.loads(SCRIPT.read_text())
    voices = script["voices"]
    pron = script.get("pronChatterbox", script.get("pron", {}))
    cache = WORK / "ext_cache.json"
    done = json.loads(cache.read_text()) if cache.exists() else {}

    todo = []
    for i, ln in enumerate(script["lines"]):
        v = voices[ln["speaker"]]
        if v.get("engine", "kokoro") == "kokoro":
            continue
        say = tts_text(ln["text"], pron) if v["engine"] == "chatterbox" else ln["text"]
        key = hashlib.sha1(json.dumps([say, v, ln.get("emotion")], sort_keys=True).encode()).hexdigest()
        out = WORK / f"ext_{i:02d}.wav"
        if done.get(str(i)) == key and out.exists():
            continue
        todo.append((i, ln, v, say, key, out))
    print(f"{len(todo)} expressive lines to generate")

    # --- native Filipino (edge-tts) -------------------------------------------------------
    for i, ln, v, say, key, out in [x for x in todo if x[2]["engine"] == "edge"]:
        mp3 = WORK / f"ext_{i:02d}.mp3"
        asyncio.run(edge_line(say, v["voice"], v.get("rate", "+0%"), v.get("pitchHz", "+0Hz"), mp3))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", "24000", out], check=True)
        done[str(i)] = key
        print(f"  edge       {i:02d} {ln['speaker']:7s} {say}")

    # --- emotional Gen Z (Chatterbox) -----------------------------------------------------
    cb = [x for x in todo if x[2]["engine"] == "chatterbox"]
    if cb:
        import torch
        import torchaudio
        from chatterbox.tts import ChatterboxTTS

        torch.set_num_threads(4)
        torch.manual_seed(1850)
        ref = WORK / "migo_ref.wav"
        if not ref.exists():
            mp3 = WORK / "migo_ref.mp3"
            asyncio.run(edge_line(REF_TEXT, voices["migo"]["ref"], "+0%", "+0Hz", mp3))
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ac", "1", "-ar", "24000", ref], check=True)
        model = ChatterboxTTS.from_pretrained(device="cpu")
        for i, ln, v, say, key, out in cb:
            ex = float(ln.get("emotion", v.get("emotion", 0.6)))
            wav = model.generate(say, audio_prompt_path=str(ref), exaggeration=ex, cfg_weight=0.3 if ex >= 0.7 else 0.5, temperature=0.8)
            torchaudio.save(str(out), wav, model.sr)
            done[str(i)] = key
            cache.write_text(json.dumps(done))
            print(f"  chatterbox {i:02d} emotion {ex:.2f}  {say}")
    cache.write_text(json.dumps(done))


if __name__ == "__main__":
    main()
