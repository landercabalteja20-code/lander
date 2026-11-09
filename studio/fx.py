"""Effects and full-frame inserts (phone close-up, mood chart, title/end cards)."""
from __future__ import annotations

import math

from . import color as C
from .character import _heart, skin_tones
from .sets import text_el
from .svgkit import (Defs, catmull, circle, clamp, ease_out, ease_out_back, ellipse, f, group, hash01, lerp, lin_grad,
                     path, poly, rad_grad, rect, smoothstep)

W, H = 1440, 1080


def star4(x: float, y: float, r: float, w: float | None = None) -> str:
    w = r * 0.22 if w is None else w
    return (f"M{f(x)} {f(y - r)} Q{f(x + w)} {f(y - w)} {f(x + r)} {f(y)} Q{f(x + w)} {f(y + w)} {f(x)} {f(y + r)} "
            f"Q{f(x - w)} {f(y + w)} {f(x - r)} {f(y)} Q{f(x - w)} {f(y - w)} {f(x)} {f(y - r)} Z")


def sparkles(cx: float, cy: float, rx: float, ry: float, t: float, n: int = 10, seed: str = "s", size: float = 22,
             colors=("#ffffff", "#fff3a8", "#ffc4ea"), strength: float = 1.0) -> str:
    out = []
    for i in range(n):
        a = hash01(seed, i) * 2 * math.pi
        rr = 0.35 + 0.65 * hash01(seed, "r", i)
        x = cx + math.cos(a) * rx * rr
        y = cy + math.sin(a) * ry * rr
        ph = hash01(seed, "p", i) * 6.28
        sp = 5 + 4 * hash01(seed, "v", i)
        k = max(0.0, math.sin(t * sp + ph)) ** 2 * strength
        if k < 0.04:
            continue
        r = size * (0.5 + 0.8 * hash01(seed, "z", i)) * k
        col = colors[i % len(colors)]
        out.append(circle(x, y, r * 1.1, fill=col, opacity=0.35 * k, filter="url(#glow8)"))
        out.append(path(star4(x, y, r), fill=col, opacity=min(1, 0.4 + k)))
    return "".join(out)


def burst(cx: float, cy: float, t: float, t0: float, dur: float = 0.8, n: int = 14, radius: float = 320,
          seed: str = "b", colors=("#ffffff", "#ffe066", "#ff8fd0")) -> str:
    u = (t - t0) / dur
    if u < 0 or u > 1:
        return ""
    out = []
    e = ease_out(u)
    for i in range(n):
        a = (i / n) * 2 * math.pi + hash01(seed, i) * 0.4
        d = radius * e * (0.6 + 0.5 * hash01(seed, "d", i))
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        r = 26 * (1 - u) * (0.6 + 0.6 * hash01(seed, "s", i))
        col = colors[i % len(colors)]
        out.append(path(star4(x, y, r), fill=col, opacity=1 - u * 0.7))
    out.append(circle(cx, cy, radius * 0.5 * e, fill="none", stroke="#ffffff", stroke_width=10 * (1 - u), opacity=0.8 * (1 - u)))
    return "".join(out)


def hearts(cx: float, cy: float, t: float, n: int = 6, seed: str = "h", spread: float = 220, size: float = 26,
           col: str = "#ff4fae") -> str:
    out = []
    for i in range(n):
        ph = (t * 0.55 + hash01(seed, i)) % 1.0
        x = cx + (hash01(seed, "x", i) - 0.5) * spread + math.sin(t * 3 + i) * 14
        y = cy - ph * 260
        s = size * (0.7 + 0.6 * hash01(seed, "s", i)) * (0.6 + 0.4 * smoothstep(ph * 4))
        op = smoothstep(ph * 5) * (1 - smoothstep((ph - 0.6) * 2.5))
        out.append(path(_heart(x, y, s), fill=col, stroke=C.ink(col), stroke_width=2.5, opacity=op))
        out.append(ellipse(x - s * 0.35, y - s * 0.25, s * 0.22, s * 0.14, fill="#ffffff", opacity=op * 0.8))
    return "".join(out)


def flash(t: float, t0: float, dur: float = 0.35, col: str = "#ffffff", peak: float = 0.9) -> str:
    u = (t - t0) / dur
    if u < 0 or u > 1:
        return ""
    return rect(0, 0, W, H, fill=col, opacity=peak * (1 - u) ** 2)


