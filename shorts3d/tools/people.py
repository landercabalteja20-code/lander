"""The cast of "What if people never normalized wearing clothes?", sculpted from SDF primitives.

People here are smooth, doll-like cartoon bodies with no anatomy at all (a Ken-doll torso, no navel, nothing to
censor). Coverage comes from the world's own logic: everybody wears a fanny pack (no pockets), fashion is body
paint, and the clothes that survive are tools (aprons, coats, hats, ties for some reason). Every accessory is its
own node, so a shot can take it off: c.nodes.pack.visible = false.

    .venv/bin/python tools/people.py [name ...]      -> assets/chars/<name>.glb + <name>.json

Model space: metres, +Y up, the character faces +Z. Legs have hips (leg_l/r) and knees (shin_l/r) for walking.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from sculpt import Model, box, cap, cone, cyl, ell, fbm, hexc, mirror, rotm, sphere, torus, tube, vnoise  # noqa: E402
from characters import OUT, dog, fur  # noqa: E402


# ------------------------------------------------------------------ colour helpers
def skinf(base: str, seed: int = 5):
    b = hexc(base)
    return lambda P: b * (0.965 + 0.07 * fbm(P, 26, seed))[:, None]


def solid(c: str, var: float = 0.05, scale: float = 60, seed: int = 2):
    b = hexc(c)
    return lambda P: b * (1 - var / 2 + var * fbm(P, scale, seed))[:, None]


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hsv(h, s, v):
    h = (np.asarray(h) % 1.0) * 6.0
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    s = np.broadcast_to(s, h.shape); v = np.broadcast_to(v, h.shape)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], 1).astype(np.float32)


def overlay(base, paint, region):
    """Colour fn: `paint` where region(P) (0..1, soft) else `base`."""
    def f(P):
        a = np.clip(region(P), 0, 1)[:, None]
        return base(P) * (1 - a) + paint(P) * a
    return f


# body-paint patterns (P -> rgb)
def p_rainbow(P):  # glitter rainbow
    c = hsv(P[:, 1] * 2.4 + P[:, 0] * 0.9, 0.62, 0.95)
    spk = (vnoise(P, 150, 9) > 0.8)[:, None]
    return np.where(spk, np.array([1.0, 0.97, 0.9], np.float32), c)


def p_leopard(P):
    n = vnoise(P, 30, 4)
    base = hexc("#e0a64a") * (0.92 + 0.12 * fbm(P, 50, 3))[:, None]
    ring = ((n > 0.6) & (n < 0.7))[:, None]
    core = (n >= 0.7)[:, None]
    return np.where(ring, hexc("#2e1d10"), np.where(core, hexc("#a8692c"), base))


def p_stars(P):
    spk = (vnoise(P, 55, 6) > 0.8)[:, None]
    return np.where(spk, hexc("#f2cb4c"), hexc("#22306a") * (0.9 + 0.15 * fbm(P, 40, 2))[:, None])


def p_emerald(P):
    band = (np.abs(((P[:, 1] - 0.7) * 9.0) % 1.0 - 0.5) < 0.04)[:, None]
    return np.where(band, hexc("#e9c457"), hexc("#13785a") * (0.9 + 0.15 * fbm(P, 40, 5))[:, None])


def p_splatter(P):
    out = hexc("#f4f1ea") * np.ones((len(P), 1), np.float32)
    for seed, col in ((11, "#e8423a"), (12, "#2e7ce0"), (13, "#f4c22e"), (14, "#3fae5a"), (15, "#9b4fd1")):
        m = (vnoise(P, 34, seed) > 0.74)[:, None]
        out = np.where(m, hexc(col), out)
    return out


def p_stripes(cols, period=0.07):
    cs = np.stack([hexc(c) for c in cols])
    return lambda P: cs[(np.floor(P[:, 1] / period).astype(int)) % len(cs)]


def p_vest(P):  # burgundy waistcoat with gold buttons down the front
    base = hexc("#7a1f33") * (0.9 + 0.12 * fbm(P, 50, 8))[:, None]
    btn = ((np.abs(P[:, 0]) < 0.012) & (np.abs(((P[:, 1] - 1.0) / 0.075) % 1.0 - 0.5) < 0.14) & (P[:, 2] > 0.05))[:, None]
    return np.where(btn, hexc("#e8c25a"), base)


def tattoo(base):  # ink sleeves on the arms
    def f(P):
        n = fbm(P, 7, 21)
        ink = ((np.abs(np.sin(n * 9.0)) < 0.16) & (P[:, 1] > 1.04)).astype(np.float32)[:, None]
        return base(P) * (1 - 0.85 * ink) + hexc("#22324c") * 0.85 * ink
    return f


def dress_region(y0=0.64, top=1.40, scoop=0.05):
    def r(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        neck = top - scoop * np.exp(-(x / 0.07) ** 2) * (z > 0)
        return sstep(y0 - 0.012, y0 + 0.012, y) * (1 - sstep(neck - 0.01, neck + 0.01, y))
    return r


# ------------------------------------------------------------------ surface probe
def probe(part, origin, direction, r0=0.0, r1=0.5, it=30):
    """Distance along `direction` from `origin` to where `part`'s SDF crosses zero (binary search)."""
    o = np.asarray(origin, np.float32); d = np.asarray(direction, np.float32); d = d / np.linalg.norm(d)
    lo, hi = r0, r1
    for _ in range(it):
        mid = (lo + hi) / 2
        if part.sdf((o + d * mid)[None])[0] > 0:
            hi = mid
        else:
            lo = mid
    return o + d * lo


