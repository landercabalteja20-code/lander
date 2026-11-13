import sys, json, re, wave, difflib, numpy as np
from faster_whisper import WhisperModel
P = sys.argv[1]
tl = json.load(open(f"{P}/timeline.json"))
model = WhisperModel("small.en", device="cpu", compute_type="int8", cpu_threads=4)
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))
def load(p):
    wf = wave.open(p); sr = wf.getframerate(); x = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768
    return x, sr
words_out, report = [], []
for m in tl:
    i = m["i"]
    import soundfile as sf
    a, sr = sf.read(f"{P}/lines_wav/line_{i:03d}.wav", dtype="float32")
    # resample 24k -> 16k (simple linear) for whisper
    n16 = int(len(a) * 16000 / sr); a16 = np.interp(np.linspace(0, len(a) - 1, n16), np.arange(len(a)), a).astype(np.float32)
    segs, _ = model.transcribe(a16, language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    ww = [w for s in segs for w in (s.words or [])]
    heard = " ".join(w.word.strip() for w in ww)
    say_t = m["say"].split(); cap_t = m["cap"].split()
    # 1) say tokens -> whisper times
    sm = difflib.SequenceMatcher(a=[norm(x) for x in say_t], b=[norm(w.word) for w in ww], autojunk=False)
    st = [None] * len(say_t)
    for tag, a0, a1, b0, b1 in sm.get_opcodes():
        if tag == "equal":
            for k in range(a1 - a0): st[a0 + k] = ww[b0 + k].start
        elif tag == "replace" and b1 > b0:
            for k in range(a1 - a0): st[a0 + k] = ww[b0 + min(b1 - b0 - 1, int(k * (b1 - b0) / (a1 - a0)))].start
    dur = m["end"] - m["start"]
    known = [(k, v) for k, v in enumerate(st) if v is not None]
    if not known: known = [(0, 0.0)]
    for k in range(len(st)):
        if st[k] is None:
            prev = max([kv for kv in known if kv[0] < k], default=(-1, 0.0), key=lambda kv: kv[0])
            nxt = min([kv for kv in known if kv[0] > k], default=(len(st), dur), key=lambda kv: kv[0])
            st[k] = prev[1] + (nxt[1] - prev[1]) * (k - prev[0]) / max(1, nxt[0] - prev[0])
    st[0] = min(st[0], 0.05)
    for k in range(1, len(st)): st[k] = max(st[k], st[k - 1] + 0.06)
    # 2) caption tokens -> say tokens
    sm2 = difflib.SequenceMatcher(a=[norm(x) for x in cap_t], b=[norm(x) for x in say_t], autojunk=False)
    ct = [None] * len(cap_t)
    for tag, a0, a1, b0, b1 in sm2.get_opcodes():
        if tag == "equal":
            for k in range(a1 - a0): ct[a0 + k] = st[b0 + k]
        elif tag in ("replace", "delete"):
            for k in range(a1 - a0):
                j = b0 + int(k * max(1, b1 - b0) / max(1, a1 - a0)); ct[a0 + k] = st[min(j, len(st) - 1)]
    for k in range(len(ct)):
        if ct[k] is None: ct[k] = ct[k - 1] + 0.1 if k else 0.0
    for k in range(len(ct)):
        words_out.append({"line": i, "w": cap_t[k], "t": round(m["start"] + ct[k], 3)})
    r = difflib.SequenceMatcher(a=[norm(x) for x in say_t], b=[norm(w.word) for w in ww]).ratio()
    report.append((r, i, m["say"], heard))
json.dump(words_out, open(f"{P}/words.json", "w"), indent=0)
print(len(words_out), "caption words timed")
for r, i, s, h in sorted(report)[:12]:
    print(f"{r:.2f} line {i}: SAID {s!r}\n          HEARD {h!r}")