def speed_lines(t: float, strength: float = 1.0, col: str = "#ffffff", cx: float = W / 2, cy: float = H / 2,
                seed: str = "sl") -> str:
    if strength <= 0.01:
        return ""
    out = []
    frame = int(t * 12)  # re-randomize 12x per second (limited animation feel)
    for i in range(54):
        a = (i / 54) * 2 * math.pi + hash01(seed, frame, i) * 0.08
        r0 = 470 + hash01(seed, "r", frame, i) * 160
        r1 = 1100
        w = 6 + hash01(seed, "w", frame, i) * 16
        x0, y0 = cx + math.cos(a) * r0, cy + math.sin(a) * r0 * 0.8
        x1, y1 = cx + math.cos(a + 0.012 * w / 6) * r1, cy + math.sin(a + 0.012 * w / 6) * r1
        x2, y2 = cx + math.cos(a - 0.012 * w / 6) * r1, cy + math.sin(a - 0.012 * w / 6) * r1
        out.append(path(poly([(x0, y0), (x1, y1), (x2, y2)]), fill=col, opacity=0.85 * strength))
    return "".join(out)


def tint(col: str, op: float) -> str:
    return rect(0, 0, W, H, fill=col, opacity=op) if op > 0.005 else ""


def vignette(defs: Defs, strength: float = 0.35, col: str = "#3a0f2a") -> str:
    gid = defs.uid("vig")
    defs.add(rad_grad(gid, [(0.55, col, 0), (1, col, strength)], cx=0.5, cy=0.5, r=0.75))
    return rect(0, 0, W, H, fill=f"url(#{gid})")


def steam(cx: float, cy: float, t: float, s: float = 1.0) -> str:
    out = []
    for i in range(5):
        ph = (t * 1.3 + i / 5) % 1
        x = cx + (i - 2) * 40 * s + math.sin(t * 4 + i) * 10 * s
        y = cy - ph * 160 * s
        r = (18 + 30 * ph) * s
        out.append(circle(x, y, r, fill="#ffffff", opacity=0.75 * (1 - ph), stroke="#d9c6d6", stroke_width=2))
    return "".join(out)


def anger_mark(x: float, y: float, s: float, t: float) -> str:
    k = 1 + 0.12 * math.sin(t * 18)
    out = []
    for a in (45, 135, 225, 315):
        out.append(path(f"M{f(x)} {f(y)} Q{f(x + math.cos(math.radians(a + 20)) * 16 * s * k)} "
                        f"{f(y + math.sin(math.radians(a + 20)) * 16 * s * k)} {f(x + math.cos(math.radians(a)) * 26 * s * k)} "
                        f"{f(y + math.sin(math.radians(a)) * 26 * s * k)}", fill="none", stroke="#ff2a4a",
                        stroke_width=7 * s, stroke_linecap="round"))
    return "".join(out)


def confetti(t: float, seed: str = "cf", n: int = 70) -> str:
    out = []
    cols = ["#ff4fae", "#ffd36a", "#7ddc5a", "#6fa6ff", "#b18cff", "#ffffff"]
    for i in range(n):
        x0 = hash01(seed, i) * W
        sp = 220 + 200 * hash01(seed, "v", i)
        y = (hash01(seed, "y", i) * H * 1.3 + t * sp) % (H * 1.3) - 100
        x = x0 + math.sin(t * 3 + i) * 30
        rotd = t * 200 * (hash01(seed, "r", i) - 0.5) + i * 30
        out.append(rect(-8, -4, 16, 8, 2, fill=cols[i % len(cols)],
                        transform=f"translate({f(x)} {f(y)}) rotate({f(rotd)})"))
    return "".join(out)


def caption_box(txt: str, x: float, y: float, size: float = 64, fill="#ffffff", stroke="#2a1020", family="Titan One",
                anchor="middle", sw: float = 12, op: float = 1.0) -> str:
    return text_el(txt, x, y, size, family, fill, stroke=stroke, sw=sw, anchor=anchor, opacity=op)


