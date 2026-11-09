"""Small geometry + SVG helpers shared by every drawing module.

Everything is plain strings: each drawing function returns SVG markup for its
part, and the renderer stitches the parts into one document per frame.
"""
from __future__ import annotations

import math
from typing import Iterable, Sequence

Pt = tuple[float, float]


# ---------------------------------------------------------------- numbers
def f(v: float) -> str:
    """Compact number formatting for SVG attributes."""
    s = f"{v:.2f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if v < lo else hi if v > hi else v


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_pt(p: Pt, q: Pt, t: float) -> Pt:
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def lerp_pts(a: Sequence[Pt], b: Sequence[Pt], t: float) -> list[Pt]:
    return [lerp_pt(p, q, t) for p, q in zip(a, b)]


def smoothstep(t: float) -> float:
    t = clamp(t)
    return t * t * (3 - 2 * t)


def ease_in_out(t: float) -> float:
    t = clamp(t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ease_out(t: float) -> float:
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in(t: float) -> float:
    t = clamp(t)
    return t ** 3


def ease_out_back(t: float, s: float = 1.70158) -> float:
    t = clamp(t) - 1
    return t * t * ((s + 1) * t + s) + 1


def ease_out_elastic(t: float) -> float:
    t = clamp(t)
    if t in (0, 1):
        return t
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi) / 3) + 1


def hash01(*keys) -> float:
    """Deterministic pseudo-random number in [0,1) from any hashable keys."""
    h = 2166136261
    for k in keys:
        for ch in str(k):
            h ^= ord(ch)
            h = (h * 16777619) & 0xFFFFFFFF
        h ^= 0x9E3779B9
        h = (h * 16777619) & 0xFFFFFFFF
    return (h % 100000) / 100000.0


def noise1(x: float, seed: float = 0.0) -> float:
    """Smooth 1-D value noise in [-1, 1] (cheap, deterministic)."""
    i = math.floor(x)
    t = x - i
    a = hash01("n", seed, i) * 2 - 1
    b = hash01("n", seed, i + 1) * 2 - 1
    return lerp(a, b, smoothstep(t))


# ---------------------------------------------------------------- points
def mirror(points: Iterable[Pt]) -> list[Pt]:
    return [(-x, y) for x, y in points]


def rot(p: Pt, deg: float, about: Pt = (0.0, 0.0)) -> Pt:
    a = math.radians(deg)
    x, y = p[0] - about[0], p[1] - about[1]
    return (about[0] + x * math.cos(a) - y * math.sin(a), about[1] + x * math.sin(a) + y * math.cos(a))


def add(p: Pt, q: Pt) -> Pt:
    return (p[0] + q[0], p[1] + q[1])


def scale_pts(points: Iterable[Pt], sx: float, sy: float | None = None, about: Pt = (0.0, 0.0)) -> list[Pt]:
    sy = sx if sy is None else sy
    return [(about[0] + (x - about[0]) * sx, about[1] + (y - about[1]) * sy) for x, y in points]


def offset_pts(points: Iterable[Pt], dx: float, dy: float) -> list[Pt]:
    return [(x + dx, y + dy) for x, y in points]


def dist(p: Pt, q: Pt) -> float:
    return math.hypot(q[0] - p[0], q[1] - p[1])


# ---------------------------------------------------------------- paths
def catmull(points: Sequence[Pt], closed: bool = False, tension: float = 1.0, move: bool = True) -> str:
    """Smooth path through every point (Catmull-Rom converted to cubic Béziers)."""
    pts = list(points)
    n = len(pts)
    if n < 2:
        return ""
    out = [f"M{f(pts[0][0])} {f(pts[0][1])}"] if move else []
    if n == 2 and not closed:
        out.append(f"L{f(pts[1][0])} {f(pts[1][1])}")
        return " ".join(out)
    rng = range(n) if closed else range(n - 1)
    k = tension / 6.0
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[(i + 1) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k)
        c2 = (p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k)
        out.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    if closed:
        out.append("Z")
    return " ".join(out)


