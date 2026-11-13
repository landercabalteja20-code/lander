import sys, json, numpy as np, soundfile as sf
sys.path.insert(0, sys.argv[2]); from lines import L
from kokoro_onnx import Kokoro
M, P, SPEED = sys.argv[1], sys.argv[2], float(sys.argv[3])
k = Kokoro(f"{M}/kokoro-v1.0.onnx", f"{M}/voices-v1.0.bin")
style = k.get_voice_style("am_eric")
SPECIAL = {18: (0.92, 0.8), 90: (0.95, 0.9), 143: (0.94, 0.8), 144: (0.94, 0.8), 145: (0.92, 0.78), 155: (0.86, 0.85)}
def trim(a, sr, thr_db=-42, pad=0.03):
    env = np.abs(a); thr = 10 ** (thr_db / 20) * max(1e-6, env.max())
    idx = np.where(env > thr)[0]
    if len(idx) == 0: return a
    s = max(0, idx[0] - int(pad * sr)); e = min(len(a), idx[-1] + int(pad * sr))
    return a[s:e]
out, t, meta = [], 0.0, []
sr = 24000
for i, (sec, cap, say, gap) in enumerate(L):
    text = say or cap
    sf_, g = SPECIAL.get(i, (1.0, 1.0))
    a, sr = k.create(text, voice=style, speed=SPEED * sf_, lang="en-us")
    a = trim(a.astype(np.float32), sr) * g
    sf.write(f"{P}/lines_wav/line_{i:03d}.wav", a, sr)
    d = len(a) / sr
    meta.append({"i": i, "section": sec, "cap": cap, "say": text, "start": round(t, 3), "end": round(t + d, 3), "gap": gap})
    out.append(a); out.append(np.zeros(int(gap * sr), np.float32)); t += d + gap
nar = np.concatenate(out)
sf.write(f"{P}/narration_24k.wav", nar, sr)
json.dump(meta, open(f"{P}/timeline.json", "w"), indent=1)
words = sum(len(m["cap"].split()) for m in meta); speak = sum(m["end"] - m["start"] for m in meta)
print(f"total {t:.1f}s ({int(t//60)}:{t%60:04.1f}), speaking {speak:.1f}s, words {words}, overall {words/t*60:.0f} wpm, while talking {words/speak*60:.0f} wpm")