# ------------------------------------------------------------------ the person
def person(name: str, skin: str, *, hair="side_part", hair_col="#3a2618", iris="#4a3322", fem=False, belly=0.0,
           body_paint=None, arm_paint=None, leg_paint=None, glasses=False, beard=None, mustache=None, hs=1.12,
           pack=None, tie=None, hat=None, badge=False, duty=False, apron=None, watch=None, necklace=None,
           pearls=False, earrings=None, bowtie=None, pelt=None, toga=None, coat=None, scarf=None, boots=None,
           shoes=None, lips=None, body_mat="skin", brow_col=None) -> Model:
    m = Model(name)
    sk = skinf(skin)
    bp, ap, lp = body_paint or sk, arm_paint or sk, leg_paint or sk
    lips = lips or ("#c0505e" if fem else "#a2554f")
    brow_col = brow_col or hair_col
    sw = 0.135 if fem else 0.16
    tr = (0.165, 0.258, 0.108) if fem else (0.19, 0.27, 0.12)
    cz, rz = belly * 0.04, tr[2] + belly * 0.05

    body = m.part("body", h=0.0075, material=body_mat)
    body.add(
        ell((0, 1.2, cz), (tr[0], tr[1], rz), bp),
        cap((-sw, 1.39, -0.005), (sw, 1.39, -0.005), 0.066 if fem else 0.075, bp, k=0.08),
        ell((0, 0.93, 0), (0.17 if fem else 0.175, 0.13, 0.112 if fem else 0.115), bp, k=0.08),
        cap((0, 1.42, 0), (0, 1.53, 0.012), 0.048 if fem else 0.056, sk, k=0.03),
    )
    # legs: hip (leg_*) and knee (shin_*) joints
    foot = shoes or boots
    for s, side in ((1, "l"), (-1, "r")):
        hx = s * (0.085 if fem else 0.09)
        leg = m.part(f"leg_{side}", (hx, 0.9, 0.0), parent="body", h=0.0055, material=body_mat)
        leg.add(cone((hx, 0.93, 0.0), (s * 0.092, 0.5, 0.005), 0.074 if fem else 0.078, 0.056 if fem else 0.059, lp))
        sh = m.part(f"shin_{side}", (s * 0.092, 0.5, 0.005), parent=f"leg_{side}", h=0.005, material=body_mat)
        fc = solid(foot, 0.04) if foot else sk
        sh.add(sphere((s * 0.092, 0.5, 0.005), 0.054 if fem else 0.057, lp),
               cone((s * 0.092, 0.5, 0.005), (s * 0.097, 0.1, 0.0), 0.052 if fem else 0.055, 0.038 if fem else 0.041, lp, k=0.03),
               ell((s * 0.097, 0.048, 0.045), (0.047, 0.044, 0.105) if fem else (0.05, 0.046, 0.112), fc, k=0.03))
        if boots:  # winter boots up the shin
            sh.add(cone((s * 0.097, 0.36, 0.003), (s * 0.097, 0.08, 0.01), 0.064, 0.06, solid(boots, 0.05), k=0.02),
                   ell((s * 0.097, 0.05, 0.05), (0.06, 0.055, 0.125), solid(boots, 0.05), k=0.02),
                   torus((s * 0.097, 0.36, 0.003), 0.064, 0.014, "#efe9df"))
        elif shoes:
            sh.add(ell((s * 0.097, 0.03, 0.05), (0.056, 0.03, 0.118), "#f2f2f2", k=0.01))  # sole
    # arms: shoulder (arm_*) and elbow (fore_*)
    for s, side in ((1, "l"), (-1, "r")):
        ax, ex, wx = s * (0.175 if fem else 0.2), s * (0.21 if fem else 0.235), s * (0.22 if fem else 0.245)
        arm = m.part(f"arm_{side}", (ax, 1.39, 0.0), parent="body", h=0.0055, material=body_mat)
        arm.add(cap((ax, 1.39, 0), (ex, 1.13, 0.01), 0.047 if fem else 0.055, ap))
        fore = m.part(f"fore_{side}", (ex, 1.13, 0.01), parent=f"arm_{side}", h=0.0042, material=body_mat)
        fore.add(cap((ex, 1.13, 0.01), (wx, 0.9, 0.04), 0.039 if fem else 0.045, ap),
                 ell((wx, 0.845, 0.05), (0.029, 0.053, 0.039) if fem else (0.032, 0.058, 0.042), sk, k=0.02),
                 cap((wx - s * 0.002, 0.865, 0.075), (wx - s * 0.008, 0.835, 0.088), 0.011 if fem else 0.012, sk, k=0.01))

    # head, scaled up about the neck for a friendlier cartoon look
    N0 = np.array([0, 1.53, 0.012])
    Hp = lambda p: tuple(float(v) for v in N0 + (np.asarray(p, float) - N0) * hs)
    Hr = lambda r: (float(r) * hs) if np.isscalar(r) else tuple(float(v) * hs for v in r)
    head = m.part("head", tuple(N0), parent="body", h=0.0034, material="skin")
    head.add(
        ell(Hp((0, 1.68, 0.0)), Hr((0.103, 0.123, 0.113) if fem else (0.105, 0.125, 0.115)), sk),
        ell(Hp((0, 1.6, 0.035)), Hr((0.084, 0.08, 0.088) if fem else (0.09, 0.085, 0.092)), sk, k=0.05),
        ell(Hp((0, 1.648, 0.112)), Hr((0.018, 0.03, 0.022) if fem else (0.02, 0.032, 0.024)), sk, k=0.02),
        sphere(Hp((0, 1.628, 0.123)), Hr(0.017 if fem else 0.019), sk, k=0.015),
        mirror(ell, Hp((0.104, 1.655, -0.005)), Hr((0.017, 0.034, 0.025)), sk, k=0.012),
        ell(Hp((0, 1.592, 0.112)), Hr((0.03, 0.0065 if fem else 0.0055, 0.01)), lips, op="paint", edge=0.004),
        ell(Hp((0, 1.583, 0.098)), Hr((0.034, 0.01, 0.02)), "#3a1416", op="paint", edge=0.003),
        mirror(ell, Hp((0.058, 1.632, 0.09)), Hr((0.022, 0.014, 0.01)), "#e58b7f", op="paint", edge=0.02) if fem else [],
    )
    jaw = m.part("jaw", Hp((0, 1.6, 0.02)), parent="head", h=0.003, material="skin")
    jaw.add(ell(Hp((0, 1.567, 0.064)), Hr((0.064, 0.042, 0.05) if fem else (0.068, 0.044, 0.052)), sk),
            ell(Hp((0, 1.585, 0.105)), Hr((0.033, 0.009, 0.012)), "#3a1416", op="paint", edge=0.004),
            ell(Hp((0, 1.574, 0.104)), Hr((0.028, 0.006, 0.01)), lips, op="paint", edge=0.004))
    for s, side in ((1, "l"), (-1, "r")):
        brow = m.part(f"brow_{side}", Hp((s * 0.042, 1.718, 0.104)), parent="head", h=0.0016, material="hair")
        brow.add(cap(Hp((s * 0.022, 1.716, 0.106)), Hp((s * 0.066, 1.722, 0.096)), Hr(0.006 if fem else 0.0075), brow_col))
        m.eye("head", Hp((s * 0.04, 1.676, 0.097)), Hr(0.022 if fem else 0.0205), iris=iris, lid=skin, look=(s * 0.12, 0, 1),
              iris_size=0.64, pupil_size=0.42)
    if glasses:
        gl = m.part("glasses", Hp((0, 1.677, 0.11)), parent="head", h=0.0012, material="glossy")
        gl.add(torus(Hp((0.041, 1.677, 0.119)), Hr(0.026), Hr(0.0032), "#2a2a2e", rot=(90, 0, 0)),
               torus(Hp((-0.041, 1.677, 0.119)), Hr(0.026), Hr(0.0032), "#2a2a2e", rot=(90, 0, 0)),
               cap(Hp((-0.016, 1.68, 0.121)), Hp((0.016, 1.68, 0.121)), Hr(0.003), "#2a2a2e", k=0.002),
               cap(Hp((0.066, 1.68, 0.115)), Hp((0.1, 1.678, 0.02)), Hr(0.0026), "#2a2a2e", k=0.002),
               cap(Hp((-0.066, 1.68, 0.115)), Hp((-0.1, 1.678, 0.02)), Hr(0.0026), "#2a2a2e", k=0.002))
    if mustache:
        mu = m.part("mustache", Hp((0, 1.605, 0.12)), parent="head", h=0.0016, material="hair")
        mu.add(mirror(ell, Hp((0.024, 1.606, 0.121)), Hr((0.03, 0.011, 0.012)), fur(mustache, 0.2, 90), rot=(0, 0, -14), k=0.006),
               mirror(sphere, Hp((0.054, 1.612, 0.112)), Hr(0.0095), fur(mustache, 0.2, 90), k=0.008))
    if beard:
        bd = m.part("beard", Hp((0, 1.6, 0.02)), parent="jaw", h=0.0034, material="hair")
        bd.add(ell(Hp((0, 1.555, 0.058)), Hr((0.1, 0.075, 0.078)), fur(beard, 0.25, 60)),
               ell(Hp((0, 1.5, 0.07)), Hr((0.065, 0.06, 0.055)), fur(beard, 0.25, 60), k=0.03),
               ell(Hp((0, 1.585, 0.112)), Hr((0.036, 0.016, 0.03)), beard, op="sub", k=0.008),
               ell(Hp((0, 1.66, 0.03)), Hr((0.15, 0.06, 0.15)), beard, op="sub", k=0.01))
    # hair
    if hair:
        hp = m.part("hair", Hp((0, 1.72, 0.0)), parent="head", h=0.0034, material="hair")
        hc = fur(hair_col, 0.22, 60)
        face_cut = ell(Hp((0, 1.62, 0.125)), Hr((0.13, 0.12, 0.11)), hair_col, op="sub", k=0.02)
        nape_cut = ell(Hp((0, 1.6, -0.06)), Hr((0.14, 0.1, 0.1)), hair_col, op="sub", k=0.03)
        if hair == "side_part":
            hp.add(ell(Hp((0, 1.735, -0.01)), Hr((0.115, 0.1, 0.127)), hc),
                   ell(Hp((0.03, 1.775, 0.04)), Hr((0.095, 0.05, 0.1)), hc, rot=(0, 0, -8), k=0.03), face_cut, nape_cut)
        elif hair == "messy":
            hp.add(ell(Hp((0, 1.74, -0.01)), Hr((0.118, 0.105, 0.13)), hc),
                   *[sphere(Hp((0.07 * np.cos(a), 1.81, 0.06 * np.sin(a) + 0.02)), Hr(0.045), hc, k=0.03)
                     for a in np.linspace(0, 2 * np.pi, 6, endpoint=False)],
                   face_cut, ell(Hp((0, 1.58, -0.05)), Hr((0.14, 0.09, 0.1)), hair_col, op="sub", k=0.03))
        elif hair == "bald_ring":
            hp.add(torus(Hp((0, 1.655, -0.012)), Hr(0.1), Hr(0.026), hc, rot=(-12, 0, 0)),
                   ell(Hp((0, 1.62, 0.13)), Hr((0.13, 0.11, 0.1)), hair_col, op="sub", k=0.03))
        elif hair == "slick":
            hp.add(ell(Hp((0, 1.735, -0.02)), Hr((0.113, 0.098, 0.125)), hc),
                   ell(Hp((0, 1.795, 0.035)), Hr((0.09, 0.045, 0.09)), hc, rot=(-14, 0, 0), k=0.035), face_cut, nape_cut)
        elif hair == "buzz":
            hp.add(ell(Hp((0, 1.7, -0.008)), Hr((0.109, 0.118, 0.121)), hc), face_cut,
                   ell(Hp((0, 1.575, -0.03)), Hr((0.15, 0.1, 0.13)), hair_col, op="sub", k=0.02))
        elif hair == "curly":
            curls = []
            for i in range(34):
                th = i * 2.39996
                zz = 1 - (i + 0.5) / 34 * 1.05
                rr = np.sqrt(max(0.0, 1 - zz * zz))
                dx, dy, dz = rr * np.cos(th), zz, rr * np.sin(th)
                if dz > 0.45 and dy < 0.55:
                    continue
                curls.append(sphere(Hp((0.118 * dx, 1.72 + 0.11 * dy, -0.01 + 0.13 * dz)), Hr(0.034), hc, k=0.012))
            hp.add(ell(Hp((0, 1.735, -0.012)), Hr((0.112, 0.1, 0.124)), hc), *curls, face_cut, nape_cut)
        elif hair in ("long", "bun", "pony", "wild"):
            big = 1.1 if hair == "wild" else 1.0
            hp.add(ell(Hp((0, 1.735 + 0.01 * (big - 1), -0.012)), Hr((0.117 * big, 0.105 * big, 0.128 * big)), hc))
            if hat != "beanie":
                hp.add(ell(Hp((-0.03, 1.778, 0.05)), Hr((0.09, 0.05, 0.088)), hc, rot=(0, 0, 10), k=0.03))
            hp.add(face_cut)
            if hair in ("long", "wild"):
                w = 1.25 if hair == "wild" else 1.0
                hp.add(ell(Hp((0, 1.56, -0.062)), Hr((0.128 * w, 0.2, 0.075 * w)), hc, k=0.04),
                       mirror(ell, Hp((0.097, 1.585, -0.005)), Hr((0.033 * w, 0.115, 0.058)), hc, k=0.03),
                       ell(Hp((0, 1.6, 0.13)), Hr((0.092, 0.11, 0.07)), hair_col, op="sub", k=0.02))
                if hair == "wild":  # shaggy tufts hanging off the mane
                    hp.add(*[cone(Hp((0.13 * np.cos(a), 1.62, 0.1 * np.sin(a) - 0.05)), Hp((0.15 * np.cos(a), 1.5, 0.11 * np.sin(a) - 0.07)),
                                  Hr(0.04), Hr(0.012), hc, k=0.03) for a in np.linspace(np.pi * 0.95, np.pi * 2.05, 6)], face_cut)
            elif hair == "bun":
                hp.add(sphere(Hp((0, 1.83, -0.07)), Hr(0.056), hc, k=0.02), nape_cut)
            else:
                hp.add(tube([Hp((0, 1.76, -0.11)), Hp((0, 1.68, -0.17)), Hp((0, 1.55, -0.16))], [Hr(0.035), Hr(0.04), Hr(0.02)], hc, k=0.02),
                       nape_cut)

    # ---------------------------------------------------------------- accessories (each its own node)
    front = lambda y, x=0.0: probe(body, (x, y, 0.0), (0, 0, 1), 0.0, 0.4)
    if pack:
        col, trim = (pack, pack) if isinstance(pack, str) else pack
        pk = m.part("pack", (0, 0.95, 0.12), parent="body", h=0.0038, material="cloth")
        pk.add(ell((0, 0.975, 0.0), (0.19 if not fem else 0.186, 0.022, 0.13), solid(trim, 0.08)),
               ell((0, 0.975, 0.0), (0.176 if not fem else 0.172, 0.05, 0.116), trim, op="sub", k=0.004),
               box((0, 0.892, 0.126), (0.115, 0.072, 0.035), solid(col, 0.08, 90), rnd=0.03, k=0.01),
               box((0, 0.928, 0.161), (0.1, 0.0035, 0.004), "#1c1c1c", op="paint", edge=0.003),
               sphere((0.07, 0.924, 0.163), 0.008, "#d6d6d6", k=0.002))
    if tie:
        tcol, stripe = (tie, None) if isinstance(tie, str) else tie
        tf = solid(tcol, 0.06) if not stripe else (lambda P: np.where(((((P[:, 0] + P[:, 1]) * 22) % 1.0) < 0.22)[:, None], hexc(stripe), hexc(tcol)))
        ti = m.part("tie", (0, 1.45, 0.07), parent="body", h=0.0026, material="cloth")
        k0 = front(1.44)
        ti.add(torus((0, 1.47, 0.006), 0.061 if not fem else 0.053, 0.0075, tf, rot=(-16, 0, 0)),
               ell((0, 1.44, k0[2] + 0.012), (0.022, 0.025, 0.016), tf, k=0.008))
        for y, wx in ((1.39, 0.024), (1.33, 0.028), (1.27, 0.032), (1.21, 0.034)):
            f0, f1 = front(y + 0.02), front(y - 0.02)
            ang = np.degrees(np.arctan2(f0[2] - f1[2], 0.04))
            ti.add(ell((0, y, (f0[2] + f1[2]) / 2 + 0.009), (wx, 0.042, 0.007), tf, rot=(ang, 0, 0), k=0.02))
        ft = front(1.155)
        ti.add(box((0, 1.165, ft[2] + 0.009), (0.025, 0.025, 0.007), tf, rot=(0, 0, 45), k=0.012))
    if bowtie:
        bt = m.part("bowtie", (0, 1.45, 0.07), parent="body", h=0.0022, material="cloth")
        f0 = front(1.44)
        bt.add(mirror(ell, (0.036, 1.44, f0[2] + 0.014), (0.036, 0.025, 0.012), bowtie, rot=(0, 0, 8), k=0.004),
               ell((0, 1.44, f0[2] + 0.019), (0.014, 0.016, 0.013), bowtie, k=0.004),
               torus((0, 1.47, 0.006), 0.061, 0.005, bowtie, rot=(-16, 0, 0)))
    if necklace or pearls:
        nk = m.part("necklace", (0, 1.43, 0.0), parent="body", h=0.002, material="metal" if necklace else "glossy")
        col = necklace or "#f3eee4"
        for a in np.linspace(-np.pi * 0.62, np.pi * 0.62, 23):
            y = 1.43 - 0.045 * np.cos(a) ** 2
            q = probe(body, (0, y, 0.0), (np.sin(a), 0, np.cos(a)), 0.0, 0.3)
            nk.add(sphere(tuple(q + np.array([np.sin(a), 0, np.cos(a)]) * 0.004), 0.0075 if pearls else 0.005, col, k=0.004))
        if necklace:
            q = probe(body, (0, 1.37, 0.0), (0, 0, 1), 0.0, 0.3)
            nk.add(ell((0, 1.365, q[2] + 0.008), (0.014, 0.018, 0.006), col, k=0.006))
    if earrings:
        er = m.part("earrings", Hp((0, 1.62, 0)), parent="head", h=0.0015, material="metal")
        er.add(mirror(sphere, Hp((0.104, 1.618, 0.0)), Hr(0.009), earrings))
    if badge:
        ly = m.part("lanyard", (0, 1.4, 0.05), parent="body", h=0.0022, material="cloth")
        fb = front(1.3)
        for s in (1, -1):
            a = probe(body, (0, 1.47, 0), (s * 0.6, 0, 0.8), 0, 0.3)
            b = probe(body, (s * 0.045, 1.39, 0), (0, 0, 1), 0, 0.3)
            ly.add(tube([tuple(a + [0, 0, 0.004]), tuple(b + [0, 0, 0.004]), (0.0, 1.31, fb[2] + 0.004)], [0.004, 0.004, 0.004], "#1b2c5a", k=0.004))
        bd = m.part("badge", (0, 1.27, fb[2]), parent="body", h=0.0016, material="metal")
        fb = front(1.27)
        bd.add(ell((0, 1.27, fb[2] + 0.006), (0.032, 0.04, 0.0075), "#e2b84a"),
               ell((0, 1.27, fb[2] + 0.013), (0.016, 0.018, 0.004), "#b88b2a", op="paint", edge=0.004))
    if duty:
        bt = m.part("belt", (0, 0.98, 0), parent="body", h=0.0038, material="glossy")
        blk = solid("#17171a", 0.05)
        bt.add(ell((0, 0.99, 0.0), (0.197, 0.034, 0.137), blk),
               ell((0, 0.99, 0.0), (0.178, 0.07, 0.118), "#17171a", op="sub", k=0.004),
               box((0, 0.99, 0.137), (0.03, 0.026, 0.008), "#c9c9c9", rnd=0.004, k=0.004),
               mirror(box, (0.175, 0.975, 0.055), (0.03, 0.05, 0.034), blk, rnd=0.01, k=0.01),
               mirror(box, (0.12, 0.975, -0.115), (0.034, 0.045, 0.028), blk, rnd=0.01, k=0.01))
    if hat:
        ht = m.part("hat", Hp((0, 1.78, 0.0)), parent="head", h=0.003, material="cloth")
        if hat == "cop":
            navy = solid("#1d2a44", 0.06)
            ht.add(cyl(Hp((0, 1.735, -0.006)), Hp((0, 1.805, -0.006)), Hr(0.119), navy, rnd=0.006),
                   ell(Hp((0, 1.828, 0.0)), Hr((0.137, 0.042, 0.146)), navy, k=0.025),
                   ell(Hp((0, 1.744, 0.118)), Hr((0.088, 0.011, 0.056)), "#0c0c10", rot=(-16, 0, 0), k=0.004),
                   box(Hp((0, 1.757, 0.11)), Hr((0.11, 0.006, 0.02)), "#e3c25a", op="paint", edge=0.003),
                   ell(Hp((0, 1.785, 0.12)), Hr((0.02, 0.022, 0.012)), "#e3c25a", op="paint", edge=0.004))
        elif hat == "chef":
            wht = solid("#f7f5f0", 0.05)
            ht.add(cyl(Hp((0, 1.725, -0.006)), Hp((0, 1.86, -0.006)), Hr(0.118), wht, rnd=0.01),
                   ell(Hp((0, 1.95, -0.006)), Hr((0.15, 0.1, 0.15)), wht, k=0.03),
                   *[sphere(Hp((0.11 * np.cos(a), 1.96, 0.11 * np.sin(a) - 0.006)), Hr(0.06), wht, k=0.03)
                     for a in np.linspace(0, 2 * np.pi, 7, endpoint=False)])
        elif hat == "laurel":
            ht.material = "fur"
            Rm = rotm(-12, 0, 0)
            c0 = np.array(Hp((0, 1.76, -0.012))); Rr = Hr(0.132)
            ht.add(torus(tuple(c0), Rr, Hr(0.007), "#5d8a2a", rot=(-12, 0, 0)))
            for i in range(26):
                a = i / 26 * 2 * np.pi
                if np.cos(a - np.pi / 2) > 0.93:
                    continue  # gap at the front
                ring = np.array([np.cos(a), 0, np.sin(a)]) * Rr
                for s in (1, -1):
                    off = np.array([np.cos(a), 0, np.sin(a)]) * 0.016 * s + np.array([0, 0.012, 0])
                    pos = c0 + (ring + off) @ Rm.T
                    ht.add(ell(tuple(float(v) for v in pos), Hr((0.011, 0.006, 0.027)), "#8cc43c" if s > 0 else "#74b02e",
                               rot=(20 * s, -np.degrees(a) + 90, 25 * s), k=0.004))
        elif hat == "beanie":
            col, pom = hat_cols = ("#d84a3a", "#f3efe6")
            knit = lambda P: hexc(col) * (0.85 + 0.2 * (np.abs(np.sin(np.arctan2(P[:, 0], P[:, 2]) * 30)) > 0.5))[:, None]
            ht.add(ell(Hp((0, 1.745, -0.012)), Hr((0.124, 0.115, 0.134)), knit),
                   ell(Hp((0, 1.6, 0.04)), Hr((0.2, 0.11, 0.2)), col, op="sub", k=0.01),
                   torus(Hp((0, 1.712, -0.012)), Hr(0.123), Hr(0.018), solid(pom, 0.05), rot=(-6, 0, 0)),
                   sphere(Hp((0, 1.87, -0.02)), Hr(0.035), solid(pom, 0.1), k=0.01))
    if apron:
        col, trim = (apron, apron) if isinstance(apron, str) else apron
        af = col if callable(col) else solid(col, 0.05)
        sk_ = m.part("apron", (0, 1.0, 0.13), parent="body", h=0.0042, material="cloth")
        sk_.add(ell((0, 0.99, 0.0), (0.19, 0.012, 0.13), solid(trim, 0.05)),
                ell((0, 0.99, 0.0), (0.176, 0.05, 0.116), trim, op="sub", k=0.003),
                ell((0, 0.8, 0.0), (0.218, 0.31, 0.162 + belly * 0.03), af, k=0.004),
                ell((0, 0.8, -0.004), (0.206, 0.34, 0.15 + belly * 0.03), col if isinstance(col, str) else "#ffffff", op="sub", k=0.002),
                box((0, 0.8, -0.27), (0.4, 0.5, 0.3), "#ffffff", op="sub", k=0.002),
                box((0, 1.25, 0), (0.4, 0.23, 0.4), "#ffffff", op="sub", k=0.002),
                box((0, 0.25, 0), (0.4, 0.27, 0.4), "#ffffff", op="sub", k=0.002),
                mirror(box, (0.38, 0.8, 0), (0.2, 0.5, 0.4), "#ffffff", op="sub", k=0.002))
        bib = m.part("apron_bib", (0, 1.25, 0.13), parent="body", h=0.0042, material="cloth")
        bib.add(ell((0, 1.2, cz), (tr[0] + 0.012, tr[1] + 0.012, rz + 0.012), af),
                ell((0, 1.2, cz), (tr[0] + 0.003, tr[1] + 0.003, rz + 0.003), "#ffffff", op="sub", k=0.002),
                box((0, 1.2, cz - 0.27), (0.4, 0.4, 0.3), "#ffffff", op="sub", k=0.002),
                mirror(box, (0.33, 1.2, 0), (0.21, 0.5, 0.4), "#ffffff", op="sub", k=0.002),
                box((0, 1.77, 0), (0.4, 0.4, 0.4), "#ffffff", op="sub", k=0.002),
                box((0, 0.6, 0), (0.4, 0.4, 0.4), "#ffffff", op="sub", k=0.002),
                torus((0, 1.47, 0.0), 0.062 if not fem else 0.054, 0.006, solid(trim, 0.05), rot=(-22, 0, 0)))
    if watch:
        s = 1
        wx = 0.22 if fem else 0.245
        wt = m.part("watch", (wx - 0.001, 0.925, 0.037), parent="fore_l", h=0.0016, material="metal")
        wt.add(torus((wx - 0.001, 0.925, 0.037), 0.042 if fem else 0.047, 0.008, watch),
               cyl((wx + 0.038 if fem else wx + 0.043, 0.925, 0.037), (wx + 0.056 if fem else wx + 0.061, 0.925, 0.037), 0.023, watch, rnd=0.004, k=0.004),
               cyl((wx + 0.055 if fem else wx + 0.06, 0.925, 0.037), (wx + 0.058 if fem else wx + 0.063, 0.925, 0.037), 0.0185, "#f6f2e8", rnd=0.001, k=0.001))
    if pelt:
        pl = m.part("pelt", (0, 1.1, 0), parent="body", h=0.0055, material="fur")
        pc = lambda P: hexc(pelt) * (0.7 + 0.45 * fbm(P, 24, 7))[:, None] * np.where(vnoise(P, 18, 3) > 0.72, 0.6, 1.0)[:, None]
        hx = 0.2 if fem else 0.215
        pl.add(ell((0, 1.15, cz), (hx, 0.28, rz + 0.025), pc),
               ell((0, 0.88, 0.0), (hx + 0.02, 0.2, 0.16), pc, k=0.05),
               box((0, 1.61, 0), (0.4, 0.2, 0.4), pc, op="sub", k=0.02),
               box((0, 0.56, 0), (0.4, 0.2, 0.4), pc, op="sub", k=0.01),
               *[sphere((0.24 * np.cos(a), 0.745 + 0.025 * np.sin(5 * a), 0.17 * np.sin(a)), 0.035, pc, op="sub", k=0.01)
                 for a in np.linspace(0, 2 * np.pi, 15, endpoint=False)])
    if toga:
        tg = m.part("toga", (0, 1.1, 0), parent="body", h=0.0055, material="cloth")
        tc = lambda P: hexc(toga) * (0.86 + 0.14 * np.sin(P[:, 0] * 55 + P[:, 1] * 18 + 2 * fbm(P, 12, 2)))[:, None]
        hx = 0.2 if fem else 0.215
        tg.add(ell((0, 1.15, cz), (hx, 0.28, rz + 0.025), tc),
               ell((0, 0.75, 0.0), (hx + 0.03, 0.42, 0.17), tc, k=0.06),
               box((0, 1.61, 0), (0.4, 0.2, 0.4), tc, op="sub", k=0.02),
               box((0, 0.13, 0), (0.4, 0.2, 0.4), tc, op="sub", k=0.01),
               tube([(0.07, 1.33, 0.11), (0.17, 1.47, 0.0), (0.07, 1.33, -0.1)], [0.05, 0.055, 0.05], tc, k=0.04),
               tube([(0.16, 1.4, 0.1), (-0.05, 1.12, 0.15), (-0.2, 0.9, 0.08)], [0.02, 0.025, 0.02], tc, k=0.03))
    if coat:
        quilt = lambda P: hexc(coat) * (0.78 + 0.25 * sstep(0.0, 0.5, np.abs(np.cos(np.pi * P[:, 1] / 0.075))))[:, None]
        hx = 0.215 if fem else 0.235
        ct = m.part("coat", (0, 1.15, 0), parent="body", h=0.0055, material="cloth")
        ct.add(ell((0, 1.14, cz), (hx, 0.36, rz + 0.055), quilt),
               cap((-sw - 0.01, 1.385, -0.005), (sw + 0.01, 1.385, -0.005), 0.1 if not fem else 0.09, quilt, k=0.08),
               ell((0, 0.86, 0.0), (hx, 0.14, 0.16), quilt, k=0.08),
               box((0, 0.6, 0), (0.4, 0.13, 0.4), quilt, op="sub", k=0.02),
               cap((0, 1.44, 0.0), (0, 1.5, 0.01), 0.075, quilt, k=0.02),
               cyl((0, 1.4, 0.0), (0, 1.62, 0.02), 0.058 if not fem else 0.05, coat, op="sub", k=0.01),
               box((0, 1.0, rz + cz + 0.05), (0.006, 0.42, 0.012), "#c9c9c9", op="paint", edge=0.004))
        for s, side in ((1, "l"), (-1, "r")):
            ax, ex, wx = s * (0.175 if fem else 0.2), s * (0.21 if fem else 0.235), s * (0.22 if fem else 0.245)
            sl = m.part(f"csl_{side}", (ax, 1.39, 0.0), parent=f"arm_{side}", h=0.0055, material="cloth")
            sl.add(cap((ax, 1.39, 0), (ex, 1.13, 0.01), 0.074 if not fem else 0.066, quilt))
            sf = m.part(f"csf_{side}", (ex, 1.13, 0.01), parent=f"fore_{side}", h=0.0055, material="cloth")
            sf.add(cap((ex, 1.13, 0.01), (wx, 0.925, 0.038), 0.066 if not fem else 0.058, quilt),
                   cyl((wx, 0.94, 0.036), (wx, 0.905, 0.041), 0.06 if not fem else 0.052, "#3a3a3a", rnd=0.01, k=0.01))
    if scarf:
        a, b = scarf
        sc = m.part("scarf", (0, 1.47, 0), parent="body", h=0.0035, material="cloth")
        stripes = lambda P: np.where((((P[:, 1] + np.arctan2(P[:, 0], P[:, 2]) * 0.03) / 0.03) % 2.0 < 1.0)[:, None], hexc(a), hexc(b))
        sc.add(torus((0, 1.47, 0.012), 0.08 if not fem else 0.072, 0.03, stripes, rot=(-10, 0, 0)),
               tube([(0.05, 1.46, 0.09), (0.07, 1.3, 0.17), (0.08, 1.12, 0.18)], [0.03, 0.028, 0.026], stripes, k=0.02))
    m.extra["notes"] = {"height": round(1.53 + (1.8 - 1.53) * hs, 3), "fem": fem, "hs": hs}
    return m