# =========================================================================== inserts
def phone_insert(defs: Defs, t: float, skin: str, contact: str, messages: list[dict], nails: str = "#ff4fae",
                 glow: float = 1.0, typing: bool = False, cam_shake: float = 0.0) -> str:
    """Big hand holding a glowing phone, chat on screen. Messages appear at their `at` time."""
    st = skin_tones(skin)
    ox = math.sin(t * 1.7) * 6
    oy = math.sin(t * 1.1) * 8
    out = []
    g = []
    # neon glow behind the phone
    if glow > 0:
        g.append(rect(470, 120, 500, 900, 70, fill="none", stroke="#ff3fb4", stroke_width=40, opacity=0.5 * glow,
                      filter="url(#glow24)"))
    g.append(rect(470, 120, 500, 900, 70, fill="#7fe9d3", stroke="#2a1020", stroke_width=7))
    g.append(rect(492, 142, 456, 856, 54, fill="#5fd0bb", opacity=0.6))
    sid = defs.uid("scr")
    defs.add(lin_grad(sid, [(0, "#ffe3f3", 1), (1, "#ffc9e8", 1)]))
    g.append(rect(505, 160, 430, 820, 44, fill=f"url(#{sid})", stroke="#2a1020", stroke_width=4))
    # header
    g.append(rect(505, 160, 430, 120, 44, fill="#ff6fbf"))
    g.append(rect(505, 230, 430, 50, fill="#ff6fbf"))
    g.append(circle(570, 222, 34, fill="#ffd9ec", stroke="#ffffff", stroke_width=4))
    g.append(path(_heart(570, 224, 14), fill="#ff4fae"))
    g.append(text_el(contact, 622, 236, 40, "Fredoka", "#ffffff", weight="700"))
    g.append(path(star4(900, 220, 16), fill="#ffffff"))
    y = 380
    for m in messages:
        at = m.get("at", 0)
        if t < at:
            continue
        k = ease_out_back(clamp((t - at) / 0.25))
        txt = m["text"]
        mine = m.get("me", False)
        lines_ = _wrap(txt, 14)
        bh = 36 + 56 * len(lines_)
        bw = min(390, 48 + 26 * max(len(l) for l in lines_))
        bx = 905 - bw if mine else 535
        col = "#ff4fae" if mine else "#ffffff"
        tcol = "#ffffff" if mine else "#3a1f33"
        bub = [rect(bx, y, bw, bh, 30, fill=col, stroke="#2a1020", stroke_width=3)]
        for i, l in enumerate(lines_):
            bub.append(text_el(l, bx + 26, y + 62 + i * 56, 44, "Fredoka", tcol, weight="600"))
        cx, cy = bx + (bw if mine else 0), y + bh / 2
        g.append(group(bub, transform=f"translate({f(cx)} {f(cy)}) scale({f(k)}) translate({f(-cx)} {f(-cy)})"))
        y += bh + 26
    if typing:
        bx = 535
        g.append(rect(bx, y, 130, 70, 30, fill="#ffffff", stroke="#2a1020", stroke_width=3))
        for i in range(3):
            yy = y + 35 - max(0, math.sin(t * 9 - i * 0.9)) * 10
            g.append(circle(bx + 35 + i * 30, yy, 9, fill="#c9a9c0"))
    # thumb over the phone + fingers on the side
    hand = []
    hand.append(path(catmull([(360, 1080), (380, 820), (450, 700), (520, 690), (560, 760), (540, 900), (520, 1080)],
                             closed=True), fill=st["base"], stroke=st["ink"], stroke_width=5))
    for i in range(3):
        fy = 560 + i * 110
        hand.append(path(catmull([(940, fy), (1000, fy - 10), (1030, fy + 30), (1000, fy + 70), (940, fy + 70)], closed=True),
                         fill=st["base"], stroke=st["ink"], stroke_width=5))
        hand.append(path(catmull([(992, fy + 6), (1016, fy + 18), (1020, fy + 44), (1002, fy + 50)], closed=True),
                         fill=nails, stroke=st["ink"], stroke_width=3))
    hand.append(path(catmull([(470, 700), (540, 640), (620, 650), (640, 700), (560, 760), (500, 790)], closed=True),
                     fill=st["base"], stroke=st["ink"], stroke_width=5))
    hand.append(path(catmull([(570, 650), (612, 652), (628, 690), (600, 700)], closed=True), fill=nails, stroke=st["ink"],
                     stroke_width=3))
    out.append(group(g + hand, transform=f"translate({f(ox)} {f(oy)})"))
    return "".join(out)


