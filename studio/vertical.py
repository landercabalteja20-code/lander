"""9:16 TikTok / Reels / Shorts version: hook title on top, 4:3 episode in the middle, pop-in captions below."""
from __future__ import annotations

import io
import re
import subprocess
from pathlib import Path

import resvg_py

from . import color as C
from .fx import star4
from .sets import text_el
from .svgkit import Defs, f, hash01, lin_grad, rect

VW, VH = 1080, 1920
VID_X, VID_Y, VID_W, VID_H = 24, 600, 1032, 774
CAP_Y = 1520

COLOR_WORDS = {"pink": "pink", "green": "green", "lime": "lime", "blue": "blue", "red": "red", "gold": "gold",
               "purple": "violet", "violet": "violet", "lilac": "lilac", "yellow": "sunny"}


def _ass_color(hex_: str) -> str:
    r, g, b = (int(hex_.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    return f"&H00{b:02X}{g:02X}{r:02X}&"


def _ts(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _syllables(w: str) -> int:
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w:
        return 1
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith("le"):
        n -= 1
    return max(1, n)


def captions_ass(ep, path: Path, vw: int = VW, vh: int = VH, cap_y: int = CAP_Y) -> None:
    style = ep.captions or {}
    font = style.get("font", "Titan One")
    size = int(style.get("size", 84))
    highlight = {k.lower(): v for k, v in (style.get("highlight") or {}).items()}
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {vw}
PlayResY: {vh}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},&H00FFFFFF,&H00FFFFFF,&H002A1020,&H8C2A1020,0,0,0,0,100,100,1,0,1,8,4,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for ln in ep.all_lines:
        if ln.who in ep.cast and ep.cast[ln.who].get("captions") is False:
            continue
        words = (ln.caption or ln.text).replace("...", "… ").split()
        weights = [_syllables(w) + 0.6 for w in words]
        tot = sum(weights)
        t = ln.start
        times = []
        for w in weights:
            times.append(t)
            t += ln.dur * w / tot
        # chunk into 1-3 words
        chunks, cur, cur_t = [], [], None
        for w, wt in zip(words, times):
            if cur_t is None:
                cur_t = wt
            cur.append(w)
            if len(cur) >= 3 or len(" ".join(cur)) > 13 or w[-1:] in ".?!,…":
                chunks.append((cur_t, cur))
                cur, cur_t = [], None
        if cur:
            chunks.append((cur_t, cur))
        for k, (st, ws) in enumerate(chunks):
            en = chunks[k + 1][0] if k + 1 < len(chunks) else ln.start + ln.dur + 0.15
            txt = []
            for w in ws:
                key = re.sub(r"[^a-z]", "", w.lower())
                if key in highlight:
                    txt.append("{\\c" + _ass_color(highlight[key]) + "}" + w.upper() + "{\\c&H00FFFFFF&}")
                elif key in COLOR_WORDS and not highlight:
                    txt.append("{\\c" + _ass_color(C.hair_color(COLOR_WORDS[key])) + "}" + w.upper() + "{\\c&H00FFFFFF&}")
                else:
                    txt.append(w.upper())
            body = " ".join(txt)
            fx = f"{{\\pos({vw // 2},{cap_y})\\fscx72\\fscy72\\t(0,90,\\fscx104\\fscy104)\\t(90,150,\\fscx100\\fscy100)}}"
            rows.append(f"Dialogue: 0,{_ts(st)},{_ts(en)},Cap,,0,0,0,,{fx}{body}")
    path.write_text(head + "\n".join(rows) + "\n")


def backdrop_png(ep, path: Path) -> None:
    defs = Defs()
    defs.add('<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>')
    defs.add(lin_grad("bgv", [(0, "#ffb6df", 1), (0.5, "#ff8fcf", 1), (1, "#ffc9ea", 1)]))
    out = [rect(0, 0, VW, VH, fill="url(#bgv)")]
    defs.add('<pattern id="chk" patternUnits="userSpaceOnUse" width="90" height="90"><rect width="45" height="45" '
             'fill="#ffffff" opacity="0.10"/><rect x="45" y="45" width="45" height="45" fill="#ffffff" opacity="0.10"/></pattern>')
    out.append(rect(0, 0, VW, VH, fill="url(#chk)"))
    for i in range(40):
        x, y = hash01("vx", i) * VW, hash01("vy", i) * VH
        out.append(f'<path d="{star4(x, y, 8 + 18 * hash01("vs", i))}" fill="#ffffff" opacity="{f(0.35 + 0.5 * hash01("vo", i))}"/>')
    vt = ep.data.get("vertical", {})
    lines = vt.get("title", ["WHAT IF..."])
    sizes = vt.get("sizes", [150] + [78] * (len(lines) - 1))
    y = 250
    for i, (ln, sz) in enumerate(zip(lines, sizes)):
        fill = "#ffffff" if i == 0 else "#2a1020"
        stroke = "#2a1020" if i == 0 else "#ffffff"
        out.append(text_el(ln, VW / 2, y, sz, "Titan One", fill, stroke=stroke, sw=16 if i == 0 else 12, anchor="middle"))
        y += sz * 0.95 + 18
    # framed video window with a soft shadow
    out.append(rect(VID_X - 10, VID_Y - 4, VID_W + 20, VID_H + 28, 40, fill="#2a1020", opacity=0.35, filter="url(#sh)"))
    out.append(rect(VID_X - 12, VID_Y - 12, VID_W + 24, VID_H + 24, 34, fill="#ffffff", stroke="#2a1020", stroke_width=6))
    if vt.get("footer"):
        out.append(text_el(vt["footer"], VW / 2, 1810, 46, "Fredoka", "#2a1020", anchor="middle", weight="700"))
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{VW}" height="{VH}" viewBox="0 0 {VW} {VH}">'
           f"{defs.markup()}{''.join(out)}</svg>")
    path.write_bytes(bytes(resvg_py.svg_to_bytes(svg_string=svg, font_dirs=[str(Path(__file__).resolve().parent.parent / 'assets/fonts')])))


def make_vertical(ep, src: Path, build: Path, out: Path) -> Path:
    bg = build / "vertical_bg.png"
    backdrop_png(ep, bg)
    ass = build / "captions.ass"
    captions_ass(ep, ass)
    fonts = Path(__file__).resolve().parent.parent / "assets/fonts"
    dst = out / f"{ep.name}_9x16.mp4"
    frame = build / "vid_frame.png"
    _frame_png(frame)
    fc = (f"[1:v]scale={VID_W}:{VID_H}:flags=lanczos[v];[0:v][v]overlay={VID_X}:{VID_Y}:shortest=1[a];"
          f"[a][2:v]overlay=0:0:shortest=1,ass={ass}:fontsdir={fonts},format=yuv420p[o]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(ep.fps), "-i", str(bg), "-i", str(src),
                    "-loop", "1", "-framerate", str(ep.fps), "-i", str(frame), "-filter_complex", fc, "-map", "[o]",
                    "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(ep.fps), "-c:a", "copy",
                    "-t", f"{ep.total + 0.3:.2f}", "-movflags", "+faststart", str(dst)], check=True)
    return dst