def poly(points: Sequence[Pt], closed: bool = True) -> str:
    s = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)
    return s + (" Z" if closed else "")


def sample_catmull(points: Sequence[Pt], per_seg: int = 8, closed: bool = False) -> list[Pt]:
    """Sample a Catmull-Rom curve into a dense polyline (for offsetting / strands)."""
    pts = list(points)
    n = len(pts)
    if n < 2:
        return pts
    out: list[Pt] = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if (closed or i > 0) else pts[i]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (closed or i + 2 < n) else pts[(i + 1) % n]
        for s in range(per_seg):
            t = s / per_seg
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                       + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                       + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    if not closed:
        out.append(pts[-1])
    return out


def resample(polyline: Sequence[Pt], n: int) -> list[Pt]:
    """Resample a polyline to n points evenly spaced by arc length."""
    pts = list(polyline)
    if len(pts) < 2:
        return pts * n
    seg = [dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    total = sum(seg) or 1e-6
    out = []
    for k in range(n):
        target = total * k / (n - 1)
        acc = 0.0
        for i, s in enumerate(seg):
            if acc + s >= target or i == len(seg) - 1:
                t = 0 if s == 0 else (target - acc) / s
                out.append(lerp_pt(pts[i], pts[i + 1], clamp(t)))
                break
            acc += s
    return out


def tapered(center: Sequence[Pt], widths: Sequence[float] | None = None, w0: float = 1.0, w1: float = 1.0,
            wmid: float | None = None, per_seg: int = 6) -> str:
    """Closed filled shape around a centerline whose width varies along its length.

    Used for lash lines, brows, strands - anything that should look like an ink stroke.
    """
    dense = sample_catmull(center, per_seg=per_seg)
    n = len(dense)
    if widths is None:
        widths = []
        for i in range(n):
            u = i / max(1, n - 1)
            if wmid is None:
                widths.append(lerp(w0, w1, u))
            else:
                widths.append(lerp(w0, wmid, u * 2) if u < 0.5 else lerp(wmid, w1, (u - 0.5) * 2))
    else:
        src = list(widths)
        widths = []
        for i in range(n):
            pos = i / max(1, n - 1) * (len(src) - 1)
            j = min(len(src) - 2, int(pos)) if len(src) > 1 else 0
            widths.append(lerp(src[j], src[min(j + 1, len(src) - 1)], pos - j) if len(src) > 1 else src[0])
    left, right = [], []
    for i in range(n):
        a = dense[max(0, i - 1)]
        b = dense[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-6
        nx, ny = -dy / L, dx / L
        w = widths[i] / 2
        left.append((dense[i][0] + nx * w, dense[i][1] + ny * w))
        right.append((dense[i][0] - nx * w, dense[i][1] - ny * w))
    outline = left + right[::-1]
    return poly(outline)


# ---------------------------------------------------------------- elements
def attrs(**kw) -> str:
    parts = []
    for k, v in kw.items():
        if v is None:
            continue
        k = k.rstrip("_").replace("_", "-")
        if isinstance(v, float):
            v = f(v)
        parts.append(f'{k}="{v}"')
    return " ".join(parts)


def _paint_opacity(kw: dict) -> dict:
    """Element `opacity` forces resvg to allocate a layer; fill/stroke-opacity is equivalent and far cheaper
    whenever the element has only a fill or only a stroke."""
    op = kw.get("opacity")
    if op is None or "filter" in kw:
        return kw
    fill = kw.get("fill")
    stroke = kw.get("stroke")
    no_stroke = stroke in (None, "none")
    no_fill = fill == "none"
    if no_stroke:
        kw = dict(kw)
        kw["fill_opacity"] = kw.pop("opacity")
    elif no_fill:
        kw = dict(kw)
        kw["stroke_opacity"] = kw.pop("opacity")
    return kw


def path(d: str, **kw) -> str:
    return f'<path d="{d}" {attrs(**_paint_opacity(kw))}/>'


def circle(cx: float, cy: float, r: float, **kw) -> str:
    return f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" {attrs(**_paint_opacity(kw))}/>'


def ellipse(cx: float, cy: float, rx: float, ry: float, **kw) -> str:
    return f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" {attrs(**_paint_opacity(kw))}/>'


def rect(x: float, y: float, w: float, h: float, rx: float = 0, **kw) -> str:
    return f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(rx)}" {attrs(**_paint_opacity(kw))}/>'


def line(x1: float, y1: float, x2: float, y2: float, **kw) -> str:
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}" {attrs(**kw)}/>'


