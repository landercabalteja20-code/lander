"""Backgrounds ("sets") drawn as SVG in a 1440x1080 set space.

Each set function returns static markup. Characters are placed in the same
space; the camera then frames it. Sets are drawn a little desaturated and with
thinner lines than characters so the cast pops (like the reference).
"""
from __future__ import annotations

import math

from . import color as C
from .svgkit import (Defs, catmull, circle, ellipse, f, group, hash01, lin_grad, path, poly, rad_grad, rect)

LINE = "#5a3a52"


def _sky(defs: Defs, x, y, w, h, top="#a9d4ff", mid="#ffd9ec", bot="#ffe9c9") -> str:
    gid = defs.uid("sky")
    defs.add(lin_grad(gid, [(0, top, 1), (0.6, mid, 1), (1, bot, 1)]))
    out = [rect(x, y, w, h, fill=f"url(#{gid})")]
    for i in range(4):
        cx = x + w * (0.15 + 0.25 * i) + hash01("cl", i) * 40
        cy = y + h * (0.18 + 0.2 * hash01("cy", i))
        s = 0.6 + 0.6 * hash01("cs", i)
        out.append(_cloud(cx, cy, s))
    return "".join(out)


def _cloud(cx, cy, s) -> str:
    d = catmull([(cx - 60 * s, cy + 10 * s), (cx - 50 * s, cy - 14 * s), (cx - 20 * s, cy - 26 * s),
                 (cx + 10 * s, cy - 34 * s), (cx + 40 * s, cy - 20 * s), (cx + 64 * s, cy - 2 * s),
                 (cx + 56 * s, cy + 14 * s)], closed=True)
    return path(d, fill="#ffffff", opacity=0.85)


