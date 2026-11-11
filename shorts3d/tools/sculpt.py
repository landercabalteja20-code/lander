"""Sculpt characters from signed-distance primitives and export them as GLB node trees.

A Model is a tree of Parts (nodes). Every primitive is written in *model space* (metres, +Y up, +Z forward);
each part's mesh is re-centred on its pivot so the node can rotate there (jaw hinge, ear root, tail base...).
Shapes blend like clay (smooth union / smooth subtraction), colours blend with them, and "paint" primitives
colour a region without changing the shape (muzzles, patches, inner ears).

Meshing: marching cubes on a voxel grid, light Taubin smoothing, quadric decimation, and normals taken from
the analytic SDF gradient, so surfaces shade smoothly even after decimation.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import trimesh
from skimage.measure import marching_cubes

try:
    import fast_simplification
except ImportError:  # optional
    fast_simplification = None


# ----------------------------------------------------------------------------- math helpers
def rotm(rx: float = 0, ry: float = 0, rz: float = 0) -> np.ndarray:
    """Rotation matrix from XYZ Euler angles in degrees (applied X, then Y, then Z)."""
    rx, ry, rz = np.radians([rx, ry, rz])
    cx, sx, cy, sy, cz, sz = np.cos(rx), np.sin(rx), np.cos(ry), np.sin(ry), np.cos(rz), np.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def hexc(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def C(c) -> np.ndarray | callable:
    if callable(c):
        return c
    if isinstance(c, str):
        return hexc(c)
    return np.asarray(c, np.float32)


def _hash3(i: np.ndarray, seed: int) -> np.ndarray:
    h = (i[..., 0] * 73856093) ^ (i[..., 1] * 19349663) ^ (i[..., 2] * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xFFFF).astype(np.float32) / 65535.0


def vnoise(P: np.ndarray, scale: float, seed: int = 0) -> np.ndarray:
    """Smooth 3D value noise in [0, 1]."""
    q = P * scale
    i = np.floor(q).astype(np.int64)
    f = q - i
    u = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[:, 0] if dx else 1 - u[:, 0]) * (u[:, 1] if dy else 1 - u[:, 1]) * (u[:, 2] if dz else 1 - u[:, 2])
                out = out + w * _hash3(i + np.array([dx, dy, dz]), seed)
    return out


def fbm(P: np.ndarray, scale: float, seed: int = 0, octaves: int = 3) -> np.ndarray:
    s, a, tot, norm = scale, 1.0, 0.0, 0.0
    for o in range(octaves):
        tot = tot + a * vnoise(P, s, seed + o * 17)
        norm += a
        s *= 2.03
        a *= 0.5
    return tot / norm


# ----------------------------------------------------------------------------- primitives
class Prim:
    """One SDF primitive. op: add | sub | paint. k: blend radius. color: rgb or f(P)->(N,3)."""

    def __init__(self, kind: str, color, op: str = "add", k: float = 0.02, edge: float = 0.01, **p):
        self.kind, self.color, self.op, self.k, self.edge, self.p = kind, C(color) if color is not None else None, op, k, edge, p
        if "rot" in p:
            self.R = rotm(*p["rot"])

    def _local(self, P, c):
        Q = P - np.asarray(c, np.float32)
        return Q @ self.R if hasattr(self, "R") else Q

    def dist(self, P: np.ndarray) -> np.ndarray:
        p, k = self.p, self.kind
        if k == "sphere":
            return np.linalg.norm(P - np.asarray(p["c"], np.float32), axis=1) - p["r"]
        if k == "ell":
            Q = self._local(P, p["c"])
            r = np.asarray(p["r"], np.float32)
            k0 = np.linalg.norm(Q / r, axis=1)
            k1 = np.linalg.norm(Q / (r * r), axis=1)
            return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
        if k == "cap":
            a, b = np.asarray(p["a"], np.float32), np.asarray(p["b"], np.float32)
            pa, ba = P - a, b - a
            h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
            return np.linalg.norm(pa - h[:, None] * ba, axis=1) - p["r"]
        if k == "cone":  # round cone between a (radius ra) and b (radius rb)
            a, b = np.asarray(p["a"], np.float32), np.asarray(p["b"], np.float32)
            r1, r2 = p["ra"], p["rb"]
            ba = b - a
            l2 = float(ba @ ba)
            rr = r1 - r2
            a2 = l2 - rr * rr
            il2 = 1.0 / l2
            pa = P - a
            y = pa @ ba
            z = y - l2
            xv = pa * l2 - y[:, None] * ba
            x2 = np.einsum("ij,ij->i", xv, xv)
            y2 = y * y * l2
            z2 = z * z * l2
            kk = np.sign(rr) * rr * rr * x2
            d = np.where(np.sign(z) * a2 * z2 > kk, np.sqrt(x2 + z2) * il2 - r2,
                         np.where(np.sign(y) * a2 * y2 < kk, np.sqrt(x2 + y2) * il2 - r1,
                                  (np.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1))
            return d
        if k == "cyl":  # capped cylinder between a and b (flat ends), edges rounded by `round`
            a, b = np.asarray(p["a"], np.float32), np.asarray(p["b"], np.float32)
            rnd = p.get("round", 0.0)
            ba = b - a; L = float(np.linalg.norm(ba)); u = ba / L
            pa = P - a
            along = pa @ u
            x = np.linalg.norm(pa - along[:, None] * u, axis=1)
            d = np.stack([x - (p["r"] - rnd), np.abs(along - L / 2) - (L / 2 - rnd)], 1)
            return np.minimum(np.max(d, axis=1), 0) + np.linalg.norm(np.maximum(d, 0), axis=1) - rnd
        if k == "box":
            Q = np.abs(self._local(P, p["c"])) - (np.asarray(p["h"], np.float32) - p.get("round", 0.0))
            return (np.linalg.norm(np.maximum(Q, 0), axis=1) + np.minimum(np.max(Q, axis=1), 0) - p.get("round", 0.0))
        if k == "torus":
            Q = self._local(P, p["c"])
            q = np.stack([np.linalg.norm(Q[:, [0, 2]], axis=1) - p["R"], Q[:, 1]], 1)
            return np.linalg.norm(q, axis=1) - p["r"]
        if k == "tube":  # chain of round cones along a polyline
            pts, rad = p["pts"], p["radii"]
            d = None
            for i in range(len(pts) - 1):
                seg = Prim("cone", None, a=pts[i], b=pts[i + 1], ra=rad[i], rb=rad[i + 1]).dist(P)
                d = seg if d is None else np.minimum(d, seg)
            return d
        raise ValueError(k)

    def bounds(self) -> tuple[np.ndarray, np.ndarray]:
        p, k = self.p, self.kind
        if k == "sphere":
            c, r = np.asarray(p["c"]), p["r"]
            return c - r, c + r
        if k in ("ell", "box"):
            c, r = np.asarray(p["c"]), max(p.get("r", p.get("h")))
            return c - r, c + r
        if k in ("cap", "cyl"):
            a, b = np.asarray(p["a"]), np.asarray(p["b"])
            return np.minimum(a, b) - p["r"], np.maximum(a, b) + p["r"]
        if k == "cone":
            a, b, r = np.asarray(p["a"]), np.asarray(p["b"]), max(p["ra"], p["rb"])
            return np.minimum(a, b) - r, np.maximum(a, b) + r
        if k == "torus":
            c, r = np.asarray(p["c"]), p["R"] + p["r"]
            return c - r, c + r
        if k == "tube":
            pts, r = np.asarray(p["pts"]), max(p["radii"])
            return pts.min(0) - r, pts.max(0) + r
        raise ValueError(k)

    def colors(self, P: np.ndarray) -> np.ndarray:
        if callable(self.color):
            return np.asarray(self.color(P), np.float32)
        return np.broadcast_to(self.color, (len(P), 3))


def sphere(c, r, color, **kw): return Prim("sphere", color, c=c, r=r, **kw)
def ell(c, r, color, rot=None, **kw): return Prim("ell", color, c=c, r=r, **({"rot": rot} if rot else {}), **kw)
def cap(a, b, r, color, **kw): return Prim("cap", color, a=a, b=b, r=r, **kw)
def cone(a, b, ra, rb, color, **kw): return Prim("cone", color, a=a, b=b, ra=ra, rb=rb, **kw)
def cyl(a, b, r, color, rnd=0.0, **kw): return Prim("cyl", color, a=a, b=b, r=r, round=rnd, **kw)
def box(c, h, color, rot=None, rnd=0.0, **kw): return Prim("box", color, c=c, h=h, round=rnd, **({"rot": rot} if rot else {}), **kw)
def torus(c, R, r, color, rot=None, **kw): return Prim("torus", color, c=c, R=R, r=r, **({"rot": rot} if rot else {}), **kw)
def tube(pts, radii, color, **kw): return Prim("tube", color, pts=pts, radii=radii, **kw)


def mirror(prim_fn, *args, **kw):
    """Return [left, right] copies of a primitive built with x mirrored (args with 3-vectors get -x)."""
    def flip(v):
        if isinstance(v, (list, tuple)) and len(v) == 3 and all(isinstance(e, (int, float)) for e in v):
            return (-v[0], v[1], v[2])
        if isinstance(v, (list, tuple)) and v and isinstance(v[0], (list, tuple)):
            return [flip(e) for e in v]
        return v
    left = prim_fn(*args, **kw)
    a2 = [flip(a) for a in args]
    kw2 = {k: flip(v) for k, v in kw.items()}
    if "rot" in kw and kw["rot"]:
        rx, ry, rz = kw["rot"]
        kw2["rot"] = (rx, -ry, -rz)
    return [left, prim_fn(*a2, **kw2)]


# ----------------------------------------------------------------------------- smooth ops
def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


# ----------------------------------------------------------------------------- parts and models
class Part:
    def __init__(self, name: str, pivot=(0, 0, 0), parent: str | None = None, h: float = 0.005,
                 material: str = "fur", decimate: float = 0.55):
        self.name, self.pivot, self.parent, self.h = name, np.asarray(pivot, np.float32), parent, h
        self.material, self.decimate = material, decimate
        self.prims: list[Prim] = []

    def add(self, *prims):
        for p in prims:
            if isinstance(p, (list, tuple)):
                self.add(*p)
            else:
                self.prims.append(p)
        return self

    def sdf(self, P: np.ndarray) -> np.ndarray:
        d = None
        for pr in self.prims:
            if pr.op == "paint":
                continue
            di = pr.dist(P)
            if d is None:
                d = di
            elif pr.op == "add":
                d = smin(d, di, pr.k)
            elif pr.op == "sub":
                d = smax(d, -di, pr.k)
        return d

    def color(self, P: np.ndarray) -> np.ndarray:
        """Blend primitive colours by proximity (soft-min weights), then apply paint regions."""
        geo = [pr for pr in self.prims if pr.op != "paint"]
        ds = np.stack([np.abs(pr.dist(P)) if pr.op == "sub" else pr.dist(P) for pr in geo], 1)
        tau = 0.004
        w = np.exp(-(ds - ds.min(1, keepdims=True)) / tau)
        w /= w.sum(1, keepdims=True)
        col = np.zeros((len(P), 3), np.float32)
        for j, pr in enumerate(geo):
            col += w[:, j:j + 1] * pr.colors(P)
        for pr in self.prims:
            if pr.op == "paint":
                d = pr.dist(P)
                a = np.clip(0.5 - d / (2 * pr.edge), 0, 1)[:, None]
                a = a * a * (3 - 2 * a)
                col = col * (1 - a) + pr.colors(P) * a
        return np.clip(col, 0, 1)

    def bounds(self):
        lo = np.full(3, 1e9)
        hi = np.full(3, -1e9)
        for pr in self.prims:
            if pr.op == "add":
                a, b = pr.bounds()
                lo, hi = np.minimum(lo, a - pr.k), np.maximum(hi, b + pr.k)
        pad = 3 * self.h
        return lo - pad, hi + pad

    def mesh(self, verbose: bool = True) -> trimesh.Trimesh:
        lo, hi = self.bounds()
        h = self.h
        n = np.ceil((hi - lo) / h).astype(int) + 1
        xs, ys, zs = (lo[i] + np.arange(n[i]) * h for i in range(3))
        vol = np.empty(tuple(n), np.float32)
        for ix in range(0, n[0], 16):
            X, Y, Z = np.meshgrid(xs[ix:ix + 16], ys, zs, indexing="ij")
            P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).astype(np.float32)
            vol[ix:ix + 16] = self.sdf(P).reshape(X.shape)
        verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(h, h, h))
        verts = verts + lo
        m = trimesh.Trimesh(verts, faces, process=True)
        trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=4)
        if fast_simplification is not None and self.decimate > 0 and len(m.faces) > 4000:
            v2, f2 = fast_simplification.simplify(np.asarray(m.vertices, np.float32), np.asarray(m.faces), self.decimate)
            m = trimesh.Trimesh(v2, f2, process=True)
        V = np.asarray(m.vertices, np.float32)
        e = h * 0.5
        N = np.stack([self.sdf(V + np.array(d, np.float32)) - self.sdf(V - np.array(d, np.float32))
                      for d in ((e, 0, 0), (0, e, 0), (0, 0, e))], 1)
        N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
        col = self.color(V)
        lin = np.where(col <= 0.04045, col / 12.92, ((col + 0.055) / 1.055) ** 2.4)  # glTF vertex colours are linear
        rgba = np.concatenate([np.round(lin * 255), np.full((len(V), 1), 255)], 1).astype(np.uint8)
        out = trimesh.Trimesh(V - self.pivot, m.faces, vertex_normals=N, vertex_colors=rgba, process=False)
        if verbose:
            print(f"    {self.name:<10} grid {n[0]}x{n[1]}x{n[2]}  {len(out.faces):>6} tris")
        return out


class Model:
    def __init__(self, name: str):
        self.name = name
        self.parts: dict[str, Part] = {}
        self.extra: dict = {"eyes": [], "materials": {}, "notes": {}}

    def part(self, name, pivot=(0, 0, 0), parent=None, **kw) -> Part:
        p = Part(name, pivot, parent, **kw)
        self.parts[name] = p
        return p

    def eye(self, part: str, c, r, iris: str, pupil: str = "round", lid: str = "#888888", look=(0, 0, 1),
            iris_size: float = 0.62, pupil_size: float = 0.45, name: str = ""):
        """Eyes are built in three.js (glossy sphere + painted iris + eyelids); stored in the part's local space."""
        pv = self.parts[part].pivot
        self.extra["eyes"].append({"part": part, "pos": [float(v) for v in np.asarray(c) - pv], "r": r, "iris": iris,
                                   "pupil": pupil, "lid": lid, "look": list(look), "iris_size": iris_size,
                                   "pupil_size": pupil_size, "name": name})

    def strand(self, part: str, a, b, r: float, color: str):
        """Thin straight strands (whiskers) built as cylinders in three.js, stored in the part's local space."""
        pv = self.parts[part].pivot
        self.extra.setdefault("strands", []).append({"part": part, "a": [float(v) for v in np.asarray(a) - pv],
                                                     "b": [float(v) for v in np.asarray(b) - pv], "r": r, "color": color})

    def export(self, out_dir: Path) -> None:
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"  {self.name}")
        scene = trimesh.Scene()
        for name, part in self.parts.items():
            mesh = part.mesh()
            parent_pivot = self.parts[part.parent].pivot if part.parent else np.zeros(3)
            T = np.eye(4)
            T[:3, 3] = part.pivot - parent_pivot
            scene.add_geometry(mesh, node_name=name, geom_name=name, parent_node_name=part.parent or "world", transform=T)
            self.extra["materials"][name] = part.material
        glb = scene.export(file_type="glb", include_normals=True)
        (out_dir / f"{self.name}.glb").write_bytes(glb)
        rig = {"name": self.name, "parts": {n: {"parent": p.parent, "pivot": [float(v) for v in p.pivot]}
                                            for n, p in self.parts.items()}, **self.extra}
        (out_dir / f"{self.name}.json").write_text(json.dumps(rig, indent=1))
        print(f"    -> {out_dir / self.name}.glb  ({len(glb) / 1e6:.1f} MB)")
