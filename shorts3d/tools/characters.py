"""The cast of "What if animals could somehow talk?", sculpted from SDF primitives.

    .venv/bin/python tools/characters.py [name ...]      -> assets/chars/<name>.glb + <name>.json

Model space: metres, +Y up, the character faces +Z. Parts are nodes that rotate at their pivot.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from sculpt import Model, box, cap, cone, ell, fbm, hexc, mirror, sphere, torus, tube, vnoise  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "assets" / "chars"


def fur(base: str, var: float = 0.14, scale: float = 22, seed: int = 1):
    """Base colour with soft mottling, so big areas don't look like plastic."""
    b = hexc(base)
    return lambda P: b * (1 - var / 2 + var * fbm(P, scale, seed))[:, None]


def mix(a: str, b: str, t: float):
    return hexc(a) * (1 - t) + hexc(b) * t


# ============================================================================== dog
def dog() -> Model:
    GOLD, DEEP, CREAM, NOSE = "#d6974c", "#b9772f", "#f2d29b", "#1d1615"
    m = Model("dog")
    body = m.part("body", (0, 0, 0), h=0.0062)
    body.add(
        ell((0, 0.40, 0.04), (0.165, 0.27, 0.165), fur(GOLD), rot=(32, 0, 0)),
        sphere((0, 0.17, -0.10), 0.165, fur(GOLD), k=0.08),
        sphere((0, 0.46, 0.12), 0.15, fur(CREAM, seed=2), k=0.07),
        mirror(ell, (0.13, 0.17, -0.02), (0.075, 0.125, 0.16), fur(GOLD, seed=3), rot=(-12, 0, 0), k=0.05),
        mirror(ell, (0.135, 0.036, 0.12), (0.056, 0.036, 0.088), fur(CREAM, seed=4), k=0.04),
        mirror(cap, (0.085, 0.43, 0.13), (0.086, 0.075, 0.17), 0.049, fur(GOLD, seed=5), k=0.05),
        mirror(ell, (0.086, 0.036, 0.205), (0.058, 0.037, 0.076), fur(CREAM, seed=6), k=0.035),
        cap((0, 0.5, 0.1), (0, 0.71, 0.17), 0.112, fur(GOLD, seed=7), k=0.07),
        ell((0, 0.56, 0.17), (0.135, 0.15, 0.1), fur(CREAM, seed=8), k=0.06),
    )
    head = m.part("head", (0, 0.72, 0.18), parent="body", h=0.0034)
    head.add(
        ell((0, 0.845, 0.2), (0.132, 0.122, 0.132), fur(GOLD, seed=9)),
        mirror(sphere, (0.07, 0.795, 0.27), 0.074, fur(GOLD, seed=10), k=0.05),
        ell((0, 0.85, 0.285), (0.08, 0.06, 0.065), fur(GOLD, seed=11), k=0.05),
        ell((0, 0.795, 0.355), (0.066, 0.052, 0.105), fur(CREAM, seed=12), k=0.045),
        mirror(ell, (0.046, 0.878, 0.312), (0.03, 0.013, 0.02), fur(DEEP), k=0.02),
        # roof of the mouth and lip line: only seen when the jaw drops
        ell((0, 0.748, 0.36), (0.058, 0.02, 0.1), "#3d0f14", op="paint", edge=0.005),
        ell((0, 0.757, 0.36), (0.064, 0.008, 0.104), "#2a1714", op="paint", edge=0.004),
        cap((0, 0.796, 0.43), (0, 0.768, 0.432), 0.0035, "#3a2220", op="paint", edge=0.003),
    )
    nose = m.part("nose", (0, 0.82, 0.44), parent="head", h=0.0022, material="glossy")
    nose.add(ell((0, 0.822, 0.445), (0.034, 0.024, 0.024), NOSE),
             ell((0, 0.814, 0.43), (0.03, 0.02, 0.02), NOSE, k=0.01),
             sphere((0.013, 0.82, 0.466), 0.0078, "#060404", op="sub", k=0.004),
             sphere((-0.013, 0.82, 0.466), 0.0078, "#060404", op="sub", k=0.004))
    m.eye("head", (0.054, 0.857, 0.322), 0.031, iris="#5b3417", lid=GOLD, look=(0.15, 0.05, 1))
    m.eye("head", (-0.054, 0.857, 0.322), 0.031, iris="#5b3417", lid=GOLD, look=(-0.15, 0.05, 1))
    for s, name in ((1, "ear_l"), (-1, "ear_r")):
        ear = m.part(name, (s * 0.105, 0.915, 0.175), parent="head", h=0.0034)
        ear.add(ell((s * 0.14, 0.835, 0.175), (0.032, 0.105, 0.068), fur(DEEP, seed=13), rot=(0, 0, s * 12)),
                ell((s * 0.115, 0.905, 0.175), (0.03, 0.03, 0.05), fur(GOLD), k=0.03))
    jaw = m.part("jaw", (0, 0.765, 0.25), parent="head", h=0.0032)
    jaw.add(
        ell((0, 0.745, 0.345), (0.052, 0.024, 0.09), fur(CREAM, seed=14)),
        sphere((0, 0.741, 0.39), 0.024, fur(CREAM, seed=15), k=0.03),
        ell((0, 0.757, 0.35), (0.045, 0.01, 0.085), "#3d0f14", op="paint", edge=0.004),
        ell((0, 0.758, 0.33), (0.032, 0.008, 0.055), "#d96f7d", k=0.004),
    )
    tail = m.part("tail", (0, 0.11, -0.22), parent="body", h=0.0055)
    tail.add(tube([(0, 0.11, -0.22), (0.04, 0.05, -0.38), (0.13, 0.035, -0.48), (0.24, 0.04, -0.52)],
                  [0.045, 0.052, 0.042, 0.018], fur(GOLD, seed=16)))
    m.extra["notes"] = {"height": 0.98, "talk": "jaw.rotation.x up to 0.45 rad"}
    return m