def _wallpaper(defs: Defs, x, y, w, h, base, accent, motif="dots", opacity=0.25) -> str:
    gid = defs.uid("wall")
    defs.add(lin_grad(gid, [(0, C.lighten(base, 0.04), 1), (1, C.shade(base, 0.05), 1)]))
    out = [rect(x, y, w, h, fill=f"url(#{gid})")]
    pid = defs.uid("pat")
    if motif == "hearts":
        tile = (f'<path d="M20 30 C8 22 10 12 20 16 C30 12 32 22 20 30 Z" fill="{accent}" opacity="{f(opacity)}"/>'
                f'<circle cx="0" cy="0" r="2.5" fill="{accent}" opacity="{f(opacity)}"/>')
        size = 44
    elif motif == "stripes":
        tile = f'<rect x="0" y="0" width="18" height="60" fill="{accent}" opacity="{f(opacity)}"/>'
        size = 60
    else:
        tile = (f'<circle cx="10" cy="10" r="3" fill="{accent}" opacity="{f(opacity)}"/>'
                f'<circle cx="30" cy="30" r="3" fill="{accent}" opacity="{f(opacity)}"/>')
        size = 40
    defs.add(f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="{size}" height="{size}">{tile}</pattern>')
    out.append(rect(x, y, w, h, fill=f"url(#{pid})"))
    return "".join(out)


def _neon_heart(defs: Defs, cx, cy, s, col="#ff4fb8") -> str:
    d = (f"M{f(cx)} {f(cy + 40 * s)} C{f(cx - 70 * s)} {f(cy)} {f(cx - 45 * s)} {f(cy - 48 * s)} {f(cx)} {f(cy - 20 * s)} "
         f"C{f(cx + 45 * s)} {f(cy - 48 * s)} {f(cx + 70 * s)} {f(cy)} {f(cx)} {f(cy + 40 * s)} Z")
    return (path(d, fill="none", stroke=col, stroke_width=16 * s, opacity=0.55, filter="url(#glow12)")
            + path(d, fill="none", stroke=C.lighten(col, 0.25), stroke_width=6 * s)
            + path(d, fill="none", stroke="#ffffff", stroke_width=2 * s, opacity=0.8))


def _fairy_lights(x0, x1, y, sag, n, t_seed="fl") -> str:
    pts = [(x0 + (x1 - x0) * i / 20, y + sag * math.sin(math.pi * i / 20)) for i in range(21)]
    out = [path(catmull(pts), fill="none", stroke="#6b5a4a", stroke_width=1.6)]
    for i in range(n):
        u = (i + 0.5) / n
        px = x0 + (x1 - x0) * u
        py = y + sag * math.sin(math.pi * u) + 8
        col = ["#ffe58a", "#ffb8e0", "#bff3ff"][i % 3]
        out.append(circle(px, py, 14, fill=col, opacity=0.35, filter="url(#glow8)"))
        out.append(circle(px, py, 5, fill=col))
    return "".join(out)


def _plant(x, y, s=1.0) -> str:
    out = []
    for i in range(9):
        a = -150 + i * 15 + hash01("pl", i) * 8
        ln = (110 + 50 * hash01("pll", i)) * s
        ex = x + math.cos(math.radians(a)) * ln
        ey = y - 60 * s + math.sin(math.radians(a)) * ln
        mx = (x + ex) / 2 + 10 * s
        my = (y - 60 * s + ey) / 2 - 20 * s
        out.append(path(catmull([(x, y - 60 * s), (mx - 14 * s, my), (ex, ey), (mx + 14 * s, my + 10 * s)], closed=True),
                        fill="#6fbf8c" if i % 2 else "#58a978", stroke="#2f5b45", stroke_width=1.8))
    out.append(path(poly([(x - 46 * s, y - 70 * s), (x + 46 * s, y - 70 * s), (x + 36 * s, y + 20 * s), (x - 36 * s, y + 20 * s)]),
                    fill="#ff9fcf", stroke=LINE, stroke_width=2))
    out.append(rect(x - 52 * s, y - 84 * s, 104 * s, 18 * s, 6, fill="#ffb8dc", stroke=LINE, stroke_width=2))
    return "".join(out)


def _window(defs: Defs, x, y, w, h, sky=("#9fd0ff", "#ffd9ec", "#ffe9c9"), curtains="#ffffff", city=True) -> str:
    out = [rect(x - 14, y - 14, w + 28, h + 28, 10, fill="#fff7fb", stroke=LINE, stroke_width=2.5)]
    out.append(_sky(defs, x, y, w, h, *sky))
    if city:
        for i in range(7):
            bw = w / 7
            bh = h * (0.25 + 0.35 * hash01("bh", i, x))
            bx = x + i * bw
            col = ["#c9b8e8", "#f2b8d4", "#b8d4f2", "#f6d2b8"][i % 4]
            out.append(rect(bx, y + h - bh, bw - 4, bh, fill=col, opacity=0.8))
            for r in range(int(bh // 26)):
                for c in range(2):
                    out.append(rect(bx + 8 + c * (bw / 2 - 2), y + h - bh + 10 + r * 26, bw / 4, 12, fill="#ffffff", opacity=0.55))
    gid = defs.uid("sun")
    defs.add(rad_grad(gid, [(0, "#fff6d6", 0.9), (1, "#fff6d6", 0)]))
    out.append(circle(x + w * 0.75, y + h * 0.25, h * 0.35, fill=f"url(#{gid})"))
    # mullions
    out.append(rect(x + w / 2 - 6, y, 12, h, fill="#fff7fb", stroke=LINE, stroke_width=2))
    out.append(rect(x, y + h * 0.45 - 6, w, 12, fill="#fff7fb", stroke=LINE, stroke_width=2))
    # sheer curtains
    for side in (0, 1):
        cx = x - 30 if side == 0 else x + w + 30
        dirn = 1 if side == 0 else -1
        pts = [(cx, y - 40), (cx + dirn * w * 0.32, y - 40), (cx + dirn * w * 0.22, y + h * 0.5), (cx + dirn * w * 0.3, y + h + 40),
               (cx, y + h + 40)]
        out.append(path(catmull(pts, closed=True, tension=0.6), fill=curtains, opacity=0.78, stroke=LINE, stroke_width=1.5))
        for k in range(3):
            fx = cx + dirn * (14 + k * 26)
            out.append(path(f"M{f(fx)} {f(y - 30)} Q{f(fx + dirn * 8)} {f(y + h * 0.5)} {f(fx + dirn * 4)} {f(y + h + 30)}",
                            fill="none", stroke="#e6cfe0", stroke_width=2))
    out.append(rect(x - 60, y - 52, w + 120, 14, 7, fill="#d7b6cf", stroke=LINE, stroke_width=1.5))
    return "".join(out)


def _vanity_mirror(defs: Defs, cx, cy, w, h) -> str:
    out = [rect(cx - w / 2 - 30, cy - h / 2 - 30, w + 60, h + 60, 40, fill="#fff2f8", stroke=LINE, stroke_width=2.5)]
    gid = defs.uid("mir")
    defs.add(lin_grad(gid, [(0, "#eaf6ff", 1), (1, "#d6e6f5", 1)], x2=1, y2=1))
    out.append(rect(cx - w / 2, cy - h / 2, w, h, 26, fill=f"url(#{gid})", stroke=LINE, stroke_width=2))
    out.append(path(f"M{f(cx - w * 0.3)} {f(cy - h * 0.4)} L{f(cx - w * 0.1)} {f(cy - h * 0.4)} L{f(cx - w * 0.38)} {f(cy + h * 0.1)} "
                    f"L{f(cx - w * 0.45)} {f(cy + h * 0.1)} Z", fill="#ffffff", opacity=0.6))
    n = 5
    for side in (-1, 1):
        for i in range(n):
            by = cy - h / 2 + (i + 0.5) * h / n
            bx = cx + side * (w / 2 + 15)
            out.append(circle(bx, by, 26, fill="#fff3b0", opacity=0.45, filter="url(#glow12)"))
            out.append(circle(bx, by, 11, fill="#fffbe0", stroke="#d9b45a", stroke_width=2))
    for i in range(4):
        bx = cx - w / 2 + (i + 0.5) * w / 4
        by = cy - h / 2 - 15
        out.append(circle(bx, by, 26, fill="#fff3b0", opacity=0.45, filter="url(#glow12)"))
        out.append(circle(bx, by, 11, fill="#fffbe0", stroke="#d9b45a", stroke_width=2))
    return "".join(out)


def bedroom(defs: Defs) -> str:
    W, H = 1440, 1080
    out = [_wallpaper(defs, 0, 0, W, 860, "#ffd3e6", "#ffffff", "hearts", 0.45)]
    out.append(rect(0, 820, W, 40, fill="#fff0f7", stroke=LINE, stroke_width=2))  # baseboard
    fid = defs.uid("floor")
    defs.add(lin_grad(fid, [(0, "#e9dcf7", 1), (1, "#d7c4ee", 1)]))
    out.append(rect(0, 860, W, 220, fill=f"url(#{fid})"))
    out.append(ellipse(720, 990, 520, 90, fill="#ffffff", opacity=0.9, stroke="#e7d7ef", stroke_width=3))
    for i in range(40):
        a = i / 40 * 2 * math.pi
        out.append(circle(720 + math.cos(a) * 515, 990 + math.sin(a) * 88, 9, fill="#ffffff"))
    out.append(_window(defs, 70, 170, 330, 470))
    out.append(_vanity_mirror(defs, 720, 400, 300, 380))
    out.append(_fairy_lights(-20, 1460, 40, 70, 22))
    out.append(_neon_heart(defs, 1180, 260, 1.4))
    # bed (right)
    out.append(path(catmull([(1020, 860), (1010, 520), (1060, 470), (1440, 470), (1440, 860)], closed=True, tension=0.4),
                    fill="#ff9fcd", stroke=LINE, stroke_width=2.5))
    for i in range(3):
        for j in range(4):
            out.append(circle(1080 + j * 100, 540 + i * 90, 6, fill="#e46fa8"))
    out.append(path(catmull([(980, 860), (990, 690), (1440, 680), (1440, 860)], closed=True, tension=0.3), fill="#cdb6ff",
                    stroke=LINE, stroke_width=2.5))
    out.append(path(catmull([(1050, 690), (1060, 620), (1180, 610), (1200, 680)], closed=True), fill="#ffffff", stroke=LINE,
                    stroke_width=2))
    out.append(path(catmull([(1210, 690), (1220, 615), (1350, 606), (1370, 680)], closed=True), fill="#ffe0f0", stroke=LINE,
                    stroke_width=2))
    # nightstand + lamp (left of bed)
    out.append(rect(880, 720, 120, 140, 8, fill="#fff7fb", stroke=LINE, stroke_width=2))
    out.append(rect(895, 770, 90, 8, 4, fill="#e8c9dd"))
    out.append(path(poly([(905, 640), (975, 640), (995, 700), (885, 700)]), fill="#fff1a8", stroke=LINE, stroke_width=2))
    out.append(rect(935, 700, 10, 20, fill="#c9a1c0"))
    out.append(_plant(250, 860, 1.1))
    # shelf + books
    out.append(rect(440, 240, 120, 12, 4, fill="#fff7fb", stroke=LINE, stroke_width=2))
    for i, c in enumerate(["#9fd8ff", "#ffb3d9", "#c9b6ff", "#fff1a8"]):
        out.append(rect(448 + i * 26, 172 + (i % 2) * 8, 20, 68 - (i % 2) * 8, 3, fill=c, stroke=LINE, stroke_width=1.5))
    return "".join(out)


def cafe(defs: Defs) -> str:
    W, H = 1440, 1080
    out = [_wallpaper(defs, 0, 0, W, 860, "#fff1e6", "#ffc1d9", "stripes", 0.35)]
    out.append(rect(0, 560, W, 300, fill="#ffb8d4", stroke=LINE, stroke_width=2))  # wainscot
    for i in range(16):
        out.append(rect(20 + i * 90, 590, 60, 230, 8, fill="none", stroke="#e88fb5", stroke_width=3))
    # checker floor
    out.append(rect(0, 860, W, 220, fill="#ffffff"))
    for r in range(5):
        y0 = 860 + r * 44
        for c in range(-2, 18):
            if (r + c) % 2:
                x0 = c * 90 + (r * 18)
                out.append(path(poly([(x0, y0), (x0 + 90, y0), (x0 + 90 + 18, y0 + 44), (x0 + 18, y0 + 44)]), fill="#ffc9df"))
    # big back windows with street
    for wx in (80, 560):
        out.append(_window(defs, wx, 130, 360, 340, sky=("#bfe2ff", "#ffe3f0", "#fff0d9"), curtains="none"))
    # menu board
    out.append(rect(1010, 110, 360, 250, 14, fill="#3a3340", stroke="#c9a46a", stroke_width=10))
    for i in range(5):
        out.append(rect(1040, 160 + i * 38, 160 + hash01("m", i) * 100, 10, 5, fill="#ffffff", opacity=0.75))
        out.append(rect(1300, 160 + i * 38, 40, 10, 5, fill="#ffd36a", opacity=0.85))
    # pendant lamps
    for lx in (330, 760, 1190):
        out.append(f'<line x1="{lx}" y1="0" x2="{lx}" y2="70" stroke="{LINE}" stroke-width="2"/>')
        out.append(circle(lx, 110, 70, fill="#fff3b0", opacity=0.35, filter="url(#glow12)"))
        out.append(path(f"M{lx - 50} 110 Q{lx} 40 {lx + 50} 110 Z", fill="#ff9fcd", stroke=LINE, stroke_width=2))
        out.append(ellipse(lx, 112, 16, 7, fill="#fffbe0"))
    # counter (front right)
    out.append(rect(860, 640, 600, 240, 10, fill="#ff8fc4", stroke=LINE, stroke_width=3))
    out.append(rect(850, 620, 620, 30, 8, fill="#fff2f8", stroke=LINE, stroke_width=2.5))
    out.append(rect(900, 500, 320, 120, 10, fill="#e9f7ff", opacity=0.75, stroke=LINE, stroke_width=2.5))  # display case
    for i in range(5):
        cx = 940 + i * 60
        out.append(rect(cx - 18, 575, 36, 30, 6, fill="#c98a5a", stroke=LINE, stroke_width=1.5))
        out.append(path(catmull([(cx - 22, 578), (cx - 16, 552), (cx, 540), (cx + 16, 552), (cx + 22, 578)], closed=True),
                        fill=["#ffb3d9", "#fff1a8", "#c9b6ff", "#b8f0d8", "#ffd1a8"][i], stroke=LINE, stroke_width=1.5))
        out.append(circle(cx, 538, 5, fill="#ff4f7a"))
    # espresso machine
    out.append(rect(1270, 500, 150, 120, 12, fill="#dfe6ef", stroke=LINE, stroke_width=2.5))
    out.append(rect(1290, 520, 110, 30, 6, fill="#ff9fcd", stroke=LINE, stroke_width=1.5))
    out.append(_plant(70, 860, 0.9))
    # little table
    out.append(ellipse(520, 760, 110, 24, fill="#fff7fb", stroke=LINE, stroke_width=2.5))
    out.append(rect(512, 770, 16, 120, fill="#c9a1c0", stroke=LINE, stroke_width=1.5))
    out.append(ellipse(520, 890, 60, 12, fill="#c9a1c0"))
    out.append(rect(480, 728, 30, 30, 6, fill="#ffffff", stroke=LINE, stroke_width=1.5))  # cup
    out.append(path("M480 734 Q495 724 510 734", fill="none", stroke="#c98a5a", stroke_width=4))
    return "".join(out)


def street(defs: Defs) -> str:
    W, H = 1440, 1080
    out = [_sky(defs, 0, 0, W, 760, "#9ccfff", "#ffd6ea", "#ffe8cc")]
    cols = ["#f7b9d3", "#c8b6f0", "#ffd9a8", "#b8e0f5", "#f7c6b9", "#d6f0c0"]
    x = -40
    i = 0
    while x < W + 40:
        bw = 220 + hash01("bw", i) * 90
        bh = 420 + hash01("bh", i) * 260
        col = cols[i % len(cols)]
        out.append(rect(x, 760 - bh, bw, bh + 10, fill=col, stroke=LINE, stroke_width=2.5))
        out.append(rect(x - 6, 760 - bh - 16, bw + 12, 20, 4, fill=C.shade(col, 0.1), stroke=LINE, stroke_width=2))
        for r in range(int((bh - 160) // 70)):
            for c in range(int(bw // 70)):
                wx, wy = x + 22 + c * 70, 760 - bh + 30 + r * 70
                out.append(rect(wx, wy, 40, 46, 4, fill="#eaf6ff", stroke=LINE, stroke_width=1.6))
                out.append(rect(wx, wy + 40, 40, 6, fill="#ffffff"))
        x += bw
        i += 1
    # café storefront (center)
    out.append(rect(520, 470, 420, 300, fill="#fff2f8", stroke=LINE, stroke_width=3))
    for k in range(8):
        out.append(path(poly([(510 + k * 55, 440), (565 + k * 55, 440), (565 + k * 55, 500), (510 + k * 55, 500)]),
                        fill="#ff6fb0" if k % 2 == 0 else "#ffffff", stroke=LINE, stroke_width=1.5))
    out.append(path("M505 500 " + " ".join(f"Q{f(532 + k * 55)} 530 {f(560 + k * 55)} 500" for k in range(8)), fill="none",
                    stroke=LINE, stroke_width=2))
    out.append(rect(560, 540, 160, 190, 6, fill="#cfeaff", stroke=LINE, stroke_width=2.5))
    out.append(rect(760, 540, 140, 230, 6, fill="#ff9fcd", stroke=LINE, stroke_width=2.5))
    out.append(circle(880, 660, 6, fill="#ffd36a"))
    out.append(text_el("Café", 640, 615, 44, "Pacifico", "#ff4fae", stroke="#ffffff", sw=6))
    # trees
    for tx in (160, 1300):
        out.append(rect(tx - 10, 600, 20, 170, fill="#9b6b4a", stroke=LINE, stroke_width=2))
        out.append(circle(tx, 560, 90, fill="#8fd6a0", stroke="#3f7a55", stroke_width=2.5))
        out.append(circle(tx - 50, 600, 60, fill="#7cc98f", stroke="#3f7a55", stroke_width=2.5))
        out.append(circle(tx + 55, 595, 62, fill="#7cc98f", stroke="#3f7a55", stroke_width=2.5))
    # sidewalk + street
    out.append(rect(0, 760, W, 150, fill="#efe6ee", stroke=LINE, stroke_width=2.5))
    for k in range(12):
        out.append(f'<line x1="{k * 130}" y1="760" x2="{k * 130 - 40}" y2="910" stroke="#d9cbd8" stroke-width="2"/>')
    out.append(rect(0, 900, W, 20, fill="#d9cbd8", stroke=LINE, stroke_width=2))
    out.append(rect(0, 920, W, 160, fill="#8b8396"))
    for k in range(8):
        out.append(rect(40 + k * 190, 990, 110, 12, 6, fill="#fff3b0"))
    # street lamp
    out.append(rect(1150, 480, 12, 290, fill="#5a4a66"))
    out.append(circle(1156, 470, 40, fill="#fff3b0", opacity=0.5, filter="url(#glow12)"))
    out.append(path("M1130 480 Q1156 440 1182 480 Z", fill="#5a4a66"))
    return "".join(out)


def text_el(txt: str, x: float, y: float, size: float, family: str, fill: str, stroke: str | None = None, sw: float = 0,
            anchor: str = "start", weight: str = "normal", opacity: float = 1.0, extra: str = "") -> str:
    st = f' stroke="{stroke}" stroke-width="{f(sw)}" stroke-linejoin="round" paint-order="stroke"' if stroke else ""
    safe = txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return (f'<text x="{f(x)}" y="{f(y)}" font-family="{family}" font-size="{f(size)}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" opacity="{f(opacity)}"{st} {extra}>{safe}</text>')


def sparkle_bg(defs: Defs, c1="#ff5fb8", c2="#ffb3e0") -> str:
    gid = defs.uid("sp")
    defs.add(rad_grad(gid, [(0, c2, 1), (1, c1, 1)], cx=0.5, cy=0.45, r=0.75))
    out = [rect(0, 0, 1440, 1080, fill=f"url(#{gid})")]
    pid = defs.uid("chk")
    defs.add(f'<pattern id="{pid}" patternUnits="userSpaceOnUse" width="80" height="80">'
             f'<rect width="40" height="40" fill="#ffffff" opacity="0.08"/><rect x="40" y="40" width="40" height="40" '
             f'fill="#ffffff" opacity="0.08"/></pattern>')
    out.append(rect(0, 0, 1440, 1080, fill=f"url(#{pid})"))
    return "".join(out)


SETS = {"bedroom": bedroom, "cafe": cafe, "street": street, "sparkle": sparkle_bg}