def _frame_png(path: Path) -> None:
    """Transparent overlay: white rounded border whose fill hides the video's square corners."""
    x0, y0, x1, y1 = VID_X, VID_Y, VID_X + VID_W, VID_Y + VID_H
    r = 30
    inner = (f"M{x0 + r} {y0} H{x1 - r} A{r} {r} 0 0 1 {x1} {y0 + r} V{y1 - r} A{r} {r} 0 0 1 {x1 - r} {y1} H{x0 + r} "
             f"A{r} {r} 0 0 1 {x0} {y1 - r} V{y0 + r} A{r} {r} 0 0 1 {x0 + r} {y0} Z")
    outer = f"M{x0 - 1} {y0 - 1} H{x1 + 1} V{y1 + 1} H{x0 - 1} Z"
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{VW}" height="{VH}">'
           f'<path d="{outer} {inner}" fill="#ffffff" fill-rule="evenodd"/>'
           f'<rect x="{x0 - 12}" y="{y0 - 12}" width="{VID_W + 24}" height="{VID_H + 24}" rx="34" fill="none" '
           f'stroke="#ffffff" stroke-width="14"/>'
           f'<rect x="{x0 - 18}" y="{y0 - 18}" width="{VID_W + 36}" height="{VID_H + 36}" rx="40" fill="none" '
           f'stroke="#2a1020" stroke-width="6"/></svg>')
    path.write_bytes(bytes(resvg_py.svg_to_bytes(svg_string=svg)))