def _wrap(txt: str, n: int) -> list[str]:
    words, lines_, cur = txt.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines_.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    if cur:
        lines_.append(cur)
    return lines_


def mood_chart(defs: Defs, t: float, rows: list[tuple[str, str]], title: str = "MOOD HAIR GUIDE",
               step: float = 0.22) -> str:
    """Y2K magazine-quiz page explaining what each hair color means."""
    out = []
    gid = defs.uid("mc")
    defs.add(lin_grad(gid, [(0, "#ff9fd6", 1), (1, "#ffcfe9", 1)], x2=1, y2=1))
    out.append(rect(0, 0, W, H, fill=f"url(#{gid})"))
    for i in range(30):
        x, y = hash01("mx", i) * W, hash01("my", i) * H
        out.append(path(star4(x, y, 8 + 14 * hash01("ms", i)), fill="#ffffff",
                        opacity=0.35 + 0.4 * max(0.0, math.sin(t * 4 + i))))
    k = ease_out_back(clamp(t / 0.35))
    out.append(group([rect(180, 60, 1080, 150, 75, fill="#ffffff", stroke="#2a1020", stroke_width=6),
                      text_el(title, 720, 165, 92, "Titan One", "#ff3fa4", stroke="#2a1020", sw=8, anchor="middle")],
                     transform=f"translate(720 135) scale({f(k)}) translate(-720 -135)"))
    cols = 2
    for i, (hair, label) in enumerate(rows):
        at = 0.3 + i * step
        if t < at:
            continue
        kk = ease_out_back(clamp((t - at) / 0.3))
        cx = 330 + (i % cols) * 560
        cy = 330 + (i // cols) * 220
        tones = C.hair_tones(C.hair_color(hair))
        card = [rect(cx - 150, cy - 70, 500, 170, 40, fill="#ffffff", stroke="#2a1020", stroke_width=5)]
        lock = catmull([(cx - 110, cy - 50), (cx - 60, cy - 58), (cx - 40, cy + 10), (cx - 52, cy + 80), (cx - 74, cy + 60),
                        (cx - 92, cy + 86), (cx - 104, cy + 40)], closed=True)
        card.append(path(lock, fill=tones["base"], stroke=tones["ink"], stroke_width=4))
        card.append(path(catmull([(cx - 96, cy - 40), (cx - 76, cy + 10), (cx - 84, cy + 60)]), fill="none",
                         stroke=tones["sheen"], stroke_width=6, stroke_linecap="round"))
        card.append(text_el(label, cx - 10, cy + 40, 58, "Titan One", tones["base"], stroke="#2a1020", sw=7))
        out.append(group(card, transform=f"translate({f(cx)} {f(cy)}) scale({f(kk)}) translate({f(-cx)} {f(-cy)})"))
    return "".join(out)


def title_card(defs: Defs, t: float, lines: list[str], sub: str = "", bg: str = "sparkle") -> str:
    out = []
    gid = defs.uid("tc")
    defs.add(rad_grad(gid, [(0, "#ffd1ec", 1), (1, "#ff5fb8", 1)], cx=0.5, cy=0.45, r=0.8))
    out.append(rect(0, 0, W, H, fill=f"url(#{gid})"))
    out.append(sparkles(720, 540, 700, 520, t, n=26, seed="tc", size=26))
    y0 = 540 - (len(lines) - 1) * 70
    for i, l in enumerate(lines):
        k = ease_out_back(clamp((t - i * 0.18) / 0.35))
        out.append(group(text_el(l, 720, y0 + i * 140, 128 if i == 0 else 96, "Titan One", "#ffffff", stroke="#2a1020",
                                 sw=14, anchor="middle"),
                         transform=f"translate(720 {f(y0 + i * 140)}) scale({f(k)}) translate(-720 {f(-(y0 + i * 140))})"))
    if sub:
        out.append(text_el(sub, 720, 980, 52, "Fredoka", "#2a1020", anchor="middle", weight="700",
                           opacity=clamp((t - 0.6) / 0.3)))
    return "".join(out)