def stripes(base: str, dark: str, freq: float, axis=(0, 1, 0), warp: float = 3.0, width: float = 0.38, seed: int = 3):
    """Tabby stripes: bands along `axis`, wobbled by noise."""
    b, d, ax = hexc(base), hexc(dark), np.asarray(axis, np.float32)
    def f(P):
        s = np.sin((P @ ax) * freq + warp * fbm(P, 9, seed) * 6.0)
        m = np.clip((s - (1 - 2 * width)) / 0.35, 0, 1)[:, None]
        v = (0.92 + 0.16 * fbm(P, 30, seed + 5))[:, None]
        return (b * (1 - m) + d * m) * v
    return f


def patches(white: str, black: str, scale: float, thresh: float = 0.56, seed: int = 4):
    """Holstein patches from thresholded noise."""
    w, k = hexc(white), hexc(black)
    def f(P):
        n = fbm(P, scale, seed, octaves=3)
        m = np.clip((n - thresh) / 0.03, 0, 1)[:, None]
        return w * (1 - m) + k * m
    return f


# ============================================================================== cat
def cat() -> Model:
    GRAY, DARK, WHITE, PINK = "#8e9098", "#4a4b52", "#efefea", "#e39aa6"
    tabby = lambda seed=3, axis=(0, 1, 0.25), freq=95: stripes(GRAY, DARK, freq, axis, seed=seed)
    m = Model("cat")
    body = m.part("body", h=0.0042)
    body.add(
        ell((0, 0.1, -0.03), (0.118, 0.1, 0.13), tabby(3)),
        ell((0, 0.19, 0.035), (0.085, 0.14, 0.085), tabby(4), rot=(16, 0, 0), k=0.06),
        sphere((0, 0.215, 0.075), 0.068, WHITE, k=0.05),
        mirror(ell, (0.07, 0.022, 0.07), (0.036, 0.021, 0.062), tabby(5), k=0.03),
        mirror(cap, (0.04, 0.22, 0.08), (0.041, 0.035, 0.1), 0.024, tabby(6, (1, 0, 0), 120), k=0.03),
        mirror(ell, (0.041, 0.019, 0.115), (0.03, 0.019, 0.036), WHITE, k=0.025),
        cap((0, 0.25, 0.04), (0, 0.315, 0.062), 0.062, tabby(7), k=0.04),
        ell((0, 0.2, 0.09), (0.06, 0.09, 0.03), WHITE, op="paint", edge=0.02),
    )
    head = m.part("head", (0, 0.315, 0.062), parent="body", h=0.0026)
    head.add(
        ell((0, 0.356, 0.07), (0.085, 0.074, 0.078), stripes(GRAY, DARK, 150, (1, 0, 0), seed=8)),
        mirror(sphere, (0.042, 0.33, 0.098), 0.05, tabby(9), k=0.03),
        mirror(sphere, (0.017, 0.323, 0.142), 0.022, WHITE, k=0.02),
        ell((0, 0.335, 0.14), (0.03, 0.025, 0.02), WHITE, k=0.02),
        ell((0, 0.34, 0.158), (0.011, 0.0075, 0.007), PINK, k=0.006),
        ell((0, 0.312, 0.142), (0.026, 0.008, 0.02), "#3a1418", op="paint", edge=0.004),
        cap((0, 0.333, 0.162), (0, 0.322, 0.16), 0.002, "#5b3a3c", op="paint", edge=0.002),
    )
    for s, name in ((1, "ear_l"), (-1, "ear_r")):
        ear = m.part(name, (s * 0.05, 0.395, 0.06), parent="head", h=0.0022)
        ear.add(cone((s * 0.05, 0.39, 0.06), (s * 0.074, 0.472, 0.052), 0.036, 0.003, tabby(10)),
                ell((s * 0.057, 0.428, 0.08), (0.021, 0.038, 0.013), PINK, op="sub", k=0.006))
    jaw = m.part("jaw", (0, 0.322, 0.1), parent="head", h=0.002)
    jaw.add(ell((0, 0.3155, 0.128), (0.02, 0.0085, 0.02), WHITE),
            ell((0, 0.3215, 0.13), (0.016, 0.003, 0.016), "#3a1418", op="paint", edge=0.003))
    tail = m.part("tail", (0, 0.04, -0.12), parent="body", h=0.0034)
    tail.add(tube([(0, 0.04, -0.12), (0.09, 0.022, -0.11), (0.14, 0.022, -0.01), (0.115, 0.022, 0.09), (0.05, 0.026, 0.14)],
                  [0.027, 0.026, 0.024, 0.022, 0.018], stripes(GRAY, DARK, 110, (0.3, 0, 1), seed=11)))
    for s in (1, -1):
        m.eye("head", (s * 0.034, 0.358, 0.127), 0.0245, iris="#86b83a", pupil="slit", lid=GRAY, look=(s * 0.2, 0.0, 1),
              iris_size=0.8, pupil_size=0.62)
        for k, dy in enumerate((0.006, -0.002, -0.009)):
            m.strand("head", (s * 0.03, 0.326 + dy, 0.15), (s * 0.11, 0.33 + dy * 2.2 + 0.004, 0.13 - k * 0.006), 0.0008, "#f4f4f0")
    return m


