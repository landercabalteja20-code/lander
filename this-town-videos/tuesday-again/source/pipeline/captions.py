import sys, json, re
P, out, fs = sys.argv[1], sys.argv[2], float(sys.argv[3])
tl = json.load(open(f"{P}/timeline.json")); words = json.load(open(f"{P}/words.json"))
DUR = tl[-1]["end"] + 0.5
KEEP_CAPS = {41, 102}            # door sign + crowd shout keep the script's capitals
NAMES = {"clara", "claras", "tuesday", "i"}
def norm(w, line):
    w = w.strip(".,!?;:\"“”… ")
    if line in KEEP_CAPS: return w
    lw = w.lower()
    if lw in NAMES: return "I" if lw == "i" else lw.capitalize()
    return lw
def ts(t): h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60; return f"{h}:{m:02d}:{s:05.2f}"
X, Y = 540, 1392
popt = r"\fscx40\fscy40\t(0,40,\fscx115\fscy115)\t(40,100,\fscx100\fscy100)"
lines = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
         "[V4+ Styles]", "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
         f"Style: Cap,Poppins ExtraBold,{fs},&H0000FEE1,&H0000FEE1,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,4.5,0,5,20,20,0,1", "",
         "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
ws = [w for w in words if norm(w["w"], w["line"])]
for i, w in enumerate(ws):
    a = w["t"]; b = ws[i + 1]["t"] if i + 1 < len(ws) else DUR
    if b - a < 0.05: b = a + 0.05
    txt = norm(w["w"], w["line"])
    lines.append(f"Dialogue: 0,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\pos({X + 6},{Y + 8})\\1c&H000000&\\1a&H70&\\3c&H000000&\\3a&H70&\\bord5\\blur7{popt}}}{txt}")
    lines.append(f"Dialogue: 1,{ts(a)},{ts(b)},Cap,,0,0,0,,{{\\pos({X},{Y}){popt}}}{txt}")
open(out, "w").write("\n".join(lines) + "\n")
print(len(ws), "caption words")
