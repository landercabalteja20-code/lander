"""Color helpers + the mood palette that drives the hair gimmick."""
from __future__ import annotations

import colorsys


def to_rgb(c: str) -> tuple[float, float, float]:
    c = c.lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    return tuple(int(c[i:i + 2], 16) / 255.0 for i in (0, 2, 4))  # type: ignore[return-value]


def to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, round(v * 255))):02x}" for v in rgb)


def mix(a: str, b: str, t: float) -> str:
    ra, rb = to_rgb(a), to_rgb(b)
    return to_hex(tuple(x + (y - x) * t for x, y in zip(ra, rb)))  # type: ignore[arg-type]


def hls_adjust(c: str, dl: float = 0.0, ds: float = 0.0, dh: float = 0.0) -> str:
    h, l, s = colorsys.rgb_to_hls(*to_rgb(c))
    h = (h + dh) % 1.0
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    return to_hex(colorsys.hls_to_rgb(h, l, s))


def darken(c: str, amt: float = 0.15) -> str:
    return hls_adjust(c, dl=-amt)


def lighten(c: str, amt: float = 0.15) -> str:
    return hls_adjust(c, dl=amt)


def shade(c: str, amt: float = 0.18) -> str:
    """Cel-shade tone: darker, a bit more saturated and nudged toward magenta (warm doll look)."""
    return hls_adjust(mix(c, "#7a2a6a", 0.12), dl=-amt, ds=0.08)


def ink(c: str) -> str:
    """Outline color derived from a fill: very dark, plum-tinted (never pure black)."""
    return mix(hls_adjust(c, dl=-0.55, ds=-0.1), "#2a1020", 0.6)


# Hair colors for each mood. In this world everyone's hair shows how they feel.
MOODS: dict[str, str] = {
    "lilac": "#c6b2ee",      # sleepy / neutral
    "pink": "#ff8fcf",       # crush / happy
    "hotpink": "#ff4fae",    # in LOVE
    "green": "#7ddc5a",      # jealous
    "lime": "#b6f03c",       # VERY jealous
    "blue": "#6fa6ff",       # sad
    "red": "#ff4a4a",        # mad
    "gold": "#ffd36a",       # confident / proud
    "violet": "#9b72f2",     # smug / sassy
    "sunny": "#ffe07a",      # cheerful
    "brown": "#7b4a32",      # calm (natural)
    "black": "#2b2230",
    "coral": "#ff8a73",      # embarrassed
}


def hair_color(name_or_hex: str) -> str:
    return MOODS.get(name_or_hex, name_or_hex)


def hair_tones(base: str) -> dict[str, str]:
    """Derive the full hair palette (fill, shadow, highlight, strand lines, outline) from one color."""
    return {
        "base": base,
        "shadow": shade(base, 0.16),
        "deep": shade(base, 0.30),
        "light": hls_adjust(base, dl=0.14, ds=0.05),
        "sheen": mix(hls_adjust(base, dl=0.26), "#ffffff", 0.35),
        "strand": hls_adjust(shade(base, 0.22), ds=0.1),
        "ink": ink(base),
    }