# ============================================================================== cows
def cow_head() -> Model:
    """Hero cow for the drive-thru close-ups: shoulders, neck, head, ears, jaw."""
    W, K, PINK = "#f3f1ea", "#1f1d1d", "#e6a3a6"
    hol = lambda seed: patches(W, K, 4.2, 0.55, seed)
    m = Model("cow_head")
    neck = m.part("neck", h=0.009)
    neck.add(ell((0, 0.95, -0.62), (0.36, 0.42, 0.42), hol(1)),
             cap((0, 0.95, -0.45), (0, 1.22, -0.02), 0.2, hol(2), k=0.12))
    head = m.part("head", (0, 1.25, 0.0), parent="neck", h=0.004)
    head.add(
        ell((0, 1.37, 0.07), (0.15, 0.13, 0.15), W),
        ell((0, 1.25, 0.23), (0.11, 0.15, 0.15), W, rot=(28, 0, 0), k=0.08),
        ell((0, 1.125, 0.36), (0.12, 0.085, 0.092), PINK, k=0.05),
        sphere((0, 1.47, 0.07), 0.06, W, k=0.06),
        mirror(cone, (0.115, 1.455, 0.04), (0.2, 1.53, 0.09), 0.03, 0.011, "#e9dcc0", k=0.02),
        mirror(sphere, (0.046, 1.13, 0.452), 0.019, "#3b2224", op="sub", k=0.01),
        ell((0.1, 1.37, 0.12), (0.085, 0.11, 0.12), K, op="paint", edge=0.02),
        ell((-0.13, 1.42, 0.02), (0.06, 0.08, 0.1), K, op="paint", edge=0.02),
        ell((0, 1.075, 0.37), (0.1, 0.02, 0.08), "#3d1216", op="paint", edge=0.006),
    )
    for s, name in ((1, "ear_l"), (-1, "ear_r")):
        ear = m.part(name, (s * 0.15, 1.38, 0.02), parent="head", h=0.003)
        ear.add(ell((s * 0.235, 1.37, 0.03), (0.105, 0.036, 0.058), K if s > 0 else W, rot=(0, 0, s * 12)),
                ell((s * 0.25, 1.37, 0.06), (0.07, 0.022, 0.03), PINK, op="sub", k=0.01))
    jaw = m.part("jaw", (0, 1.1, 0.22), parent="head", h=0.0035)
    jaw.add(ell((0, 1.06, 0.355), (0.092, 0.042, 0.082), PINK),
            ell((0, 1.075, 0.35), (0.075, 0.012, 0.07), "#3d1216", op="paint", edge=0.006))
    for s in (1, -1):
        m.eye("head", (s * 0.118, 1.33, 0.2), 0.036, iris="#2b1a10", lid=K if s > 0 else W, look=(s * 0.55, 0.0, 1),
              iris_size=0.95, pupil_size=0.55)
    return m