# ------------------------------------------------------------------ the cast
def sam() -> Model:  # "you": the narrator's everyman
    return person("sam", "#d9a27e", hair="messy", hair_col="#3b2416", iris="#5a3a1e", pack=("#1fa39a", "#126b64"),
                  apron=(lambda P: np.where(((np.floor(P[:, 0] / 0.035) + np.floor(P[:, 1] / 0.035)) % 2 == 0)[:, None],
                                            hexc("#d63b3b"), hexc("#f5efe6")), "#d63b3b"),
                  watch="#d9b04a")


def boss() -> Model:
    return person("boss", "#e0ab88", hair="bald_ring", hair_col="#6b5a4a", iris="#3b5a7a", glasses=True, belly=1.0,
                  tie=("#b0302e", "#7c1d1c"), pack=("#6b4428", "#4a2e1a"))


def cop() -> Model:
    return person("cop", "#7b4a30", hair="buzz", hair_col="#16100c", iris="#2a1a10", hat="cop", badge=True, duty=True,
                  pack=("#17171a", "#17171a"), mustache="#1a120c")


def chef() -> Model:
    return person("chef", "#f0c8a8", hair="side_part", hair_col="#2a1a10", iris="#3b5a7a", hat="chef", mustache="#1e1410",
                  apron=("#f7f5f0", "#f7f5f0"), bowtie="#d23b32")