def group(children: Iterable[str] | str, **kw) -> str:
    body = children if isinstance(children, str) else "".join(children)
    a = attrs(**kw)
    return f"<g {a}>{body}</g>" if a else f"<g>{body}</g>"


def tf(x: float = 0, y: float = 0, s: float = 1, r: float = 0, sx: float | None = None, sy: float | None = None) -> str:
    """translate -> rotate -> scale transform string."""
    out = []
    if x or y:
        out.append(f"translate({f(x)} {f(y)})")
    if r:
        out.append(f"rotate({f(r)})")
    if sx is not None or sy is not None:
        out.append(f"scale({f(sx if sx is not None else s)} {f(sy if sy is not None else s)})")
    elif s != 1:
        out.append(f"scale({f(s)})")
    return " ".join(out)


def lin_grad(id_: str, stops: Sequence[tuple[float, str, float]], x1=0.0, y1=0.0, x2=0.0, y2=1.0,
             user: Sequence[float] | None = None) -> str:
    st = "".join(f'<stop offset="{f(o)}" stop-color="{c}" stop-opacity="{f(a)}"/>' for o, c, a in stops)
    if user is not None:
        ux1, uy1, ux2, uy2 = user
        return (f'<linearGradient id="{id_}" gradientUnits="userSpaceOnUse" x1="{f(ux1)}" y1="{f(uy1)}" '
                f'x2="{f(ux2)}" y2="{f(uy2)}">{st}</linearGradient>')
    return f'<linearGradient id="{id_}" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">{st}</linearGradient>'


def rad_grad(id_: str, stops: Sequence[tuple[float, str, float]], cx=0.5, cy=0.5, r=0.5, fx=None, fy=None,
             user: Sequence[float] | None = None) -> str:
    st = "".join(f'<stop offset="{f(o)}" stop-color="{c}" stop-opacity="{f(a)}"/>' for o, c, a in stops)
    if user is not None:
        ucx, ucy, ur = user
        return (f'<radialGradient id="{id_}" gradientUnits="userSpaceOnUse" cx="{f(ucx)}" cy="{f(ucy)}" r="{f(ur)}">'
                f"{st}</radialGradient>")
    fxy = f' fx="{f(fx)}" fy="{f(fy)}"' if fx is not None else ""
    return f'<radialGradient id="{id_}" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{fxy}>{st}</radialGradient>'


def blur_filter(id_: str, std: float, pad: float = 0.5) -> str:
    p = f(pad * 100)
    return (f'<filter id="{id_}" x="-{p}%" y="-{p}%" width="{f(100 + 2 * pad * 100)}%" height="{f(100 + 2 * pad * 100)}%">'
            f'<feGaussianBlur stdDeviation="{f(std)}"/></filter>')


class Defs:
    """Collects <defs> entries for one frame; ids are made unique with a prefix."""

    def __init__(self) -> None:
        self.items: list[str] = []
        self._n = 0

    def uid(self, base: str) -> str:
        self._n += 1
        return f"{base}{self._n}"

    def add(self, markup: str) -> None:
        self.items.append(markup)

    def markup(self) -> str:
        return "<defs>" + "".join(self.items) + "</defs>"