def cow() -> Model:
    """Low-detail standing cow for the herd (one mesh, instanced hundreds of times)."""
    W, K, PINK = "#f3f1ea", "#1f1d1d", "#e6a3a6"
    m = Model("cow")
    b = m.part("body", h=0.022, decimate=0.8)
    b.add(ell((0, 0.95, 0), (0.3, 0.32, 0.72), patches(W, K, 2.2, 0.55, 5)),
          mirror(cap, (0.18, 0.8, 0.5), (0.18, 0.04, 0.52), 0.07, patches(W, K, 2.2, 0.55, 6), k=0.08),
          mirror(cap, (0.18, 0.8, -0.5), (0.18, 0.04, -0.52), 0.075, patches(W, K, 2.2, 0.55, 7), k=0.08),
          cap((0, 1.05, 0.65), (0, 1.2, 0.95), 0.15, W, k=0.12),
          ell((0, 1.12, 1.05), (0.12, 0.16, 0.2), W, rot=(30, 0, 0), k=0.06),
          ell((0, 1.0, 1.18), (0.11, 0.08, 0.09), PINK, k=0.04),
          mirror(ell, (0.18, 1.25, 0.95), (0.09, 0.03, 0.05), K, k=0.02),
          sphere((0, 0.62, -0.25), 0.12, PINK, k=0.06),
          cap((0, 1.15, -0.72), (0, 0.45, -0.82), 0.025, K, k=0.02))
    return m


# ============================================================================== birds
def pigeon() -> Model:
    G, WING, BAR, NECKG, NECKP = "#8d96a6", "#a0a8b4", "#2c2e35", "#3f8f6a", "#7a4d8f"
    def neck_col(P):
        t = (np.sin(P[:, 0] * 60 + P[:, 1] * 40) * 0.5 + 0.5)[:, None]
        return hexc(NECKG) * t + hexc(NECKP) * (1 - t)
    m = Model("pigeon")
    body = m.part("body", h=0.0028, material="feather")
    body.add(
        ell((0, 0.13, -0.005), (0.066, 0.064, 0.112), fur(G, 0.1, 40), rot=(-14, 0, 0)),
        sphere((0, 0.152, 0.05), 0.058, fur("#9aa1b0", 0.1, 40), k=0.05),
        mirror(ell, (0.052, 0.145, -0.035), (0.026, 0.056, 0.112), fur(WING, 0.1, 40), rot=(-16, 0, 0), k=0.02),
        mirror(cap, (0.07, 0.15, -0.06), (0.074, 0.14, -0.02), 0.008, BAR, op="paint", edge=0.006),
        mirror(cap, (0.072, 0.135, -0.09), (0.076, 0.125, -0.05), 0.008, BAR, op="paint", edge=0.006),
        ell((0, 0.108, -0.155), (0.036, 0.012, 0.075), fur("#6f7684", 0.1, 40), rot=(-14, 0, 0), k=0.03),
        ell((0, 0.097, -0.215), (0.035, 0.015, 0.02), BAR, op="paint", edge=0.008),
        mirror(cap, (0.02, 0.085, 0.01), (0.022, 0.008, 0.016), 0.0065, "#c35b5f", k=0.012),
        mirror(cap, (0.022, 0.006, 0.016), (0.026, 0.004, 0.045), 0.0045, "#c35b5f", k=0.006),
    )
    head = m.part("head", (0, 0.19, 0.055), parent="body", h=0.0019, material="feather")
    head.add(
        cap((0, 0.165, 0.05), (0, 0.225, 0.072), 0.036, neck_col),
        sphere((0, 0.246, 0.082), 0.031, fur(G, 0.08, 50), k=0.025),
        sphere((0, 0.252, 0.108), 0.0072, "#e9e5de", k=0.006),
        cone((0, 0.248, 0.106), (0, 0.241, 0.131), 0.0075, 0.0025, "#3a3536", k=0.004),
    )
    jaw = m.part("jaw", (0, 0.241, 0.104), parent="head", h=0.0012, material="glossy")
    jaw.add(cone((0, 0.239, 0.106), (0, 0.236, 0.126), 0.0055, 0.002, "#2f2a2b"))
    for s in (1, -1):
        m.eye("head", (s * 0.021, 0.254, 0.093), 0.0088, iris="#e8742a", lid=G, look=(s * 0.8, 0.1, 0.6),
              iris_size=1.0, pupil_size=0.42)
    return m


