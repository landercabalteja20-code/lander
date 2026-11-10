"""Expressive TTS worker (runs inside .venv-tts, which has PyTorch + Chatterbox).

Usage: .venv-tts/bin/python studio/tts_chatterbox.py job.json
job.json = {"items": [{"text", "ref", "out", "emotion", "pace", "temperature", "seed"}]}

Chatterbox clones the timbre of `ref` (a short clean clip) and lets us push the delivery:
  emotion (exaggeration) 0.25 calm .. 1.5+ very dramatic
  pace (cfg_weight)      0.2 fast/loose .. 0.6 slower/careful
"""
import json
import sys
import time

import torch
import torchaudio
from chatterbox.tts import ChatterboxTTS


def main() -> None:
    job = json.load(open(sys.argv[1]))
    torch.set_num_threads(int(job.get("threads", 4)))
    t0 = time.time()
    model = ChatterboxTTS.from_pretrained(device="cpu")
    print(f"model loaded in {time.time() - t0:.1f}s", flush=True)
    for item in job["items"]:
        t1 = time.time()
        torch.manual_seed(int(item.get("seed", 0)))
        wav = model.generate(item["text"], audio_prompt_path=item["ref"], exaggeration=float(item.get("emotion", 0.7)),
                             cfg_weight=float(item.get("pace", 0.4)), temperature=float(item.get("temperature", 0.8)))
        torchaudio.save(item["out"], wav, model.sr)
        dur = wav.shape[-1] / model.sr
        print(f"done {dur:.2f}s audio in {time.time() - t1:.1f}s -> {item['out']}", flush=True)


if __name__ == "__main__":
    main()
