"""Parametric Y2K fashion-doll character rig, drawn as SVG.

Coordinate system (character units): head center at (0, 0) with the eye line at
y≈0, chin at y≈148, shoulders ≈205, hips ≈345, feet ≈690. The caller places the
character with a translate/scale. `lw` scales every outline so line weight can
be tuned per shot (thick-but-not-chunky lines are a big part of the look).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, fields, replace
from typing import Optional

from . import color as C
from .svgkit import (Defs, Pt, catmull, circle, clamp, ellipse, f, group, hash01, lerp, lerp_pt, lerp_pts,
                     noise1, path, poly, rad_grad, lin_grad, rect, resample, sample_catmull, tapered)

INK = "#2a1020"


# =========================================================================== data
@dataclass
class Look:
    """Static design of a character (what they look like)."""
    name: str = "girl"
    kind: str = "girl"                 # girl | boy
    skin: str = "#f2c3a3"
    eye: str = "#7b55e0"
    lips: str = "#e2557f"
    brow: str = "#3a2230"
    eyeshadow: str = "#ff9ad5"
    hair: str = "pink"                 # mood name or hex: resting hair color
    hair_style: str = "long"           # long | boy
    part: float = -8.0                 # hair part x
    top: str = "tee"                   # tee | hoodie | cardigan | varsity | apron
    top_color: str = "#ffffff"
    top_accent: str = "#ff7ac3"
    under_color: str = "#1d1a24"       # crop top under a cardigan
    bottom: str = "flare"              # flare | skirt | cargo | jeans
    bottom_color: str = "#8fb8ef"
    shoes_color: str = "#ffffff"
    earrings: str = "gold"             # gold | silver | pink | none
    choker: Optional[str] = None
    glasses_on_head: Optional[str] = None
    freckles: bool = False
    lashes: float = 1.0                # lash drama 0..1


@dataclass
class Face:
    """Animatable expression state. Every field is a float so states can be blended."""
    eye_open: float = 1.0
    wink: float = 0.0          # >0 closes viewer-right eye, <0 closes viewer-left eye
    look_x: float = 0.0
    look_y: float = 0.0
    squint: float = 0.0
    happy_eyes: float = 0.0
    pupil: float = 1.0
    sparkle: float = 0.0
    brow_raise: float = 0.0
    brow_in: float = 0.0       # + angry (inner ends down)  - worried (inner ends up)
    brow_asym: float = 0.0
    mouth_open: float = 0.0
    mouth_wide: float = 0.0
    mouth_round: float = 0.0
    smile: float = 0.1
    smirk: float = 0.0
    teeth: float = 1.0
    blush: float = 0.25
    blush_lines: float = 0.0
    teary: float = 0.0
    tears: float = 0.0
    sweat: float = 0.0
    tilt: float = 0.0          # head tilt degrees
    turn: float = 0.0          # head turn -1..1 (+ = toward viewer's right)
    nod: float = 0.0           # head vertical offset

    def blend(self, other: "Face", t: float) -> "Face":
        if t <= 0:
            return self
        if t >= 1:
            return other
        return Face(**{fl.name: lerp(getattr(self, fl.name), getattr(other, fl.name), t) for fl in fields(Face)})


EXPRESSIONS: dict[str, Face] = {
    "neutral": Face(),
    "soft": Face(eye_open=0.92, smile=0.3, blush=0.35),
    "happy": Face(eye_open=0.95, smile=0.75, blush=0.45, brow_raise=0.25, mouth_wide=0.3),
    "laugh": Face(happy_eyes=1.0, smile=0.9, mouth_open=0.55, mouth_wide=0.6, blush=0.6, brow_raise=0.4),
    "love": Face(eye_open=1.05, sparkle=1.0, smile=0.65, blush=0.95, blush_lines=0.6, brow_raise=0.35, pupil=1.15),
    "dreamy": Face(eye_open=0.7, look_y=-0.5, look_x=0.3, smile=0.55, blush=0.8, brow_raise=0.3, tilt=-5),
    "shock": Face(eye_open=1.28, pupil=0.62, brow_raise=1.0, mouth_open=0.75, mouth_round=0.85, smile=-0.1, blush=0.2),
    "gasp": Face(eye_open=1.22, pupil=0.7, brow_raise=0.9, brow_in=-0.4, mouth_open=0.45, mouth_round=0.6, smile=-0.25),
    "panic": Face(eye_open=1.25, pupil=0.6, brow_raise=0.8, brow_in=-0.8, mouth_open=0.5, mouth_wide=0.7,
                  smile=-0.55, sweat=1.0, teeth=1.0),
    "jealous": Face(eye_open=0.52, squint=0.35, look_x=0.85, brow_in=0.75, brow_raise=-0.2, smile=-0.3, smirk=-0.4,
                    blush=0.1),
    "angry": Face(eye_open=0.85, pupil=0.8, brow_in=1.0, brow_raise=-0.3, smile=-0.65, mouth_open=0.25,
                  mouth_wide=0.7, teeth=1.0, blush=0.5),
    "sad": Face(eye_open=0.75, look_y=0.45, brow_in=-1.0, smile=-0.6, teary=1.0, blush=0.45),
    "cry": Face(eye_open=0.55, squint=0.4, brow_in=-1.0, smile=-0.85, mouth_open=0.45, mouth_wide=0.5,
                teary=1.0, tears=1.0, blush=0.9),
    "smug": Face(eye_open=0.6, look_x=-0.3, brow_asym=0.9, smile=0.35, smirk=0.8, blush=0.25),
    "deadpan": Face(eye_open=0.52, brow_raise=-0.15, smile=0.0, blush=0.15),
    "embarrassed": Face(eye_open=0.85, look_x=-0.7, look_y=0.3, brow_in=-0.6, smile=0.25, mouth_wide=0.4,
                        blush=1.0, blush_lines=1.0, sweat=0.8),
    "sleepy": Face(eye_open=0.38, brow_raise=-0.25, brow_in=-0.2, smile=0.0, blush=0.3, tilt=-4),
    "yawn": Face(eye_open=0.12, brow_raise=0.3, brow_in=-0.4, mouth_open=1.0, mouth_round=0.55, smile=-0.1, teary=0.4),
    "nervous": Face(eye_open=1.0, look_x=0.6, brow_in=-0.7, smile=0.15, mouth_wide=0.6, teeth=1.0, sweat=0.9, blush=0.6),
    "confident": Face(eye_open=0.85, brow_asym=0.3, smile=0.6, smirk=0.35, blush=0.3, sparkle=0.6),
    "suspicious": Face(eye_open=0.5, squint=0.3, look_x=-0.8, brow_in=0.5, brow_asym=-0.6, smile=-0.1, smirk=-0.3),
    "squeal": Face(happy_eyes=1.0, smile=0.8, mouth_open=0.7, mouth_round=0.4, blush=1.0, blush_lines=0.8,
                   brow_raise=0.8, brow_in=-0.3),
}


def expression(name: str, **over) -> Face:
    base = EXPRESSIONS.get(name, EXPRESSIONS["neutral"])
    return replace(base, **over) if over else base


@dataclass
class HairState:
    color: str = "#ff8fcf"            # resting color (hex)
    to_color: Optional[str] = None    # color being transitioned to
    wipe: float = 0.0                 # 0..1 progress of the root-to-tip transition
    sway: float = 1.0
    glow: float = 0.0


@dataclass
class Pose:
    arms: str = "down"                # down | hip | phone | cheeks | wave | cross | hair | point | chin | shrug
    arms_to: Optional[str] = None
    arms_t: float = 0.0
    lean: float = 0.0
    phone_glow: float = 0.0


# =========================================================================== palette helpers
def skin_tones(skin: str) -> dict[str, str]:
    return {"base": skin, "shade": C.shade(skin, 0.09), "deep": C.shade(skin, 0.2),
            "ink": C.mix(C.darken(skin, 0.5), "#3a1424", 0.6), "light": C.lighten(skin, 0.07)}


# =========================================================================== geometry: face
GIRL_FACE_R = [(0, -152), (64, -144), (102, -110), (117, -52), (118, 4), (108, 52), (86, 94), (52, 121),
               (18, 134), (0, 136)]
BOY_FACE_R = [(0, -150), (60, -144), (96, -110), (108, -50), (108, 10), (101, 60), (86, 100), (58, 128),
              (26, 143), (0, 146)]


def _turn_x(x: float, depth: float, turn: float) -> float:
    side = 1 if x > 0 else -1
    squash = 1 - 0.11 * turn * side
    return x * squash + turn * depth * 30


def face_outline(kind: str, turn: float) -> list[Pt]:
    half = GIRL_FACE_R if kind == "girl" else BOY_FACE_R
    pts = half + [(-x, y) for x, y in reversed(half[1:-1])]
    out = []
    for x, y in pts:
        depth = 0.55 * (1 - min(1, abs(x) / 115)) + (0.25 if y > 60 else 0.0)
        out.append((_turn_x(x, depth, turn), y))
    return out


# ---- eyes (right eye in local coords; x>0 = outer corner side)
EYE_OPEN = [(-34, 7), (-26, -12), (-10, -25), (8, -28), (24, -21), (36, -7)]
EYE_CLOSED = [(-34, 7), (-20, 12), (-4, 13.5), (12, 11), (26, 4), (36, -7)]
EYE_HAPPY = [(-34, 9), (-22, -3), (-6, -9), (10, -9), (25, -3), (36, 4)]
EYE_LOWER = [(-34, 7), (-22, 16), (-4, 20), (14, 17), (28, 7), (36, -7)]
CREASE = [(-30, -9), (-20, -27), (-2, -39), (16, -38), (30, -27), (40, -13)]


def _eye(cx: float, cy: float, side: int, look: Look, fc: Face, openness: float, defs: Defs, lw: float,
         t: float, width_scale: float = 1.0) -> tuple[str, str]:
    """Returns (eye markup, tear markup). side=+1 viewer-right eye, -1 viewer-left eye."""
    girl = look.kind == "girl"
    sx = side * width_scale * (1.2 if girl else 0.98)
    sy = 1.2 if girl else 0.95

    def place(pts):
        return [(cx + x * sx, cy + y * sy) for x, y in pts]

    happy = clamp(fc.happy_eyes)
    o = openness * (1 - happy)
    closed_curve = lerp_pts(EYE_CLOSED, EYE_HAPPY, happy)
    upper = lerp_pts(closed_curve, EYE_OPEN, o) if o <= 1 else [
        (x, y * (1 + (o - 1) * 0.9) if i not in (0, len(EYE_OPEN) - 1) else y) for i, (x, y) in enumerate(EYE_OPEN)]
    sq = clamp(fc.squint)
    lower = [(x, y - (sq * 11 if 0 < i < len(EYE_LOWER) - 1 else 0)) for i, (x, y) in enumerate(EYE_LOWER)]
    # keep the lower lid under the upper lid
    lower = [(x, max(y, uy + 0.5) if 0 < i < len(lower) - 1 else y) for i, ((x, y), (_, uy)) in enumerate(zip(lower, upper))]
    up, lo = place(upper), place(lower)
    ink = INK
    st = skin_tones(look.skin)
    out = []
    tears_svg = ""
    if o > 0.1:
        shape_d = catmull(up) + " " + catmull(lo[::-1], move=False)
        clip_id = defs.uid("eye")
        defs.add(f'<clipPath id="{clip_id}"><path d="{shape_d} Z"/></clipPath>')
        # eyeshadow between crease and lid
        if girl and look.eyeshadow:
            crease = place([(x, lerp(y + 18, y, clamp(o))) for x, y in CREASE])
            sh_id = defs.uid("es")
            top_y = min(p[1] for p in crease)
            defs.add(lin_grad(sh_id, [(0, look.eyeshadow, 0.05), (0.45, look.eyeshadow, 0.7), (1, look.eyeshadow, 1.0)],
                              user=(0, top_y, 0, cy + 4)))
            out.append(path(catmull(crease + up[::-1]) + " Z", fill=f"url(#{sh_id})"))
            out.append(path(catmull(crease), fill="none", stroke=st["deep"], stroke_width=1.3 * lw,
                            stroke_linecap="round", opacity=0.75))
        inner = []
        inner.append(path(shape_d + " Z", fill="#fffaf9"))
        # iris
        ir = (19.5 if girl else 17.0) * sy
        ix = cx + (2 * side + fc.look_x * 12) * width_scale * (1.2 if girl else 1.0)
        iy = cy + 1 + fc.look_y * 6
        g_id = defs.uid("ir")
        defs.add(rad_grad(g_id, [(0, C.lighten(look.eye, 0.22), 1), (0.55, look.eye, 1), (1, C.darken(look.eye, 0.25), 1)],
                          user=(ix, iy + ir * 0.35, ir * 1.1)))
        inner.append(circle(ix, iy, ir, fill=f"url(#{g_id})", stroke=C.darken(look.eye, 0.35), stroke_width=1.6 * lw))
        pr = ir * 0.45 * fc.pupil
        inner.append(circle(ix, iy, pr, fill="#1a0c18"))
        # lid shadow across top of the eye
        inner.append(path(catmull(up), fill="none", stroke="#6b3e6a", stroke_width=9 * sy, opacity=0.28))
        # highlights
        hl = 1 + 0.25 * fc.sparkle
        inner.append(ellipse(ix - ir * 0.33, iy - ir * 0.38, ir * 0.27 * hl, ir * 0.3 * hl, fill="#ffffff"))
        inner.append(circle(ix + ir * 0.34, iy + ir * 0.32, ir * 0.12 * hl, fill="#ffffff", opacity=0.95))
        if fc.sparkle > 0.05:
            s = ir * 0.42 * fc.sparkle
            sx0, sy0 = ix + ir * 0.18, iy - ir * 0.05
            inner.append(path(_star4(sx0, sy0, s, s * 0.22), fill="#ffffff", opacity=0.95))
        if fc.teary > 0.05:
            inner.append(path(catmull(lo), fill="none", stroke="#bfe6ff", stroke_width=6 * sy, opacity=0.6 * fc.teary))
            inner.append(ellipse(ix + ir * 0.1, iy + ir * 0.62, ir * 0.55, ir * 0.16, fill="#ffffff", opacity=0.55 * fc.teary))
        out.append(group(inner, clip_path=f"url(#{clip_id})"))
        # lower lash line
        lo_outer = lo[2:]
        out.append(path(tapered(lo_outer, w0=0.5 * lw, w1=2.2 * lw if girl else 1.4 * lw), fill=C.mix(ink, look.brow, 0.3)))
        if girl and look.lashes > 0.3:
            for k, (u, ln) in enumerate([(0.86, 6.5), (0.97, 8.0)]):
                b = _along(lo, u)
                tip = (b[0] + side * 4, b[1] + ln)
                out.append(path(tapered([b, lerp_pt(b, tip, 0.5), tip], w0=1.6 * lw, w1=0.2), fill=ink))
    # upper lash line (+ wing)
    wing = (up[-1][0] + side * (17 if girl else 4) * width_scale, up[-1][1] - (12 if girl else 2))
    lash_pts = up + [wing]
    if o > 0.1:
        widths = [1.6, 4.0, 5.8, 7.0, 7.8, 7.2, 0.8] if girl else [1.4, 3.4, 4.6, 5.0, 4.6, 2.6, 0.6]
    else:
        widths = [1.2, 2.6, 3.8, 4.4, 4.2, 3.2, 0.6] if girl else [1.0, 2.0, 2.6, 2.6, 2.0, 1.2, 0.5]
    out.append(path(tapered(lash_pts, widths=[w * lw for w in widths]), fill=ink))
    # upper lashes
    if girl and look.lashes > 0.2:
        for u, ln, ang in [(0.58, 9, -12), (0.75, 12, 4), (0.9, 13, 20)]:
            b = _along(up, u)
            if o > 0.1:
                d = (side * math.sin(math.radians(ang + 25)), -math.cos(math.radians(ang + 25)))
            else:
                d = (side * math.sin(math.radians(ang + 70)), math.cos(math.radians(ang + 70)) * 0.6)
            ln *= look.lashes
            tip = (b[0] + d[0] * ln, b[1] + d[1] * ln)
            mid = (b[0] + d[0] * ln * 0.55 + side * 1.5, b[1] + d[1] * ln * 0.55 - 1.5)
            out.append(path(tapered([b, mid, tip], w0=3.0 * lw, w1=0.25), fill=ink))
    # tears
    if fc.tears > 0.02:
        tears_svg = _tears(lo, side, fc.tears, t, cx, lw)
    return "".join(out), tears_svg


def _along(pts: list[Pt], u: float) -> Pt:
    dense = resample(sample_catmull(pts, 6), 40)
    return dense[min(len(dense) - 1, max(0, int(u * (len(dense) - 1))))]


def _star4(x: float, y: float, r: float, w: float) -> str:
    return (f"M{f(x)} {f(y - r)} Q{f(x + w)} {f(y - w)} {f(x + r)} {f(y)} Q{f(x + w)} {f(y + w)} {f(x)} {f(y + r)} "
            f"Q{f(x - w)} {f(y + w)} {f(x - r)} {f(y)} Q{f(x - w)} {f(y - w)} {f(x)} {f(y - r)} Z")


def _tears(lower: list[Pt], side: int, amt: float, t: float, cx: float, lw: float) -> str:
    start = _along(lower, 0.62)
    length = 40 + 95 * clamp(amt)
    pts = []
    for i in range(7):
        u = i / 6
        wob = math.sin(u * 5 + t * 6 + side) * 2.5 * u
        pts.append((start[0] + side * (4 + u * 10) + wob, start[1] + u * length))
    widths = [3, 6, 8, 9, 9.5, 9, 7]
    out = [path(tapered(pts, widths=[w * (0.6 + 0.4 * amt) for w in widths]), fill="#9fd8ff", opacity=0.82,
                stroke="#5aa8e0", stroke_width=1.2 * lw)]
    out.append(path(catmull([(x - side * 1.5, y) for x, y in pts[1:5]]), fill="none", stroke="#ffffff",
                    stroke_width=1.6, opacity=0.8, stroke_linecap="round"))
    # falling drops
    for k in range(2):
        ph = (t * 1.6 + k * 0.5 + (0.3 if side > 0 else 0)) % 1.0
        dx, dy = pts[-1][0] + side * 3, pts[-1][1] + 6 + ph * 60
        out.append(path(f"M{f(dx)} {f(dy - 9)} Q{f(dx + 5)} {f(dy + 2)} {f(dx)} {f(dy + 4)} Q{f(dx - 5)} {f(dy + 2)} {f(dx)} {f(dy - 9)} Z",
                        fill="#9fd8ff", stroke="#5aa8e0", stroke_width=1 * lw, opacity=(1 - ph) * 0.9 * amt))
    return "".join(out)


def _brow(side: int, look: Look, fc: Face, turn: float, lw: float) -> str:
    girl = look.kind == "girl"
    base = [(18, -54), (46, -66), (78, -69), (108, -57)] if girl else [(14, -44), (42, -54), (72, -57), (100, -48)]
    raise_ = -fc.brow_raise * 10 - fc.brow_asym * 8 * side
    pts = []
    for i, (x, y) in enumerate(base):
        inner_w = [1.0, 0.55, -0.15, -0.35][i]
        y = y + raise_ + fc.brow_in * 11 * inner_w
        x = x * side
        pts.append((_turn_x(x, 0.6, turn), y))
    widths = [5.2, 4.8, 3.0, 1.0] if girl else [9.0, 8.4, 6.6, 3.2]
    return path(tapered(pts, widths=[w * lw for w in widths]), fill=look.brow)


def _nose(look: Look, turn: float, lw: float) -> str:
    st = skin_tones(look.skin)
    dx = turn * 34
    out = []
    if look.kind == "girl":
        out.append(path(catmull([(6 + dx, 28), (10 + dx, 42), (8 + dx, 53)]), fill="none", stroke=st["shade"],
                        stroke_width=4 * lw, opacity=0.55, stroke_linecap="round"))
        for s in (-1, 1):
            out.append(path(catmull([(s * 3 + dx, 57), (s * 7 + dx, 58.5), (s * 10 + dx, 55)]), fill="none",
                            stroke=st["ink"], stroke_width=2.0 * lw, stroke_linecap="round", opacity=0.8))
        out.append(ellipse(dx - 1, 46, 3.2, 2, fill="#ffffff", opacity=0.35))
    else:
        out.append(path(catmull([(8 + dx, 4), (12 + dx, 30), (14 + dx, 52), (8 + dx, 62)]), fill="none",
                        stroke=st["ink"], stroke_width=1.8 * lw, stroke_linecap="round", opacity=0.75))
        for s in (-1, 1):
            out.append(path(catmull([(s * 5 + dx, 59), (s * 11 + dx, 63), (s * 6 + dx, 66)]), fill="none",
                            stroke=st["ink"], stroke_width=1.8 * lw, stroke_linecap="round", opacity=0.85))
    return "".join(out)


def _mouth(look: Look, fc: Face, turn: float, defs: Defs, lw: float) -> str:
    girl = look.kind == "girl"
    mx, my = turn * 26, (88 if girl else 102)
    o, w, r, s, k = clamp(fc.mouth_open, 0, 1.2), fc.mouth_wide, fc.mouth_round, fc.smile, fc.smirk
    hw = 31 * (1 + 0.18 * w - 0.4 * r + 0.08 * s) * (1.0 if girl else 0.78)
    yl = -s * 7 + k * 3
    yr = -s * 7 - k * 6
    oh = o * (24 + 10 * r - 5 * w) * (1.0 if girl else 0.85)
    mid = 1.5 + s * 2.4
    lip_th = 15.5 if girl else 7.0
    up_th = 1.0 if girl else 0.45
    rr = 1 - 0.32 * r

    def P(pts):
        return [(mx + x, my + y) for x, y in pts]

    up_top = P([(-hw, yl), (-hw * 0.62, -6.5 * up_th + yl * 0.4), (-hw * 0.24, -11.5 * up_th), (0, -8.2 * up_th),
                (hw * 0.24, -11.5 * up_th), (hw * 0.62, -6.5 * up_th + yr * 0.4), (hw, yr)])
    up_in = P([(hw, yr), (hw * 0.5 * rr, mid - oh * 0.15 + yr * 0.3), (0, mid - oh * 0.2),
               (-hw * 0.5 * rr, mid - oh * 0.15 + yl * 0.3), (-hw, yl)])
    lo_in = P([(-hw, yl), (-hw * 0.5 * rr, mid + oh * 0.82 + yl * 0.3), (0, mid + oh),
               (hw * 0.5 * rr, mid + oh * 0.82 + yr * 0.3), (hw, yr)])
    lo_bot = P([(hw, yr), (hw * 0.6, mid + oh * 0.8 + lip_th * 0.8 + yr * 0.25), (0, mid + oh + lip_th),
                (-hw * 0.6, mid + oh * 0.8 + lip_th * 0.8 + yl * 0.25), (-hw, yl)])
    lip = look.lips if girl else C.mix(look.skin, look.lips, 0.38)
    lip_ink = C.mix(C.darken(lip, 0.38), "#3a0f22", 0.45)
    out = []
    if oh > 0.6:
        open_d = catmull(up_in[::-1]) + " " + catmull(lo_in[::-1], move=False) + " Z"
        cid = defs.uid("mo")
        defs.add(f'<clipPath id="{cid}"><path d="{open_d}"/></clipPath>')
        inner = [path(open_d, fill="#5a1430")]
        th = min(oh * 0.42, 8.5) * fc.teeth
        if th > 0.5:
            teeth_pts = [(x, y + th) for x, y in up_in]
            inner.append(path(catmull(up_in) + " L" + " L".join(f"{f(x)} {f(y)}" for x, y in
                                                                  sample_catmull(teeth_pts[::-1], 4)) + " Z",
                              fill="#fffefe"))
        inner.append(ellipse(mx, my + mid + oh * 0.9, hw * 0.48, oh * 0.38 + 2, fill="#e2667c"))
        out.append(group(inner, clip_path=f"url(#{cid})"))
    up_d = catmull(up_top) + " " + catmull(up_in, move=False) + " Z"
    lo_d = catmull(lo_in) + " " + catmull(lo_bot, move=False) + " Z"
    out.append(path(lo_d, fill=lip, stroke=lip_ink, stroke_width=1.7 * lw, stroke_linejoin="round"))
    out.append(path(up_d, fill=C.shade(lip, 0.07), stroke=lip_ink, stroke_width=1.7 * lw, stroke_linejoin="round"))
    if girl:
        gy = my + mid + oh + lip_th * 0.42
        out.append(ellipse(mx - hw * 0.26, gy, hw * 0.23, 3.3, fill="#ffffff", opacity=0.85))
        out.append(circle(mx + hw * 0.16, gy + 0.8, 1.7, fill="#ffffff", opacity=0.8))
        out.append(ellipse(mx - hw * 0.3, my - 7.5, 4.2, 1.6, fill="#ffffff", opacity=0.55))
    # mouth line when closed + corner ticks
    if oh <= 0.6:
        out.append(path(catmull(up_in), fill="none", stroke=lip_ink, stroke_width=2.1 * lw, stroke_linecap="round"))
    for sgn, yc in ((-1, yl), (1, yr)):
        cxp = mx + sgn * hw
        tick = [(cxp - sgn * 1, my + yc + 1), (cxp + sgn * 3.5, my + yc - 2 - s * 2.5)]
        out.append(path(catmull(tick), fill="none", stroke=lip_ink, stroke_width=1.6 * lw, stroke_linecap="round",
                        opacity=0.8))
    return "".join(out)


# =========================================================================== hair
def _sway(pts: list[Pt], t: float, amp: float, seed: float, y0: float = -40, y1: float = 420) -> list[Pt]:
    out = []
    for x, y in pts:
        k = clamp((y - y0) / (y1 - y0)) ** 1.5
        dx = amp * k * (math.sin(t * 2.1 + seed) * 0.7 + noise1(t * 0.9, seed) * 0.6)
        out.append((x + dx, y))
    return out


def _long_hair_parts(look: Look, length: float, t: float, sway: float) -> dict:
    px = look.part
    L = length
    # right curtain (viewer's right of the part)
    r_in = [(px - 1, -158), (px + 34, -132), (64, -104), (86, -70), (99, -28), (106, 18), (110, 76), (116, 146),
            (124, 220), (128, 230 + L * 0.25), (130, 240 + L * 0.5)]
    r_out = [(px - 1, -178), (52, -173), (102, -150), (134, -100), (146, -30), (150, 50), (154, 140), (160, 220),
             (165, 240 + L * 0.2), (166, 250 + L * 0.4), (162, 262 + L * 0.5)]
    l_in = [(px + 1, -158), (px - 36, -131), (-66, -102), (-88, -68), (-100, -26), (-107, 20), (-110, 78),
            (-118, 150), (-124, 220), (-128, 230 + L * 0.25), (-130, 240 + L * 0.5)]
    l_out = [(px + 1, -178), (-54, -172), (-104, -149), (-136, -98), (-148, -28), (-152, 52), (-156, 140),
             (-162, 220), (-167, 240 + L * 0.2), (-168, 250 + L * 0.4), (-164, 262 + L * 0.5)]
    back_r = [(40, -170), (118, -142), (156, -84), (168, 10), (171, 120), (170, 240), (166, 250 + L * 0.5),
              (160, 262 + L * 0.8)]
    back_l = [(-40, -170), (-120, -140), (-158, -82), (-170, 12), (-173, 122), (-172, 242), (-168, 252 + L * 0.5),
              (-162, 264 + L * 0.8)]
    sw = 5.0 * sway
    return {
        "r_in": _sway(r_in, t, sw, 1.0), "r_out": _sway(r_out, t, sw, 1.0),
        "l_in": _sway(l_in, t, sw, 2.3), "l_out": _sway(l_out, t, sw, 2.3),
        "back_r": _sway(back_r, t, sw * 1.2, 3.1), "back_l": _sway(back_l, t, sw * 1.2, 4.2),
    }


def _tips(a: Pt, b: Pt, n: int, depth: float, seed: str) -> list[Pt]:
    """Jagged pointy hair tips between point a and b."""
    pts = []
    for i in range(1, 2 * n):
        u = i / (2 * n)
        p = lerp_pt(a, b, u)
        if i % 2 == 1:
            pts.append((p[0], p[1] + depth * (0.7 + 0.5 * hash01(seed, i))))
        else:
            pts.append((p[0], p[1] + depth * 0.15))
    return pts


def _curtain_d(inner: list[Pt], outer: list[Pt], seed: str) -> str:
    tips = _tips(inner[-1], outer[-1], 2, 30, seed)
    return (catmull(inner) + " " + " ".join(f"L{f(x)} {f(y)}" for x, y in tips + [outer[-1]]) + " "
            + catmull(outer[::-1], move=False) + " Z")


def _strands(inner: list[Pt], outer: list[Pt], n: int, tones: dict, lw: float, seed: str, i0: int = 1) -> str:
    M = 30
    a = resample(sample_catmull(inner, 6), M)
    b = resample(sample_catmull(outer, 6), M)
    out = []
    for k in range(n):
        u = (k + 0.5) / n + (hash01(seed, k) - 0.5) * 0.06
        start = i0 + int(hash01(seed, "s", k) * 4)
        end = M - 1 - int(hash01(seed, "e", k) * 9)
        pts = [lerp_pt(a[i], b[i], clamp(u, 0.03, 0.97)) for i in range(start, end)]
        if len(pts) < 3:
            continue
        col = tones["strand"] if k % 4 else tones["deep"]
        out.append(path(catmull(pts[::2] + [pts[-1]]), fill="none", stroke=col, stroke_width=(1.25 + 0.5 * hash01(seed, "w", k)) * lw,
                        opacity=0.55 + 0.35 * hash01(seed, "o", k), stroke_linecap="round"))
    # highlight strands near the crown
    for k in range(3):
        u = 0.35 + 0.18 * k
        pts = [lerp_pt(a[i], b[i], u) for i in range(3, 10)]
        out.append(path(catmull(pts), fill="none", stroke=tones["sheen"], stroke_width=2.2 * lw, opacity=0.7,
                        stroke_linecap="round"))
    return "".join(out)


def _sheen_band(inner: list[Pt], outer: list[Pt]) -> str:
    M = 30
    a = resample(sample_catmull(inner, 6), M)
    b = resample(sample_catmull(outer, 6), M)
    top = [lerp_pt(a[i], b[i], 0.28) for i in range(2, 11)]
    bot = [lerp_pt(a[i], b[i], 0.66) for i in range(11, 1, -1)]
    return catmull(top + bot, closed=True)


def hair_layers(look: Look, hs: HairState, t: float, lw: float, defs: Defs, length: float = 160) -> tuple[str, str, str]:
    """Returns (back layer, forehead shadow, front layer) markup."""
    def render(tones: dict) -> tuple[str, str]:
        if look.hair_style == "boy":
            return _boy_hair(look, tones, t, lw)
        P = _long_hair_parts(look, length, t, hs.sway)
        tips = _tips(P["back_l"][-1], P["back_r"][-1], 6, 34, "bk")
        back_d = (catmull(P["back_l"]) + " " + " ".join(f"L{f(x)} {f(y)}" for x, y in tips + [P["back_r"][-1]]) + " "
                  + catmull(P["back_r"][::-1], move=False) + " Z")
        back = path(back_d, fill=tones["shadow"], stroke=tones["ink"], stroke_width=2.4 * lw, stroke_linejoin="round")
        # back strands
        bl = resample(sample_catmull(P["back_l"], 5), 20)
        br = resample(sample_catmull(P["back_r"], 5), 20)
        bstr = []
        for k in range(9):
            u = (k + 0.5) / 9
            pts = [lerp_pt(bl[i], br[i], u) for i in range(3, 19)]
            pts = [(x, y) for x, y in pts]
            bstr.append(path(catmull(pts[::2]), fill="none", stroke=tones["ink"], stroke_width=1.1 * lw, opacity=0.35))
        back += "".join(bstr)
        front = []
        for side, (inner, outer) in (("r", (P["r_in"], P["r_out"])), ("l", (P["l_in"], P["l_out"]))):
            d = _curtain_d(inner, outer, side)
            front.append(path(d, fill=tones["base"]))
            # inner shadow along the face side
            sh_pts = resample(sample_catmull(inner, 5), 20)
            sh_out = resample(sample_catmull([lerp_pt(p, q, 0.22) for p, q in zip(inner, outer)], 5), 20)
            front.append(path(catmull(sh_pts[2:] + sh_out[2:][::-1], closed=True), fill=tones["shadow"], opacity=0.75))
            front.append(path(_sheen_band(inner, outer), fill=tones["light"], opacity=0.7))
            front.append(_strands(inner, outer, 13, tones, lw, side))
            front.append(path(d, fill="none", stroke=tones["ink"], stroke_width=2.5 * lw, stroke_linejoin="round"))
        # part line
        px = look.part
        front.append(path(catmull([(px, -176), (px + 1, -168), (px, -158)]), fill="none", stroke=tones["ink"],
                          stroke_width=1.6 * lw, stroke_linecap="round"))
        return back, "".join(front)

    base = render(C.hair_tones(hs.color))
    shadow = ""
    if look.hair_style != "boy":
        P = _long_hair_parts(look, length, t, hs.sway)
        sh = [(x + 3, y + 12) for x, y in P["l_in"][:6][::-1]] + [(x - 3, y + 12) for x, y in P["r_in"][:6]]
        shadow = path(catmull(sh + [(P["r_in"][5][0], -200), (P["l_in"][5][0], -200)], closed=True),
                      fill=skin_tones(look.skin)["shade"], opacity=0.9)
    if hs.to_color and hs.wipe > 0:
        new = render(C.hair_tones(hs.to_color))
        y_top, y_bot = (-235, 40) if look.hair_style == "boy" else (-200, 340 + length)
        mid = lerp(y_top, y_bot, clamp(hs.wipe))
        mid_id = defs.uid("hw")
        g_id = defs.uid("hwg")
        defs.add(lin_grad(g_id, [(0, "#ffffff", 1), (0.5, "#ffffff", 1), (1, "#ffffff", 0)],
                          user=(0, mid - 60, 0, mid + 10)))
        defs.add(f'<mask id="{mid_id}" maskUnits="userSpaceOnUse" x="-400" y="-400" width="800" height="1400">'
                 f'<rect x="-400" y="-400" width="800" height="{f(mid + 410)}" fill="url(#{g_id})"/></mask>')
        back = base[0] + group(new[0], mask=f"url(#{mid_id})")
        front = base[1] + group(new[1], mask=f"url(#{mid_id})")
        return back, shadow, front
    return base[0], shadow, base[1]


def _boy_hair(look: Look, tones: dict, t: float, lw: float) -> tuple[str, str]:
    sw = math.sin(t * 2.0) * 1.5
    back = [(-108, -30), (-124, -100), (-108, -160), (-60, -196), (0, -204), (60, -196), (110, -164), (128, -100),
            (114, -30), (108, 4), (-108, 4)]
    back_svg = path(catmull(back, closed=True), fill=tones["shadow"], stroke=tones["ink"], stroke_width=2.4 * lw)
    top = [(-112, -30), (-124, -92), (-116, -148), (-90, -186), (-52, -206), (-18, -214), (8, -236 + sw), (28, -210),
           (58, -216), (90, -232 + sw), (100, -198), (124, -170), (136, -122), (130, -64), (118, -40),
           (110, -64), (102, -50 + sw), (92, -80), (80, -60 + sw), (66, -88), (50, -72 + sw), (36, -98), (4, -106),
           (-36, -106), (-72, -96), (-96, -76), (-106, -50)]
    top_d = catmull(top, closed=True, tension=0.8)
    out = [path(top_d, fill=tones["base"])]
    out.append(path(catmull([(-100, -60), (-60, -92), (0, -100), (60, -92), (100, -66), (60, -120), (0, -140), (-70, -120)],
                            closed=True), fill=tones["shadow"], opacity=0.55))
    for k in range(10):
        u = k / 9
        pts = [(lerp(-110, -40, u), lerp(-120, -196, u)), (lerp(-50, 30, u), lerp(-112, -190, u)),
               (lerp(20, 96, u), lerp(-96, -150, u)), (lerp(60, 118, u), lerp(-70, -110, u))]
        out.append(path(catmull(pts), fill="none", stroke=tones["strand"], stroke_width=1.5 * lw, opacity=0.7,
                        stroke_linecap="round"))
    out.append(path(catmull([(-80, -168), (-30, -190), (30, -186), (84, -164)]), fill="none", stroke=tones["sheen"],
                    stroke_width=8 * lw, opacity=0.55, stroke_linecap="round"))
    out.append(path(top_d, fill="none", stroke=tones["ink"], stroke_width=2.6 * lw, stroke_linejoin="round"))
    for s in (-1, 1):
        out.append(path(poly([(s * 102, -40), (s * 112, -36), (s * 109, 14), (s * 101, 8)]), fill=tones["base"],
                        stroke=tones["ink"], stroke_width=1.8 * lw))
    return back_svg, "".join(out)


# =========================================================================== body
def _shoulder(side: int, kind: str) -> Pt:
    return (side * (60 if kind == "girl" else 74), 216)


ARM_TARGETS = {
    # pose: (right-hand target, right bend, left-hand target, left bend, right arm in front?, left arm in front?)
    # bend -1 swings the elbow outward/down, +1 the other way (see _ik).
    "down": ((84, 372), -1, (-84, 372), -1, False, False),
    "hip": ((62, 336), -1, (-62, 336), -1, False, False),
    "phone": ((26, 268), -1, (-84, 372), -1, False, False),
    "phone_up": ((40, 150), 1, (-84, 372), -1, True, False),
    "cheeks": ((80, 76), 1, (-80, 76), 1, True, True),
    "wave": ((150, 64), 1, (-84, 372), -1, False, False),
    "hair": ((118, 70), 1, (-84, 372), -1, True, False),
    "point": ((170, 210), 1, (-62, 336), -1, False, False),
    "chin": ((22, 168), -1, (-84, 372), -1, True, False),
    "shrug": ((124, 220), 1, (-124, 220), 1, False, False),
    "mouth": ((16, 120), 1, (-84, 372), -1, True, False),
    "cross": ((84, 372), -1, (-84, 372), -1, False, False),
}


def _ik(sh: Pt, target: Pt, a: float, b: float, bend: int) -> tuple[Pt, Pt]:
    dx, dy = target[0] - sh[0], target[1] - sh[1]
    d = clamp(math.hypot(dx, dy), abs(a - b) + 1, a + b - 0.5)
    base = math.atan2(dy, dx)
    cos_a = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)
    ang = base + bend * math.acos(cos_a)
    elbow = (sh[0] + a * math.cos(ang), sh[1] + a * math.sin(ang))
    ex, ey = target[0] - elbow[0], target[1] - elbow[1]
    L = math.hypot(ex, ey) or 1
    hand = (elbow[0] + ex / L * b, elbow[1] + ey / L * b)
    return elbow, hand


def _hand(p: Pt, ang: float, skin: dict, lw: float, s: float = 1.0, nails: str = "#ff6fae", open_: bool = False) -> str:
    """Simple cartoon hand at p pointing along ang (radians)."""
    deg = math.degrees(ang) - 90
    fingers = []
    spread = [-13, -4, 5, 13] if open_ else [-8, -2.5, 3, 8]
    for i, a in enumerate(spread):
        ln = [16, 19, 18, 14][i] * (1.1 if open_ else 0.9)
        x0, y0 = (i - 1.5) * 5.2, 9
        x1, y1 = x0 + math.sin(math.radians(a)) * ln, y0 + math.cos(math.radians(a)) * ln
        fingers.append(((x0, y0), (x1, y1)))
    g = []
    for (x0, y0), (x1, y1) in fingers:
        g.append(f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}" stroke="{skin["ink"]}" '
                 f'stroke-width="{f(7.6 + 2.4 * lw)}" stroke-linecap="round"/>')
    g.append(ellipse(0, 4, 13, 12, fill=skin["base"], stroke=skin["ink"], stroke_width=2.2 * lw))
    for (x0, y0), (x1, y1) in fingers:
        g.append(f'<line x1="{f(x0)}" y1="{f(y0)}" x2="{f(x1)}" y2="{f(y1)}" stroke="{skin["base"]}" '
                 f'stroke-width="7.6" stroke-linecap="round"/>')
        g.append(circle(x1, y1 - 1, 2.6, fill=nails, opacity=0.95))
    g.append(f'<line x1="-12" y1="2" x2="-19" y2="12" stroke="{skin["ink"]}" stroke-width="{f(7.4 + 2.4 * lw)}" stroke-linecap="round"/>')
    g.append(f'<line x1="-12" y1="2" x2="-19" y2="12" stroke="{skin["base"]}" stroke-width="7.4" stroke-linecap="round"/>')
    return group(g, transform=f"translate({f(p[0])} {f(p[1])}) rotate({f(deg)}) scale({f(s)})")


def _limb(pts: list[Pt], widths: list[float], fill: str, ink: str, lw: float) -> str:
    out = []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        out.append(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{ink}" '
                   f'stroke-width="{f(widths[i] + 2 * 2.3 * lw)}" stroke-linecap="round"/>')
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        out.append(f'<line x1="{f(a[0])}" y1="{f(a[1])}" x2="{f(b[0])}" y2="{f(b[1])}" stroke="{fill}" '
                   f'stroke-width="{f(widths[i])}" stroke-linecap="round"/>')
    return "".join(out)


def _arm(side: int, look: Look, target: Pt, bend: int, lw: float, sleeve: Optional[str], sleeve_len: float,
         holding_phone: bool, phone_glow: float, t: float) -> str:
    skin = skin_tones(look.skin)
    girl = look.kind == "girl"
    sh = _shoulder(side, look.kind)
    a, b = (86, 80) if girl else (92, 86)
    elbow, hand = _ik(sh, target, a, b, bend * side)
    out = []
    uw, fw = (17, 13) if girl else (24, 19)
    out.append(_limb([sh, elbow, hand], [uw, fw], skin["base"], skin["ink"], lw))
    if sleeve:
        ink = C.ink(sleeve)
        if sleeve_len >= 1:
            pts = [sh, elbow, lerp_pt(elbow, hand, 0.82)]
            out.append(_limb(pts, [uw + 9, fw + 9], sleeve, ink, lw))
            # cuff
            c = lerp_pt(elbow, hand, 0.82)
            out.append(circle(c[0], c[1], (fw + 9) / 2, fill=C.shade(sleeve, 0.08), stroke=ink, stroke_width=2 * lw))
        else:
            e2 = lerp_pt(sh, elbow, sleeve_len * 1.5 if sleeve_len < 0.5 else 1)
            out.append(_limb([sh, e2], [uw + 6], sleeve, ink, lw))
    ang = math.atan2(hand[1] - elbow[1], hand[0] - elbow[0])
    if holding_phone:
        out.append(phone_in_hand(hand, ang, lw, phone_glow, look))
    out.append(_hand(hand, ang, skin, lw, 1.3 if girl else 1.5, nails=look.lips if girl else look.skin,
                     open_=not holding_phone))
    return "".join(out)


def phone_in_hand(p: Pt, ang: float, lw: float, glow: float, look: Look) -> str:
    g = []
    if glow > 0:
        g.append(rect(-17, -32, 34, 58, 8, fill="none", stroke="#ff3fb4", stroke_width=10, opacity=0.45 * glow,
                      filter="url(#softglow)"))
    g.append(rect(-15, -30, 30, 54, 7, fill="#7ee8d2", stroke=INK, stroke_width=2.4 * lw))
    g.append(rect(-11, -25, 22, 42, 4, fill="#ffd1ec"))
    g.append(rect(-8, -20, 16, 6, 2, fill="#ff5fb8", opacity=0.9))
    g.append(rect(-8, -11, 12, 5, 2, fill="#ffffff", opacity=0.9))
    return group(g, transform=f"translate({f(p[0])} {f(p[1] - 6)}) rotate({f(math.degrees(ang) - 90 + 180)})")


def _torso(look: Look, lw: float, defs: Defs) -> str:
    skin = skin_tones(look.skin)
    girl = look.kind == "girl"
    out = []
    # neck
    nw = 21 if girl else 30
    out.append(path(poly([(-nw, 110), (nw, 110), (nw + 2, 212), (-nw - 2, 212)]), fill=skin["base"],
                    stroke=skin["ink"], stroke_width=2.2 * lw))
    out.append(path(catmull([(-nw - 3, 112), (nw + 3, 112), (nw, 146), (0, 154), (-nw, 146)], closed=True),
                    fill=skin["shade"], opacity=0.8))
    # torso skin
    if girl:
        body = [(-24, 202), (-56, 210), (-70, 232), (-62, 284), (-44, 328), (-54, 372), (54, 372), (44, 328),
                (62, 284), (70, 232), (56, 210), (24, 202)]
    else:
        body = [(-32, 202), (-72, 212), (-88, 238), (-80, 300), (-66, 360), (-64, 392), (64, 392), (66, 360),
                (80, 300), (88, 238), (72, 212), (32, 202)]
    out.append(path(catmull(body, closed=True, tension=0.8), fill=skin["base"], stroke=skin["ink"], stroke_width=2.3 * lw))
    if girl:
        out.append(ellipse(0, 334, 2.2, 3.2, fill=skin["deep"]))  # navel
    # top
    top = look.top
    tc = look.top_color
    tink = C.ink(tc)
    if top == "tee":
        pts = [(-26, 203), (-12, 222), (0, 226), (12, 222), (26, 203), (58, 210), (78, 236), (72, 262), (60, 262),
               (58, 296), (52, 316), (-52, 316), (-58, 296), (-60, 262), (-72, 262), (-78, 236), (-58, 210)]
        out.append(path(catmull(pts, closed=True, tension=0.6), fill=tc, stroke=tink, stroke_width=2.4 * lw,
                        stroke_linejoin="round"))
        out.append(path(catmull([(30, 214), (54, 230), (52, 300), (46, 312), (30, 312)], closed=True), fill=C.shade(tc, 0.07)))
        out.append(path(catmull([(-26, 203), (-12, 222), (0, 226), (12, 222), (26, 203)]), fill="none",
                        stroke=look.top_accent, stroke_width=4 * lw))
        # Y2K heart graphic
        out.append(path(_heart(0, 262, 15), fill=look.top_accent, stroke=tink, stroke_width=1.6 * lw))
        out.append(ellipse(-5, 257, 3.5, 2.2, fill="#ffffff", opacity=0.7))
    elif top == "hoodie":
        pts = [(-30, 200), (-66, 208), (-84, 236), (-74, 300), (-64, 330), (64, 330), (74, 300), (84, 236), (66, 208),
               (30, 200)]
        out.append(path(catmull([(-44, 200), (-30, 182), (30, 182), (44, 200), (0, 214)], closed=True), fill=C.shade(tc, 0.12),
                        stroke=tink, stroke_width=2.2 * lw))
        out.append(path(catmull(pts, closed=True, tension=0.7), fill=tc, stroke=tink, stroke_width=2.4 * lw))
        out.append(path(poly([(-64, 318), (64, 318), (64, 334), (-64, 334)]), fill=C.shade(tc, 0.1), stroke=tink,
                        stroke_width=2 * lw))
        out.append(path(f"M0 214 L0 318", stroke=tink, stroke_width=2.2 * lw))
        for s in (-1, 1):
            out.append(path(catmull([(s * 12, 216), (s * 14, 246), (s * 11, 266)]), fill="none", stroke="#ffffff",
                            stroke_width=2.6 * lw, stroke_linecap="round"))
    elif top == "cardigan":
        out.append(path(catmull([(-30, 214), (30, 214), (46, 250), (44, 300), (-44, 300), (-46, 250)], closed=True),
                        fill=look.under_color, stroke=C.ink(look.under_color), stroke_width=2 * lw))
        for s in (-1, 1):
            pts = [(s * 24, 202), (s * 60, 208), (s * 80, 236), (s * 74, 296), (s * 64, 322), (s * 20, 318), (s * 28, 270),
                   (s * 18, 230)]
            out.append(path(catmull(pts, closed=True, tension=0.7), fill=tc, stroke=tink, stroke_width=2.4 * lw))
            for k in range(3):
                out.append(circle(s * 24, 246 + k * 22, 3.2, fill="#ffffff", stroke=tink, stroke_width=1 * lw))
    elif top == "varsity":
        pts = [(-34, 200), (-80, 210), (-98, 240), (-90, 320), (-84, 398), (84, 398), (90, 320), (98, 240), (80, 210),
               (34, 200)]
        out.append(path(catmull(pts, closed=True, tension=0.7), fill=tc, stroke=tink, stroke_width=2.6 * lw))
        out.append(path(catmull([(-30, 214), (30, 214), (20, 300), (0, 320), (-20, 300)], closed=True), fill="#f6f1ea",
                        stroke=C.ink("#f6f1ea"), stroke_width=2 * lw))
        out.append(path(catmull([(-36, 200), (0, 228), (36, 200)]), fill="none", stroke=look.top_accent,
                        stroke_width=10 * lw, stroke_linecap="round"))
        out.append(path(catmull([(-36, 200), (0, 228), (36, 200)]), fill="none", stroke="#ffffff",
                        stroke_width=3 * lw, stroke_linecap="round"))
        out.append(path(poly([(-84, 386), (84, 386), (84, 400), (-84, 400)]), fill=look.top_accent, stroke=tink,
                        stroke_width=2 * lw))
        # chest letter patch
        out.append(path(_heart(-50, 268, 14), fill=look.top_accent, stroke=tink, stroke_width=1.6 * lw))
    elif top == "apron":
        pts = [(-26, 203), (-58, 210), (-74, 236), (-66, 300), (-58, 380), (58, 380), (66, 300), (74, 236), (58, 210),
               (26, 203)]
        out.append(path(catmull(pts, closed=True, tension=0.7), fill="#ffffff", stroke=C.ink("#ffffff"),
                        stroke_width=2.4 * lw))
        out.append(path(poly([(-44, 238), (44, 238), (50, 380), (-50, 380)]), fill=tc, stroke=tink, stroke_width=2.2 * lw))
    # choker
    if look.choker:
        out.append(path(catmull([(-22, 182), (0, 190), (22, 182)]), fill="none", stroke=look.choker, stroke_width=6 * lw,
                        stroke_linecap="round"))
        out.append(path(_heart(0, 196, 6), fill="#ffd34d", stroke=INK, stroke_width=1 * lw))
    return "".join(out)


def _heart(x: float, y: float, s: float) -> str:
    return (f"M{f(x)} {f(y + s * 0.9)} C{f(x - s * 1.4)} {f(y)} {f(x - s * 0.9)} {f(y - s * 0.95)} {f(x)} {f(y - s * 0.35)} "
            f"C{f(x + s * 0.9)} {f(y - s * 0.95)} {f(x + s * 1.4)} {f(y)} {f(x)} {f(y + s * 0.9)} Z")


def _legs(look: Look, lw: float) -> str:
    skin = skin_tones(look.skin)
    girl = look.kind == "girl"
    out = []
    bc = look.bottom_color
    bink = C.ink(bc)
    hip = 50 if girl else 62
    # chunky platform shoes (drawn first so flares can cover them)
    sc = look.shoes_color
    for s in (-1, 1):
        x = s * 30
        out.append(path(catmull([(x - 26, 668), (x - 22, 644), (x + 2, 636), (x + 24, 650), (x + 32, 672),
                                 (x + 28, 690), (x - 26, 690)], closed=True, tension=0.6), fill=sc, stroke=C.ink(sc),
                        stroke_width=2.4 * lw))
        out.append(path(poly([(x - 28, 682), (x + 32, 682), (x + 30, 704), (x - 26, 704)]), fill=C.shade(sc, 0.12),
                        stroke=C.ink(sc), stroke_width=2.2 * lw))
    if look.bottom == "skirt":
        for s in (-1, 1):
            out.insert(0, _limb([(s * 24, 400), (s * 26, 530), (s * 28, 646)], [30, 22], skin["base"], skin["ink"], lw))
        out.append(path(catmull([(-48, 330), (48, 330), (72, 432), (-72, 432)], closed=True, tension=0.4), fill=bc,
                        stroke=bink, stroke_width=2.4 * lw))
        for k in range(-2, 3):
            out.append(path(f"M{f(k * 16)} 342 L{f(k * 22)} 428", stroke=C.shade(bc, 0.12), stroke_width=2 * lw))
    else:
        flare = 1.0 if look.bottom == "flare" else 0.45
        for s in (-1, 1):
            leg = [(s * 2, 384), (s * hip, 344), (s * (hip + 4), 420), (s * 40, 560), (s * (42 + 18 * flare), 664),
                   (s * 8, 666), (s * 10, 540), (s * 6, 420)]
            out.append(path(catmull(leg, closed=True, tension=0.5), fill=bc, stroke=bink, stroke_width=2.4 * lw,
                            stroke_linejoin="round"))
            out.append(path(catmull([(s * 30, 430), (s * 26, 540), (s * 32, 646)]), fill="none", stroke=C.shade(bc, 0.1),
                            stroke_width=3 * lw, opacity=0.8))
        out.append(path(catmull([(-hip, 344), (0, 352), (hip, 344)]), fill="none", stroke=C.ink(bc), stroke_width=7 * lw))
        out.append(path(catmull([(-hip, 344), (0, 352), (hip, 344)]), fill="none", stroke=look.top_accent, stroke_width=4.5 * lw))
    return "".join(out)


# =========================================================================== character
@dataclass
class CharState:
    face: Face = field(default_factory=Face)
    hair: HairState = field(default_factory=HairState)
    pose: Pose = field(default_factory=Pose)
    talk: float = 0.0          # 0..1 mouth envelope from the voice track
    viseme: float = 0.0        # -1 round (O/U) .. +1 wide (E/I)
    blink: float = 0.0         # 0..1 extra closing from the blink timer
    breathe: float = 0.0
    fx: dict = field(default_factory=dict)


def draw_character(look: Look, st: CharState, t: float, defs: Defs, lw: float = 1.0, full_body: bool = True) -> str:
    fc = st.face
    # speech drives the jaw on top of the expression
    if st.talk > 0.01:
        talk = st.talk
        fc = replace(fc,
                     mouth_open=max(fc.mouth_open, talk * 0.75),
                     mouth_round=lerp(fc.mouth_round, clamp(-st.viseme), 0.6 * talk),
                     mouth_wide=lerp(fc.mouth_wide, clamp(st.viseme), 0.6 * talk),
                     nod=fc.nod + talk * 2.2, tilt=fc.tilt + talk * 1.2)
    openness = max(0.0, fc.eye_open * (1 - st.blink))
    skin = skin_tones(look.skin)
    breathe = math.sin(t * 2 * math.pi * 0.28) * 1.6
    head_tf = f"translate(0 {f(fc.nod - breathe * 0.5)}) rotate({f(fc.tilt)} 0 150)"

    back, fshadow, front = hair_layers(look, st.hair, t, lw, defs, length=(170 if full_body else 140))
    layers = []
    layers.append(group(back, transform=head_tf))
    if full_body:
        layers.append(_legs(look, lw))
    # pose / arms
    pose = st.pose
    tr, br, tl, bl_, fr, fl = ARM_TARGETS.get(pose.arms, ARM_TARGETS["down"])
    if pose.arms_to and pose.arms_t > 0:
        tr2, br2, tl2, bl2, fr2, fl2 = ARM_TARGETS.get(pose.arms_to, ARM_TARGETS["down"])
        k = clamp(pose.arms_t)
        tr, tl = lerp_pt(tr, tr2, k), lerp_pt(tl, tl2, k)
        if k > 0.5:
            br, bl_, fr, fl = br2, bl2, fr2, fl2
    # tiny idle drift so hands never freeze
    tr = (tr[0] + math.sin(t * 1.3) * 1.5, tr[1] + math.sin(t * 2.6) * 1.5 - breathe)
    tl = (tl[0] + math.sin(t * 1.1 + 1) * 1.5, tl[1] + math.sin(t * 2.2 + 1) * 1.5 - breathe)
    sleeve = None
    sleeve_len = 0.0
    if look.top in ("hoodie", "cardigan", "varsity"):
        sleeve, sleeve_len = look.top_color, 1.0
    elif look.top in ("tee",):
        sleeve, sleeve_len = look.top_color, 0.3
    phone_r = pose.arms in ("phone", "phone_up") or (pose.arms_to in ("phone", "phone_up") and pose.arms_t > 0.5)
    arm_r = _arm(1, look, tr, br, lw, sleeve, sleeve_len, phone_r, pose.phone_glow, t)
    arm_l = _arm(-1, look, tl, bl_, lw, sleeve, sleeve_len, False, 0, t)
    body = _torso(look, lw, defs)
    layers.append(group(body, transform=f"translate(0 {f(-breathe * 0.4)})"))
    arms_front = ""
    if pose.arms == "cross" and not pose.arms_to:
        layers.append(_crossed_arms(look, lw, sleeve))
    else:
        layers.append((arm_r if not fr else "") + (arm_l if not fl else ""))
        arms_front = (arm_r if fr else "") + (arm_l if fl else "")

    # ---- head
    head = []
    outline = face_outline(look.kind, fc.turn)
    face_d = catmull(outline, closed=True)
    clip_id = defs.uid("face")
    defs.add(f'<clipPath id="{clip_id}"><path d="{face_d}"/></clipPath>')
    if look.kind == "boy":
        for s in (-1, 1):
            ex = s * 106 + fc.turn * 6
            head.append(path(catmull([(ex, -20), (ex + s * 14, -12), (ex + s * 14, 26), (ex, 36)], closed=True),
                             fill=skin["base"], stroke=skin["ink"], stroke_width=2.2 * lw))
    head.append(path(face_d, fill=skin["base"]))
    shading = [path(catmull([(108, -40), (106, 10), (97, 54), (80, 88), (56, 110), (74, 150), (150, 140), (150, -40)],
                            closed=True), fill=skin["shade"], opacity=0.32)]
    if fshadow:
        shading.append(fshadow)
    # blush
    bl = clamp(fc.blush)
    if bl > 0.02:
        b_id = defs.uid("bl")
        defs.add(rad_grad(b_id, [(0, "#ff4f93", 0.9), (0.6, "#ff6fa8", 0.45), (1, "#ff7fb0", 0)]))
        for s in (-1, 1):
            shading.append(ellipse(s * 66 + fc.turn * 22, 50, 36, 19, fill=f"url(#{b_id})", opacity=clamp(bl * 1.4)))
        if fc.blush_lines > 0.05:
            for s in (-1, 1):
                for k in range(3):
                    x0 = s * 56 + fc.turn * 22 + (k - 1) * 9
                    shading.append(path(f"M{f(x0 + 4)} 38 L{f(x0 - 3)} 52", stroke="#e8407a", stroke_width=2.2 * lw,
                                        opacity=fc.blush_lines, stroke_linecap="round"))
    if look.freckles:
        for i in range(7):
            for s in (-1, 1):
                fx_ = s * (44 + hash01("fr", i) * 34) + fc.turn * 22
                fy_ = 30 + hash01("fy", i) * 18
                shading.append(circle(fx_, fy_, 1.6, fill=skin["deep"], opacity=0.7))
    head.append(group(shading, clip_path=f"url(#{clip_id})"))
    head.append(path(face_d, fill="none", stroke=skin["ink"], stroke_width=2.5 * lw))
    # features
    ex = 57 if look.kind == "girl" else 52
    ey = 4 if look.kind == "girl" else 4
    tears = []
    for side in (1, -1):
        width_scale = 1 - 0.2 * max(0.0, -fc.turn * side) - 0.05 * max(0.0, fc.turn * side)
        o = openness
        if (fc.wink > 0 and side == 1) or (fc.wink < 0 and side == -1):
            o = openness * (1 - abs(fc.wink))
        ecx = _turn_x(side * ex, 0.62, fc.turn)
        e_svg, tear_svg = _eye(ecx, ey, side, look, fc, o, defs, lw, t, width_scale)
        head.append(e_svg)
        tears.append(tear_svg)
        head.append(_brow(side, look, fc, fc.turn, lw))
    head.append(_nose(look, fc.turn, lw))
    head.append(_mouth(look, fc, fc.turn, defs, lw))
    head.extend(tears)
    if fc.sweat > 0.05:
        head.append(_sweat(108 + fc.turn * 10, -60, fc.sweat, t, lw))

    head_layer = group(head)
    hair_front = front
    acc = []
    if look.earrings != "none" and look.kind == "girl":
        col = {"gold": "#f5c542", "silver": "#dfe6ef", "pink": "#ff7ac3"}.get(look.earrings, "#f5c542")
        for s in (-1, 1):
            x = s * 112 + fc.turn * 8
            sw_ = math.sin(t * 2.4 + s) * 2.5
            acc.append(circle(x + sw_, 66, 17, fill="none", stroke=INK, stroke_width=4.2 + 2.2 * lw))
            acc.append(circle(x + sw_, 66, 17, fill="none", stroke=col, stroke_width=4.2))
            acc.append(path(f"M{f(x + sw_ - 12)} 56 A17 17 0 0 1 {f(x + sw_ + 2)} 49", fill="none", stroke="#ffffff",
                            stroke_width=1.6, opacity=0.85, stroke_linecap="round"))
    if look.glasses_on_head:
        gcol = look.glasses_on_head
        g = []
        for s in (-1, 1):
            g.append(path(_heart(s * 40, -150, 28), fill=gcol, opacity=0.85, stroke=C.ink(gcol), stroke_width=3 * lw))
            g.append(ellipse(s * 40 - 10, -160, 8, 4, fill="#ffffff", opacity=0.55))
        g.append(path("M-14 -158 Q0 -166 14 -158", fill="none", stroke=C.ink(gcol), stroke_width=3.5 * lw))
        acc.append(group(g, transform="rotate(-4 0 -150)"))
    layers.append(group([head_layer, hair_front, "".join(acc)], transform=head_tf))
    if arms_front:
        layers.append(arms_front)
    return group(layers)


def _sweat(x: float, y: float, amt: float, t: float, lw: float) -> str:
    dy = (t * 25) % 30
    s = 0.8 + 0.4 * amt
    d = (f"M{f(x)} {f(y + dy - 16 * s)} Q{f(x + 11 * s)} {f(y + dy + 4 * s)} {f(x)} {f(y + dy + 8 * s)} "
         f"Q{f(x - 11 * s)} {f(y + dy + 4 * s)} {f(x)} {f(y + dy - 16 * s)} Z")
    return path(d, fill="#bfe8ff", stroke="#4f9bd6", stroke_width=2 * lw, opacity=clamp(amt)) + \
        ellipse(x - 3 * s, y + dy + 1, 2.5 * s, 3.5 * s, fill="#ffffff", opacity=0.8 * clamp(amt))


def _crossed_arms(look: Look, lw: float, sleeve: Optional[str]) -> str:
    skin = skin_tones(look.skin)
    col = sleeve or skin["base"]
    ink = C.ink(col) if sleeve else skin["ink"]
    out = []
    for s in (-1, 1):
        sh = _shoulder(s, look.kind)
        out.append(_limb([sh, (s * 66, 290)], [26 if sleeve else 17], col, ink, lw))
    out.append(_limb([(-70, 286), (52, 262)], [24 if sleeve else 15], col, ink, lw))
    out.append(_limb([(70, 288), (-50, 270)], [24 if sleeve else 15], col, ink, lw))
    for s in (-1, 1):
        out.append(ellipse(s * 56, 266 + (s + 1) * 2, 12, 10, fill=skin["base"], stroke=skin["ink"], stroke_width=2 * lw))
    return "".join(out)