def macaw() -> Model:
    RED, YEL, BLU, GRN, WHITE = "#d3261b", "#f2b81f", "#2e63c4", "#3f9a55", "#f3eee6"
    m = Model("macaw")
    body = m.part("body", h=0.0034, material="feather")
    body.add(
        ell((0, 0.3, 0.0), (0.078, 0.14, 0.082), fur(RED, 0.12, 35), rot=(14, 0, 0)),
        ell((0, 0.08, -0.13), (0.034, 0.24, 0.016), fur(RED, 0.1, 35), rot=(28, 0, 0), k=0.03),
        ell((0, 0.02, -0.17), (0.03, 0.12, 0.014), BLU, op="paint", edge=0.02),
        mirror(cap, (0.03, 0.18, 0.04), (0.032, 0.13, 0.06), 0.012, "#5b5552", k=0.015),
        mirror(cap, (0.032, 0.13, 0.06), (0.032, 0.125, 0.095), 0.009, "#5b5552", k=0.008),
    )
    for s, name in ((1, "wing_l"), (-1, "wing_r")):
        w = m.part(name, (s * 0.07, 0.38, 0.0), parent="body", h=0.0028, material="feather")
        w.add(ell((s * 0.075, 0.27, -0.035), (0.03, 0.13, 0.085), fur(RED, 0.1, 35), rot=(18, 0, 0)),
              ell((s * 0.082, 0.24, -0.04), (0.035, 0.05, 0.09), YEL, op="paint", edge=0.015),
              ell((s * 0.08, 0.205, -0.05), (0.034, 0.03, 0.09), GRN, op="paint", edge=0.012),
              ell((s * 0.08, 0.15, -0.06), (0.034, 0.06, 0.09), BLU, op="paint", edge=0.015))
    head = m.part("head", (0, 0.42, 0.04), parent="body", h=0.0022, material="feather")
    head.add(
        ell((0, 0.482, 0.05), (0.06, 0.064, 0.066), fur(RED, 0.08, 40)),
        cap((0, 0.42, 0.03), (0, 0.46, 0.045), 0.05, fur(RED, 0.08, 40), k=0.03),
        mirror(ell, (0.045, 0.474, 0.072), (0.022, 0.03, 0.04), WHITE, op="paint", edge=0.008),
    )
    beak = m.part("beak", (0, 0.48, 0.1), parent="head", h=0.0016, material="glossy")
    beak.add(ell((0, 0.475, 0.112), (0.026, 0.03, 0.03), "#efe4cf"),
             tube([(0, 0.497, 0.108), (0, 0.492, 0.138), (0, 0.472, 0.158), (0, 0.445, 0.158), (0, 0.425, 0.145)],
                  [0.02, 0.018, 0.013, 0.008, 0.003], "#efe4cf", k=0.012),
             ell((0, 0.44, 0.152), (0.012, 0.022, 0.014), "#2f2a29", op="paint", edge=0.008),
             mirror(ell, (0.022, 0.47, 0.115), (0.006, 0.022, 0.025), "#3a3433", op="paint", edge=0.005))
    jaw = m.part("jaw", (0, 0.46, 0.09), parent="head", h=0.0016, material="glossy")
    jaw.add(ell((0, 0.447, 0.118), (0.02, 0.016, 0.024), "#1f1c1c"),
            ell((0, 0.44, 0.13), (0.012, 0.012, 0.014), "#1f1c1c", k=0.01))
    for s in (1, -1):
        m.eye("head", (s * 0.049, 0.49, 0.077), 0.0105, iris="#ead9a2", lid=WHITE, look=(s * 0.75, 0.05, 0.65),
              iris_size=0.85, pupil_size=0.38)
    return m