def tux() -> Model:  # painted-on tuxedo
    def t_body(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        jacket = hexc("#141418") * (0.9 + 0.15 * fbm(P, 50, 3))[:, None]
        v = (z > 0.02) & (y > 1.0) & (np.abs(x) < (y - 1.0) * 0.42)
        lapel = (z > 0.02) & (y > 1.0) & (np.abs(x) >= (y - 1.0) * 0.42) & (np.abs(x) < (y - 1.0) * 0.42 + 0.03)
        bow = (z > 0.02) & (np.abs(y - 1.43) < 0.016) & (np.abs(x) < 0.045 - 0.6 * np.abs(y - 1.43))
        btn = (z > 0.02) & (np.abs(x) < 0.008) & (np.abs(((y - 1.06) / 0.07) % 1.0 - 0.5) < 0.12) & (y < 1.36)
        out = np.where(v[:, None], hexc("#f6f5f0"), np.where(lapel[:, None], hexc("#2a2a33"), jacket))
        out = np.where(btn[:, None], hexc("#141418"), out)
        out = np.where(bow[:, None], hexc("#0a0a0c"), out)
        return np.where((y > 1.465)[:, None], skinf("#b67a55")(P), out)
    def t_arm(P):
        cuff = (P[:, 1] < 0.935) & (P[:, 1] > 0.9)
        return np.where(cuff[:, None], hexc("#f6f5f0"), hexc("#141418") * (0.9 + 0.15 * fbm(P, 50, 3))[:, None])
    def t_leg(P):
        stripe = np.abs(np.abs(P[:, 0]) - 0.16) < 0.006
        return np.where(stripe[:, None], hexc("#2a2a33"), hexc("#141418") * (0.9 + 0.15 * fbm(P, 50, 4))[:, None])
    return person("tux", "#b67a55", hair="slick", hair_col="#16110e", iris="#2a1a10", body_paint=t_body, arm_paint=t_arm,
                  leg_paint=t_leg, shoes="#0c0c0e")


def diva() -> Model:
    r = dress_region(0.62, 1.4, 0.05)
    return person("diva", "#f2c6a6", fem=True, hair="long", hair_col="#f0d3a0", iris="#3b6a8a",
                  body_paint=overlay(skinf("#f2c6a6"), p_rainbow, r), leg_paint=overlay(skinf("#f2c6a6"), p_rainbow, r),
                  earrings="#e8c25a", lips="#c23a5a", shoes="#e8c25a")


def painter() -> Model:
    r = dress_region(0.66, 1.4, 0.04)
    return person("painter", "#c58c66", fem=True, hair="bun", hair_col="#2a1b14", iris="#3a2618",
                  body_paint=overlay(skinf("#c58c66"), p_splatter, r), leg_paint=overlay(skinf("#c58c66"), p_splatter, r),
                  pack=("#e8a33a", "#9a6418"), shoes="#3a3a3a")


def runner(name: str, skin: str, hair_col: str, beard=None) -> Model:
    return person(name, skin, hair="curly", hair_col=hair_col, iris="#3a2618", hat="laurel", beard=beard)


def caveman() -> Model:
    return person("caveman", "#c08a62", hair="wild", hair_col="#3a2618", iris="#3a2618", beard="#3a2618", pelt="#8a5a32")


def cavewoman() -> Model:
    return person("cavewoman", "#d6a07a", fem=True, hair="wild", hair_col="#5a3a22", iris="#3a2618", pelt="#9a6a3a")


def suit() -> Model:  # the one person who shows up fully dressed
    def s_body(P):
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        jacket = hexc("#2b3a63") * (0.9 + 0.12 * fbm(P, 50, 3))[:, None]
        v = (z > 0.02) & (y > 1.05) & (np.abs(x) < (y - 1.05) * 0.38)
        lapel = (z > 0.02) & (y > 1.05) & (np.abs(x) >= (y - 1.05) * 0.38) & (np.abs(x) < (y - 1.05) * 0.38 + 0.03)
        out = np.where(v[:, None], hexc("#f4f4ef"), np.where(lapel[:, None], hexc("#22304f"), jacket))
        btn = (z > 0.02) & (np.abs(x) < 0.008) & (np.abs(y - 1.0) < 0.012)
        out = np.where(btn[:, None], hexc("#111111"), out)
        return np.where((y > 1.47)[:, None], skinf("#e8c0a0")(P), out)
    arm = lambda P: np.where((P[:, 1] < 0.94)[:, None] & (P[:, 1] > 0.905)[:, None], hexc("#f4f4ef"), hexc("#2b3a63") * (0.9 + 0.12 * fbm(P, 50, 3))[:, None])
    leg = lambda P: hexc("#26335a") * (0.9 + 0.12 * fbm(P, 50, 4))[:, None]
    return person("suit", "#e8c0a0", hair="side_part", hair_col="#8a5a2a", iris="#3b5a7a", glasses=True,
                  body_paint=s_body, arm_paint=arm, leg_paint=leg, shoes="#1a1412", tie=("#c0302c", "#8a1f1d"), body_mat="cloth")


def guest_a() -> Model:
    r = dress_region(0.6, 1.39, 0.06)
    return person("guest_a", "#8d5a3c", fem=True, hair="bun", hair_col="#120c0a", iris="#2a1a10",
                  body_paint=overlay(skinf("#8d5a3c"), p_emerald, r), leg_paint=overlay(skinf("#8d5a3c"), p_emerald, r),
                  necklace="#e8c25a", earrings="#e8c25a", lips="#9a2a3a", pack=("#e8c25a", "#a8822a"), shoes="#e8c25a")


def guest_b() -> Model:
    r = dress_region(0.95, 1.4, 0.07)
    return person("guest_b", "#e3b28f", hair="side_part", hair_col="#3a2a1a", iris="#3b5a7a",
                  body_paint=overlay(skinf("#e3b28f"), p_vest, r), bowtie="#d23b32", pack=("#3a2a2a", "#241818"), shoes="#141414")


def guest_c() -> Model:
    r = dress_region(0.6, 1.39, 0.05)
    return person("guest_c", "#f0c8a8", fem=True, hair="long", hair_col="#7a2e1e", iris="#3b6a3a",
                  body_paint=overlay(skinf("#f0c8a8"), p_stars, r), leg_paint=overlay(skinf("#f0c8a8"), p_stars, r),
                  pearls=True, lips="#b23a48", pack=("#22306a", "#141c44"), shoes="#22306a")


def guest_d() -> Model:
    return person("guest_d", "#5a3a28", hair=None, hair_col="#140e0a", iris="#2a1a10", beard="#140e0a",
                  arm_paint=tattoo(skinf("#5a3a28")), necklace="#e8c25a", pack=("#c84a2a", "#8a2e18"), shoes="#f2f2f2")


def leopard() -> Model:
    r = dress_region(0.62, 1.4, 0.05)
    return person("leopard", "#e8b48e", fem=True, hair="pony", hair_col="#2a1a12", iris="#4a3322",
                  body_paint=overlay(skinf("#e8b48e"), p_leopard, r), leg_paint=overlay(skinf("#e8b48e"), p_leopard, r),
                  pack=("#d84a8a", "#9a2a5a"), shoes="#141414", lips="#b23a48")


def stripes_guy() -> Model:
    r = dress_region(0.9, 1.42, 0.0)
    return person("stripes", "#c99a6e", hair="curly", hair_col="#1a120c", iris="#3a2618",
                  body_paint=overlay(skinf("#c99a6e"), p_stripes(["#f2c64a", "#2e7ce0", "#f4f1ea"]), r),
                  pack=("#f2c64a", "#a8822a"), shoes="#2e7ce0", glasses=True)


def coat_a() -> Model:
    return person("coat_a", "#e0ab88", hair="buzz", hair_col="#6b4520", iris="#3b5a7a", hat="beanie", coat="#c8323c",
                  scarf=("#f3efe6", "#2e5a8a"), boots="#5a3a22", pack=("#2e5a8a", "#1c3a5a"))


def coat_b() -> Model:
    return person("coat_b", "#c58c66", fem=True, hair="long", hair_col="#2a1b14", iris="#3a2618", hat="beanie", coat="#1f8a8a",
                  scarf=("#f2c64a", "#c8323c"), boots="#3a2a22", pack=("#c8323c", "#8a1f1d"))


def greek(name: str, skin: str, hair_col: str, fem=False, cloth="#f2eee4") -> Model:
    return person(name, skin, fem=fem, hair="long" if fem else "curly", hair_col=hair_col, iris="#3a2618", toga=cloth,
                  beard=None if fem else hair_col)


def dog_sweater() -> Model:
    m = dog()
    m.name = "dog_sweater"
    knit = lambda P: (np.where(((P[:, 1] / 0.06) % 2.0 < 1.0)[:, None], hexc("#c8323c"), hexc("#f4efe6"))
                      * (0.86 + 0.18 * (np.abs(np.sin(P[:, 0] * 260)) > 0.4))[:, None])
    sw = m.part("sweater", (0, 0.45, 0.05), parent="body", h=0.005, material="cloth")
    sw.add(ell((0, 0.40, 0.04), (0.182, 0.285, 0.182), knit, rot=(32, 0, 0)),
           sphere((0, 0.46, 0.12), 0.165, knit, k=0.07),
           mirror(cap, (0.085, 0.43, 0.13), (0.087, 0.31, 0.155), 0.064, knit, k=0.05),
           torus((0, 0.585, 0.128), 0.12, 0.034, knit, rot=(18, 0, 0)),
           box((0, 0.04, 0), (0.4, 0.2, 0.5), knit, op="sub", k=0.03))
    return m


def louse(name: str = "louse", col: str = "#b27a3c") -> Model:
    """A cartoon louse, modelled ~0.2 m long (scale it down in the scene)."""
    m = Model(name)
    dark = "#5a3a1e"
    shell = lambda P: (hexc(col) * (0.85 + 0.2 * fbm(P, 40, 3))[:, None]
                       * np.where((np.abs(((P[:, 2] + 0.12) / 0.028) % 1.0 - 0.5) < 0.1) & (P[:, 2] < 0.02), 0.62, 1.0)[:, None])
    b = m.part("body", (0, 0.05, 0), h=0.0026, material="glossy")
    b.add(ell((0, 0.052, -0.045), (0.056, 0.032, 0.078), shell),
          ell((0, 0.056, 0.045), (0.036, 0.026, 0.03), solid(col, 0.1), k=0.012),
          mirror(sphere, (0.05, 0.06, -0.04), 0.006, dark, op="paint", edge=0.003),
          mirror(sphere, (0.045, 0.06, -0.075), 0.006, dark, op="paint", edge=0.003))
    hd = m.part("head", (0, 0.056, 0.07), parent="body", h=0.002, material="glossy")
    hd.add(ell((0, 0.06, 0.098), (0.027, 0.022, 0.032), solid(col, 0.1)),
           ell((0, 0.05, 0.128), (0.012, 0.008, 0.008), dark, k=0.006))
    m.eye("head", (0.016, 0.074, 0.112), 0.0115, iris="#2b1a10", lid=col, look=(0.25, 0, 1))
    m.eye("head", (-0.016, 0.074, 0.112), 0.0115, iris="#2b1a10", lid=col, look=(-0.25, 0, 1))
    m.strand("head", (0.012, 0.072, 0.124), (0.04, 0.105, 0.172), 0.0028, dark)
    m.strand("head", (-0.012, 0.072, 0.124), (-0.04, 0.105, 0.172), 0.0028, dark)
    for i, z in enumerate((0.062, 0.045, 0.028)):
        for s, side in ((1, "l"), (-1, "r")):
            lg = m.part(f"leg{i}{side}", (s * 0.028, 0.048, z), parent="body", h=0.0018, material="glossy")
            zz = z + 0.015 * (1 - i)
            lg.add(tube([(s * 0.028, 0.048, z), (s * 0.072, 0.074, zz), (s * 0.108, 0.006, zz + 0.012)], [0.0075, 0.0065, 0.005], solid(col, 0.1)),
                   cone((s * 0.108, 0.006, zz + 0.012), (s * 0.098, 0.0, zz + 0.026), 0.006, 0.002, dark, k=0.003))
    return m


CAST = {"sam": sam, "boss": boss, "cop": cop, "chef": chef, "tux": tux, "diva": diva, "painter": painter,
        "runner1": lambda: runner("runner1", "#c99a6e", "#2a1a10"),
        "runner2": lambda: runner("runner2", "#e0b48c", "#6b4520"),
        "runner3": lambda: runner("runner3", "#8a5a3a", "#140e0a", beard="#140e0a"),
        "caveman": caveman, "cavewoman": cavewoman, "suit": suit,
        "guest_a": guest_a, "guest_b": guest_b, "guest_c": guest_c, "guest_d": guest_d, "leopard": leopard, "stripes": stripes_guy,
        "coat_a": coat_a, "coat_b": coat_b,
        "greek_a": lambda: greek("greek_a", "#d6a07a", "#3a2618"),
        "greek_b": lambda: greek("greek_b", "#b9875e", "#1a120c", fem=True, cloth="#e9dcc0"),
        "dog_sweater": dog_sweater, "louse": louse, "headlouse": lambda: louse("headlouse", "#7d6a58")}

if __name__ == "__main__":
    names = sys.argv[1:] or list(CAST)
    for n in names:
        CAST[n]().export(OUT)
