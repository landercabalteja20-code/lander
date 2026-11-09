"""Extra hairstyles: Blair's thin-hair styles (with wind + volume physics) and the friends' voluminous styles.

Thin hair is built from narrow separate *locks* with gaps between them (so the background shows through),
a flat cap hugging the skull, a visible part and a few flyaways. The density never changes between
styles - only the arrangement (consistency rule from the script).
"""
from __future__ import annotations

import math
from typing import Sequence

from . import color as C
from .svgkit import (Pt, catmull, circle, clamp, ellipse, f, group, hash01, lerp, lerp_pt, path, poly,
                     resample, sample_catmull, tapered)


# ------------------------------------------------------------------ primitives
def _offset(center: Sequence[Pt], widths: Sequence[float], u: float, n: int = 28) -> list[Pt]:
    """Dense polyline offset from a centerline by u * half-width (u in -1..1)."""
    dense = resample(sample_catmull(center, 6), n)
    m = len(widths)
    out = []
    for i, p in enumerate(dense):
        a = dense[max(0, i - 1)]
        b = dense[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-6
        nx, ny = -dy / L, dx / L
        pos = i / (n - 1) * (m - 1)
        j = min(m - 2, int(pos))
        w = lerp(widths[j], widths[j + 1], pos - j)
        out.append((p[0] + nx * w / 2 * u, p[1] + ny * w / 2 * u))
    return out


def lock(center: Sequence[Pt], widths: Sequence[float], tones: dict, lw: float, strands: int = 3, seed: str = "l",
         sheen: bool = True, fill: str | None = None, ink_w: float = 2.2) -> str:
    d = tapered(center, widths=widths)
    out = [path(d, fill=fill or tones["base"])]
    out.append(path(catmull(_offset(center, widths, -0.55)[1:-2]), fill="none", stroke=tones["shadow"],
                    stroke_width=max(1.0, min(widths) * 0.6 + 2) * lw * 0.9, opacity=0.6, stroke_linecap="round"))
    for k in range(strands):
        u = -0.6 + 1.2 * (k + 0.5) / strands + (hash01(seed, k) - 0.5) * 0.2
        pts = _offset(center, widths, u)
        a = int(hash01(seed, "a", k) * 4)
        b = len(pts) - 1 - int(hash01(seed, "b", k) * 6)
        out.append(path(catmull(pts[a:b:2] + [pts[b]]), fill="none", stroke=tones["strand"], stroke_width=1.2 * lw,
                        opacity=0.75, stroke_linecap="round"))
    if sheen:
        pts = _offset(center, widths, 0.25)
        out.append(path(catmull(pts[2:9]), fill="none", stroke=tones["sheen"], stroke_width=3.2 * lw, opacity=0.8,
                        stroke_linecap="round"))
    out.append(path(d, fill="none", stroke=tones["ink"], stroke_width=ink_w * lw, stroke_linejoin="round"))
    return "".join(out)


def _wind(pts: Sequence[Pt], root_y: float, w: float, t: float, seed: float, side: int, length: float = 300) -> list[Pt]:
    """Blow hair *backward*: in a front view the locks fan out to the sides and lift, with flutter."""
    if w <= 0.001:
        return list(pts)
    out = []
    for i, (x, y) in enumerate(pts):
        k = clamp((y - root_y) / length) ** 1.1
        flut = math.sin(t * 17 + i * 0.9 + seed) * 7 + math.sin(t * 9.3 + seed * 2) * 4
        out.append((x + side * w * k * 150 + w * k * flut, y - w * k * (95 + 20 * math.sin(t * 6 + seed))))
    return out


def _fluff(pts: Sequence[Pt], root_y: float, fl: float, side: int, t: float, seed: float) -> list[Pt]:
    if abs(fl) <= 0.001:
        return list(pts)
    out = []
    for i, (x, y) in enumerate(pts):
        k = clamp((y - root_y) / 260)
        wave = math.sin(y * 0.055 + seed) * 9 * max(0.0, fl)
        out.append((x + side * fl * (16 + 34 * math.sin(math.pi * min(1.0, k * 1.2))) + wave * k, y - max(0.0, fl) * 14 * k))
    return out


def _sway(pts: Sequence[Pt], root_y: float, t: float, seed: float, amp: float = 3.5) -> list[Pt]:
    return [(x + amp * clamp((y - root_y) / 300) ** 1.4 * math.sin(t * 2.1 + seed), y) for x, y in pts]


# ------------------------------------------------------------------ thin hair (Blair)
TH_SIDE = [  # (centerline, widths) for the viewer-right side; mirrored for the left
    ([(100, -98), (110, -40), (114, 30), (118, 110), (122, 190), (126, 250)], [13, 17, 17, 15, 11, 3]),
    ([(116, -104), (126, -30), (131, 60), (135, 150), (139, 232), (141, 290)], [15, 19, 19, 17, 11, 3]),
    ([(124, -64), (136, 10), (143, 100), (149, 196), (151, 262)], [11, 15, 15, 11, 3]),
]
TH_BACK = [
    ([(-104, -140), (-140, -40), (-150, 80), (-158, 200), (-160, 300)], [26, 30, 28, 22, 6]),
    ([(104, -140), (142, -38), (152, 82), (159, 202), (161, 304)], [26, 30, 28, 22, 6]),
]


def _fan_lock(px: float, side: int, k: int, fl: float, style: str) -> tuple[list[Pt], list[float]]:
    """One thin lock: starts at the part, follows the skull (ellipse arc), then falls past the shoulders."""
    cyx = [(-40, 108, 114), (-50, 116, 132), (-52, 122, 140), (-54, 128, 146)][k]
    cy, rx, ry = cyx
    rx += 18 * max(0.0, fl)
    ry += 20 * max(0.0, fl)
    a0 = math.acos(max(-0.95, min(0.95, px / rx)))
    a1 = 0.06 if side > 0 else math.pi - 0.06
    arc = []
    for i in range(5):
        a = lerp(a0, a1, i / 4)
        arc.append((math.cos(a) * rx, cy - math.sin(a) * ry))
    xs, ys = arc[-1]
    inward = -6 if style == "middle" else 0
    fall_len = [250, 262, 274, 252][k]
    fall = [(xs + side * (4 + inward), ys + 70), (xs + side * (7 + inward), ys + 150), (xs + side * (9 + inward), ys + 220),
            (xs + side * (10 + inward), ys + fall_len)]
    if style == "sidepart":
        fall = [(x + side * math.sin(y * 0.045 + k) * 10, y) for x, y in fall]
        fall[-1] = (fall[-1][0] - side * 16, fall[-1][1] - 8)
    ws = [8, 30, 38, 36, 30, 22, 16, 9, 2.5] if k else [6, 22, 30, 30, 26, 20, 15, 9, 2.5]
    return arc + fall, ws


def thin_hair(look, tones: dict, hs, t: float, lw: float, style: str) -> tuple[str, str]:
    px = {"middle": 0.0, "sidepart": -54.0, "ponytail": 0.0, "bun": 0.0}.get(style, look.part)
    w = clamp(getattr(hs, "wind", 0.0))
    fl = getattr(hs, "fluff", 0.0)
    if style in ("ponytail", "bun"):
        w_locks = 0.0
    else:
        w_locks = w
    hl_drop = -10 * w  # hairline pushed back by wind
    back, front = [], []
    # --- back locks (behind the body)
    if style not in ("ponytail", "bun"):
        for i, (c, ws) in enumerate(TH_BACK):
            side = -1 if c[0][0] < 0 else 1
            pts = _sway(_fluff(_wind(c, c[0][1], w_locks, t, i * 3.1, side), c[0][1], fl, side, t, i), c[0][1], t, i + 5)
            back.append(lock(pts, [x * (1 + 0.8 * max(0.0, fl)) for x in ws], tones, lw, strands=3, seed=f"tb{i}",
                             fill=tones["shadow"], sheen=False))
    # --- cap
    slick_ = style in ("ponytail", "bun")
    top_lift = (16 if slick_ else 4) * max(0.0, fl)
    out_r = (10 + 22 * max(0.0, fl) - 4 if slick_ else 6 + 6 * max(0.0, fl)) - 4 * min(0.0, fl)
    hair_line = [(-110, -40), (-104, -96), (-80, -132 + hl_drop), (-44, -150 + hl_drop), (px, -155 + hl_drop),
                 (44, -150 + hl_drop), (80, -132 + hl_drop), (104, -96), (110, -40)]
    outer = [(112 + out_r, -40), (114 + out_r, -112), (92 + out_r * 0.7, -168 - out_r * 0.5),
             (48, -188 - out_r - top_lift), (0, -192 - out_r - top_lift), (-48, -188 - out_r - top_lift),
             (-92 - out_r * 0.7, -168 - out_r * 0.5), (-114 - out_r, -112), (-112 - out_r, -40)]
    cap_d = catmull(hair_line) + " " + catmull(outer, move=False) + " Z"
    slick = style in ("ponytail", "bun")
    part_line = path(catmull([(px, -156 + hl_drop), (px + 2, -175), (px + 4, -194 - top_lift)]), fill="none",
                     stroke=C.mix(look.skin, "#ffffff", 0.15), stroke_width=3.0 * lw, stroke_linecap="round")
    if slick:
        cap = [path(cap_d, fill=tones["base"])]
        for k in range(9):  # strands swept back to the crown
            u = (k + 0.5) / 9
            a = hair_line[int(u * (len(hair_line) - 1))]
            tip = (lerp(-30, 30, u), -196)
            cap.append(path(catmull([a, lerp_pt(a, tip, 0.5), tip]), fill="none", stroke=tones["strand"],
                            stroke_width=1.3 * lw, opacity=0.7, stroke_linecap="round"))
        cap.append(path(catmull([(-70, -170), (-20, -184), (40, -182), (82, -164)]), fill="none", stroke=tones["sheen"],
                        stroke_width=9 * lw, opacity=0.75, stroke_linecap="round"))
        cap.append(path(cap_d, fill="none", stroke=tones["ink"], stroke_width=2.3 * lw, stroke_linejoin="round"))
    else:
        # thin locks fan out from the part over the skull, then separate below the ears
        cap = [path(cap_d, fill=tones["shadow"])]
        for side in (1, -1):
            for k in (3, 2, 1, 0):
                pts, ws = _fan_lock(px, side, k, fl, style)
                fall_i = 5
                head, fall = pts[:fall_i], pts[fall_i:]
                fall = _wind(fall, head[-1][1], w_locks, t, k * 1.7 + side, side)
                fall = _fluff(fall, head[-1][1], fl, side, t, k + side)
                fall = _sway(fall, head[-1][1], t, k * 2 + side)
                if w_locks > 0:  # lift the arc a little so the hairline reads as pushed back
                    head = [(x + side * w_locks * 6 * (i / fall_i), y - w_locks * 5 * (i / fall_i))
                            for i, (x, y) in enumerate(head)]
                wf = 1 + 0.8 * max(0.0, fl) + 0.15 * min(0.0, fl)
                cap.append(lock(head + fall, [x * wf for x in ws], tones, lw, strands=3, seed=f"fn{side}{k}",
                                sheen=k == 0, ink_w=1.7))
        cap.append(part_line)
    locks = []
    # --- style extras
    extra_back, extra_front = [], []
    if style == "ponytail":
        tail = [(52, -192), (120, -188), (166, -140), (176, -40), (172, 70), (164, 170)]
        tail = _sway(_wind(tail, -190, w * 0.6, t, 9, 1), -190, t, 9, 6)
        extra_back.append(lock(tail, [26, 30, 26, 20, 12, 3], tones, lw, strands=4, seed="pt"))
        extra_front.append(_scrunchie(56, -192, 15, "#ff8fc8", lw))
        for s in (-1, 1):  # baby hairs
            extra_front.append(path(catmull([(s * 64, -142), (s * 72, -136), (s * 70, -130), (s * 76, -128)]),
                                    fill="none", stroke=tones["ink"], stroke_width=1.1 * lw, opacity=0.6))
    if style == "bun":
        bx, by = 0, -212
        for k in range(6):
            a = k / 6 * 2 * math.pi + 0.4
            extra_front.append(circle(bx + math.cos(a) * 12, by + math.sin(a) * 9, 13, fill=tones["base"],
                                      stroke=tones["ink"], stroke_width=2 * lw))
        extra_front.append(circle(bx, by, 13, fill=tones["light"]))
        extra_front.append(_scrunchie(bx, by + 18, 13, "#ff8fc8", lw))
        for s in (-1, 1):  # face-framing wisps
            wisp = [(s * 96, -110), (s * 106, -60), (s * 102, -10), (s * 110, 40)]
            extra_front.append(path(catmull(_wind(wisp, -110, w, t, s, s)), fill="none", stroke=tones["base"],
                                    stroke_width=4 * lw, stroke_linecap="round"))
            extra_front.append(path(catmull(_wind(wisp, -110, w, t, s, s)), fill="none", stroke=tones["ink"],
                                    stroke_width=1.2 * lw, stroke_linecap="round", opacity=0.8))
    if style == "bangs":
        for side in (1, -1):
            for k in range(3):
                c = [(side * (4 + k * 7), -153), (side * (30 + k * 9), -138), (side * (58 + k * 8), -112),
                     (side * (82 + k * 6), -84), (side * (96 + k * 4), -56)]
                c = _wind(c, -153, w * 0.8, t, k + side, side, 120)
                extra_front.append(lock(c, [6, 9, 9, 7, 2], tones, lw, strands=1, seed=f"bg{side}{k}", sheen=k == 0,
                                        ink_w=1.8))
    if style == "sidepart":
        swoop = [(-50, -192), (-6, -184), (40, -166), (78, -140), (102, -108), (112, -76)]
        extra_front.append(lock(_wind(swoop, -190, w * 0.5, t, 3, 1, 200), [18, 26, 28, 24, 18, 6], tones, lw,
                                strands=4, seed="sw"))
    # flyaways (thin-hair tell)
    fly = []
    for k, (x0, y0, dx, dy) in enumerate([(60, -186, 26, -26), (-30, -196, -18, -28), (118, -84, 28, -14),
                                          (-120, -70, -26, -10), (10, -198, 8, -30)]):
        wig = math.sin(t * 3 + k) * 3
        ext = 1 + 1.8 * w
        fly.append(path(catmull([(x0, y0), (x0 + dx * 0.5 * ext + wig, y0 + dy * 0.6 * ext), (x0 + dx * ext, y0 + dy * ext)]),
                        fill="none", stroke=tones["ink"], stroke_width=1.0 * lw, opacity=0.55, stroke_linecap="round"))
    back_svg = "".join(back) + "".join(extra_back)
    front_svg = "".join(cap) + "".join(locks) + "".join(extra_front) + "".join(fly)
    return back_svg, front_svg


def _scrunchie(x: float, y: float, r: float, col: str, lw: float) -> str:
    out = []
    for k in range(8):
        a = k / 8 * 2 * math.pi
        out.append(circle(x + math.cos(a) * r * 0.75, y + math.sin(a) * r * 0.45, r * 0.42, fill=col,
                          stroke=C.ink(col), stroke_width=1.6 * lw))
    return "".join(out)


# ------------------------------------------------------------------ accessories
def accessories(names: Sequence[str], lw: float, t: float) -> str:
    out = []
    for name in names:
        if name == "pearls":
            for k in range(5):
                x, y = -96 + k * 11, -118 - k * 7
                out.append(circle(x, y, 6.2, fill="#fffaf2", stroke="#b9a99a", stroke_width=1.4 * lw))
                out.append(circle(x - 2, y - 2, 1.8, fill="#ffffff"))
        elif name == "butterflies":
            for (x, y, col, rot) in [(66, -150, "#ff7ac3", -20), (94, -122, "#7fc8ff", 10), (112, -88, "#ffd36a", 30)]:
                g = []
                for s in (-1, 1):
                    g.append(path(f"M0 0 C{f(s * 10)} -14 {f(s * 22)} -8 {f(s * 16)} 2 C{f(s * 22)} 10 {f(s * 10)} 14 0 2 Z",
                                  fill=col, stroke=C.ink(col), stroke_width=1.4 * lw, opacity=0.95))
                g.append(ellipse(0, 1, 2, 7, fill=C.ink(col)))
                flap = 1 - 0.18 * (math.sin(t * 7 + x) * 0.5 + 0.5)
                out.append(group(g, transform=f"translate({f(x)} {f(y)}) rotate({f(rot)}) scale({f(flap)} 1)"))
        elif name == "headband":
            out.append(path(catmull([(-112, -100), (-70, -168), (0, -192), (70, -168), (112, -100)]), fill="none",
                            stroke="#ff9fd6", stroke_width=9 * lw, stroke_linecap="round"))
            for k in range(7):
                x = -84 + k * 28
                out.append(circle(x, -178 + abs(x) * 0.5, 4, fill="#ffffff"))
    return "".join(out)


# ------------------------------------------------------------------ voluminous friend styles
def curly_hair(look, tones: dict, hs, t: float, lw: float) -> tuple[str, str]:
    """Big voluminous curls (shoulder length) with a curly fringe line."""
    pts = []
    n = 46
    for i in range(n):
        a = i / n * 2 * math.pi
        bump = 9 * (1 if i % 2 else -0.4)
        rx, ry = 222 + bump, 238 + bump
        wob = math.sin(t * 2 + i) * 2
        x = math.cos(a) * rx + wob
        y = -34 + math.sin(a) * ry
        y = min(y, 200 + 8 * math.sin(i * 1.7))
        pts.append((x, y))
    d = catmull(pts, closed=True, tension=1.15)
    back = [path(d, fill=tones["base"]), path(d, fill="none", stroke=tones["ink"], stroke_width=2.6 * lw)]
    for i in range(70):  # curl texture
        a = hash01("ca", i) * 2 * math.pi
        r = math.sqrt(hash01("cr", i))
        x = math.cos(a) * 200 * r
        y = -34 + math.sin(a) * 215 * r
        if abs(x) < 112 and -150 < y < 150:
            continue
        s = 9 + 5 * hash01("cs", i)
        col = tones["light"] if hash01("cc", i) > 0.6 else tones["deep"]
        back.append(path(f"M{f(x - s)} {f(y)} A{f(s)} {f(s)} 0 1 1 {f(x + s * 0.6)} {f(y + s * 0.5)}", fill="none",
                         stroke=col, stroke_width=2.6 * lw, opacity=0.85, stroke_linecap="round"))
    front = []
    fringe = [(-118, -40), (-122, -100), (-96, -150), (-50, -176), (0, -184), (50, -176), (96, -150), (122, -100),
              (118, -40), (106, -60), (96, -110), (66, -140), (30, -150), (0, -152), (-30, -150), (-66, -140),
              (-96, -110), (-106, -60)]
    fd = catmull(fringe, closed=True, tension=1.1)
    front.append(path(fd, fill=tones["base"]))
    for i in range(14):
        a = math.pi + (i + 0.5) / 14 * math.pi
        x, y = math.cos(a) * 104, -60 + math.sin(a) * 104
        front.append(path(f"M{f(x - 8)} {f(y)} A8 8 0 1 1 {f(x + 5)} {f(y + 4)}", fill="none", stroke=tones["light"],
                          stroke_width=2.4 * lw, opacity=0.8))
    front.append(path(fd, fill="none", stroke=tones["ink"], stroke_width=2.4 * lw))
    return "".join(back), "".join(front)


def blunt_bangs(look, tones: dict, t: float, lw: float) -> str:
    pts = [(-112, -60), (-108, -120), (-80, -160), (-30, -180), (30, -180), (80, -160), (108, -120), (112, -60)]
    bottom = [(112, -60), (84, -64), (56, -60), (28, -64), (0, -60), (-28, -64), (-56, -60), (-84, -64), (-112, -60)]
    d = catmull(pts) + " " + " ".join(f"L{f(x)} {f(y)}" for x, y in bottom) + " Z"
    out = [path(d, fill=tones["base"])]
    for k in range(12):
        x = -100 + k * 18
        out.append(path(f"M{f(x)} -150 Q{f(x + 3)} -110 {f(x)} -66", fill="none", stroke=tones["strand"],
                        stroke_width=1.3 * lw, opacity=0.7))
    out.append(path(catmull([(-70, -150), (-20, -164), (30, -162), (76, -146)]), fill="none", stroke=tones["sheen"],
                    stroke_width=6 * lw, opacity=0.7, stroke_linecap="round"))
    out.append(path(d, fill="none", stroke=tones["ink"], stroke_width=2.4 * lw, stroke_linejoin="round"))
    return "".join(out)