# ============================================================================== humans
def human(name: str, skin: str, hair: str, hair_col: str, shirt: str, pants: str, tie: str | None = None,
          iris: str = "#4a3322", belly: float = 0.0) -> Model:
    SH = "#2b2522"
    m = Model(name)
    def outfit(P):
        y = P[:, 1:2]
        c = np.where(y > 0.93, hexc(shirt), hexc(pants))
        return np.where(y < 0.1, hexc(SH), c) * (0.95 + 0.1 * fbm(P, 40, 2))[:, None]
    body = m.part("body", h=0.008, material="cloth")
    body.add(
        ell((0, 1.2, 0.0 + belly * 0.04), (0.19, 0.27, 0.12 + belly * 0.05), outfit),
        cap((-0.16, 1.39, -0.005), (0.16, 1.39, -0.005), 0.075, outfit, k=0.08),
        ell((0, 0.93, 0), (0.175, 0.13, 0.115), outfit, k=0.08),
        mirror(cap, (0.09, 0.88, 0), (0.1, 0.1, 0.015), 0.072, outfit, k=0.06),
        mirror(ell, (0.1, 0.05, 0.05), (0.058, 0.048, 0.125), outfit, k=0.03),
        cap((0, 1.42, 0), (0, 1.53, 0.012), 0.056, skin, k=0.03),
        ell((0, 1.44, 0.07), (0.07, 0.04, 0.03), skin, op="paint", edge=0.015),
    )
    if tie:
        body.add(ell((0, 1.28, 0.115 + belly * 0.05), (0.022, 0.13, 0.012), tie, op="paint", edge=0.006),
                 ell((0, 1.4, 0.1), (0.02, 0.018, 0.012), tie, op="paint", edge=0.005))
    for s, side in ((1, "l"), (-1, "r")):
        arm = m.part(f"arm_{side}", (s * 0.2, 1.39, 0.0), parent="body", h=0.006, material="cloth")
        arm.add(cap((s * 0.2, 1.39, 0), (s * 0.235, 1.13, 0.01), 0.055, outfit))
        fore = m.part(f"fore_{side}", (s * 0.235, 1.13, 0.01), parent=f"arm_{side}", h=0.0045, material="cloth")
        fore.add(cap((s * 0.235, 1.13, 0.01), (s * 0.245, 0.9, 0.04), 0.045, outfit),
                 ell((s * 0.247, 0.84, 0.05), (0.032, 0.058, 0.042), skin, k=0.02),
                 cap((s * 0.247, 0.86, 0.075), (s * 0.24, 0.83, 0.09), 0.012, skin, k=0.01))
    head = m.part("head", (0, 1.53, 0.012), parent="body", h=0.0034, material="skin")
    head.add(
        ell((0, 1.68, 0.0), (0.105, 0.125, 0.115), skin),
        ell((0, 1.6, 0.035), (0.09, 0.085, 0.092), skin, k=0.05),
        ell((0, 1.648, 0.112), (0.02, 0.032, 0.024), skin, k=0.02),
        sphere((0, 1.628, 0.124), 0.019, skin, k=0.015),
        mirror(ell, (0.106, 1.655, -0.005), (0.018, 0.036, 0.026), skin, k=0.012),
        ell((0, 1.592, 0.112), (0.03, 0.0055, 0.01), "#a2554f", op="paint", edge=0.004),
        ell((0, 1.583, 0.098), (0.034, 0.01, 0.02), "#3a1416", op="paint", edge=0.003),
    )
    jaw = m.part("jaw", (0, 1.6, 0.02), parent="head", h=0.003, material="skin")
    jaw.add(ell((0, 1.565, 0.07), (0.07, 0.045, 0.055), skin),
            ell((0, 1.585, 0.105), (0.033, 0.009, 0.012), "#3a1416", op="paint", edge=0.004))
    for s, side in ((1, "l"), (-1, "r")):
        brow = m.part(f"brow_{side}", (s * 0.042, 1.718, 0.104), parent="head", h=0.0016, material="hair")
        brow.add(cap((s * 0.022, 1.716, 0.106), (s * 0.066, 1.722, 0.096), 0.0075, hair_col))
        m.eye("head", (s * 0.04, 1.676, 0.097), 0.0205, iris=iris, lid=skin, look=(s * 0.12, 0, 1), iris_size=0.62, pupil_size=0.42)
    hp = m.part("hair", (0, 1.72, 0.0), parent="head", h=0.0034, material="hair")
    face_cut = ell((0, 1.62, 0.125), (0.13, 0.12, 0.11), hair_col, op="sub", k=0.02)
    if hair == "side_part":
        hp.add(ell((0, 1.735, -0.01), (0.115, 0.1, 0.127), fur(hair_col, 0.2, 60)),
               ell((0.03, 1.775, 0.04), (0.095, 0.05, 0.1), fur(hair_col, 0.2, 60), rot=(0, 0, -8), k=0.03),
               face_cut, ell((0, 1.6, -0.06), (0.14, 0.1, 0.1), hair_col, op="sub", k=0.03))
    elif hair == "messy":
        hp.add(ell((0, 1.74, -0.01), (0.118, 0.105, 0.13), fur(hair_col, 0.25, 60)),
               *[sphere((0.07 * np.cos(a), 1.81, 0.06 * np.sin(a) + 0.02), 0.045, fur(hair_col, 0.25, 60), k=0.03)
                 for a in np.linspace(0, 2 * np.pi, 6, endpoint=False)],
               face_cut, ell((0, 1.58, -0.05), (0.14, 0.09, 0.1), hair_col, op="sub", k=0.03))
    elif hair == "bald_ring":
        hp.add(torus((0, 1.655, -0.012), 0.1, 0.026, fur(hair_col, 0.2, 60), rot=(-12, 0, 0)),
               ell((0, 1.62, 0.13), (0.13, 0.11, 0.1), hair_col, op="sub", k=0.03))
    return m


def gary() -> Model:
    return human("gary", "#e3b28f", "side_part", "#5a3a22", "#b9d3ea", "#3c4250", tie="#b0302e", iris="#3b5a7a", belly=1.0)


def owner() -> Model:
    return human("owner", "#c98d68", "messy", "#2a1c14", "#5a7f5d", "#34384a", iris="#3a2618")


def bald() -> Model:
    return human("bald", "#e0ab88", "bald_ring", "#6b5a4a", "#c96a3a", "#2f3644", iris="#4a3322")


def hand() -> Model:
    """Your right hand from the POV shot, palm up under a burger (the burger itself is built in three.js)."""
    SKIN, SLEEVE = "#c98d68", "#5a7f5d"
    m = Model("hand")
    h = m.part("hand", h=0.0022, material="skin")
    h.add(ell((0, 0.0, -0.005), (0.047, 0.017, 0.052), SKIN),
          cap((0, -0.008, -0.05), (0, -0.05, -0.26), 0.03, SKIN, k=0.025),
          cap((0, -0.04, -0.2), (0, -0.09, -0.45), 0.046, fur(SLEEVE, 0.12, 60), k=0.01),
          torus((0, -0.035, -0.19), 0.045, 0.008, fur(SLEEVE, 0.12, 60), rot=(78, 0, 0), k=0.01),
          cap((-0.044, 0.0, -0.012), (-0.072, 0.026, 0.01), 0.0115, SKIN, k=0.012),
          cap((-0.072, 0.026, 0.01), (-0.07, 0.055, 0.018), 0.0105, SKIN, k=0.006))
    for i, x in enumerate((-0.03, -0.01, 0.01, 0.03)):
        L = 1.0 - abs(i - 1.3) * 0.08
        h.add(cap((x, 0.0, 0.04), (x, 0.022 * L, 0.068), 0.0092, SKIN, k=0.01),
              cap((x, 0.022 * L, 0.068), (x * 1.05, 0.052 * L, 0.069), 0.0085, SKIN, k=0.005),
              ell((x * 1.05, 0.056 * L, 0.0715), (0.006, 0.006, 0.003), "#e9c2b0", op="paint", edge=0.003))
    return m


CAST = {"dog": dog, "cat": cat, "cow_head": cow_head, "cow": cow, "pigeon": pigeon, "macaw": macaw,
        "gary": gary, "owner": owner, "bald": bald, "hand": hand}

if __name__ == "__main__":
    names = sys.argv[1:] or list(CAST)
    for n in names:
        CAST[n]().export(OUT)
