"""Episode loader, timeline, per-frame scene builder and the render pipeline.

Stage space is always the 1440x1080 set; the output viewport can be 4:3 (1440x1080) or native
vertical 9:16 (1080x1920). The camera maps stage -> viewport.
"""
from __future__ import annotations

import io
import math
import multiprocessing as mp
import os
import re
import subprocess
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Optional

import numpy as np
import resvg_py
import yaml

from . import audio as A
from . import color as C
from . import fx as FX
from . import sets as SETS
from .character import CharState, HairState, Look, Pose, draw_character, expression
from .svgkit import (Defs, blur_filter, clamp, ease_in_out, ease_out, ease_out_back, f, group, hash01, lerp, noise1,
                     smoothstep)

ROOT = Path(__file__).resolve().parent.parent
FONT_DIRS = [str(ROOT / "assets/fonts")]
SW, SH = 1440, 1080   # stage (set) size

FRAMES = {  # landscape presets: (visible height in character units, vertical center offset)
    "ecu": (300, 10), "cu": (450, 0), "mcu": (600, 70), "ms": (780, 160), "full": (1000, 260),
}
VFRAMES = {  # vertical presets: (visible width in character units, vertical center offset)
    "ecu": (300, 30), "cu": (380, 120), "mcu": (470, 190), "ms": (600, 270), "full": (820, 300),
}
INSERTS = ("phone", "chart", "title", "end", "endcard", "photos", "product")


# =========================================================================== data
@dataclass
class Beat:
    at: Any
    who: Optional[str] = None
    expr: Optional[str] = None
    face: dict = field(default_factory=dict)
    hair: Optional[str] = None
    wipe: float = 0.8
    arms: Optional[str] = None
    arm_r: Optional[list] = None
    arm_l: Optional[list] = None
    prop: Optional[str] = None
    style: Optional[str] = None
    wind: Optional[float] = None
    fluff: Optional[float] = None
    acc: Optional[list] = None
    tdur: float = 0.35
    bounce: bool = False
    fx: Optional[str] = None
    fxdur: float = 1.2
    sfx: Optional[str] = None
    gain: float = 1.0
    t: float = 0.0          # resolved local time


@dataclass
class Actor:
    who: str
    x: float = 720
    y: float = 330
    s: float = 1.0
    flip: bool = False
    expr: str = "neutral"
    face: dict = field(default_factory=dict)
    hair: Optional[str] = None
    arms: str = "down"
    arm_r: Optional[list] = None
    arm_l: Optional[list] = None
    prop: Optional[str] = None
    style: Optional[str] = None
    wind: float = 0.0
    fluff: float = 0.0
    acc: list = field(default_factory=list)
    enter: Optional[str] = None
    move: Optional[list] = None
    walk: bool = False
    full: bool = True
    phone_glow: float = 0.0


@dataclass
class Shot:
    id: str
    set: str
    actors: list[Actor]
    camera: dict
    lines: list[A.Line]
    line_specs: list[dict]
    beats: list[Beat]
    sfx: list[dict]
    params: dict
    dur: float = 0.0
    start: float = 0.0
    bg: Optional[tuple] = None   # (file, x, y, w, h) per-shot background crop


class Episode:
    def __init__(self, path: Path):
        self.path = Path(path)
        data = yaml.safe_load(self.path.read_text())
        self.data = data
        self.name = self.path.stem
        self.title = data.get("title", self.name)
        self.fps = int(data.get("fps", 24))
        self.W, self.H = (int(v) for v in data.get("size", [SW, SH]))
        self.vertical = self.H > self.W
        self.music = data.get("music")
        self.captions = data.get("captions", {})
        self.grade = data.get("grade", {})
        self.cast: dict[str, dict] = data["cast"]
        self.looks: dict[str, Look] = {}
        for who, spec in self.cast.items():
            if "look" in spec:
                self.looks[who] = Look(name=who, **spec["look"])
        self.shots: list[Shot] = []
        for i, s in enumerate(data["shots"]):
            actors = [Actor(**a) for a in s.get("actors", [])]
            lines = []
            for ls in s.get("lines", []):
                c = self.cast[ls["who"]]
                lines.append(A.Line(who=ls["who"], text=ls.get("say", ls["text"]), voice=ls.get("voice", c["voice"]),
                                    speed=float(ls.get("speed", c.get("speed", 1.0))),
                                    pitch=float(ls.get("pitch", c.get("pitch", 0.0))), caption=ls["text"]))
            beats = [Beat(**b) for b in s.get("beats", [])]
            params = {k: v for k, v in s.items() if k not in ("id", "set", "actors", "camera", "lines", "beats", "sfx")}
            # YAML 1.1 reads the key `on:` as boolean True - map it back
            cam = {("on" if k is True else k): v for k, v in (s.get("camera") or {}).items()}
            self.shots.append(Shot(id=s.get("id", f"s{i}"), set=s["set"], actors=actors, camera=cam,
                                   lines=lines, line_specs=s.get("lines", []), beats=beats, sfx=s.get("sfx", []),
                                   params=params))

    # ------------------------------------------------------------------ timeline
    def build(self, cache: Path) -> None:
        t0 = time.time()
        for sh in self.shots:
            for ln in sh.lines:
                A.synth_line(ln, cache)
        print(f"  voices ready ({sum(len(s.lines) for s in self.shots)} lines, {time.time() - t0:.1f}s)")
        g = 0.0
        hair_now: dict[str, str] = {w: C.hair_color(l.hair) for w, l in self.looks.items()}
        for sh in self.shots:
            sh.start = g
            cur = float(sh.params.get("lead", 0.12))
            ends = []
            for ln, spec in zip(sh.lines, sh.line_specs):
                st = float(spec["at"]) if "at" in spec else cur + float(spec.get("gap", 0.0))
                ln.start = g + st
                cur = st + ln.dur + 0.1
                ends.append(st + ln.dur)
                ln.env, ln.vis = A.mouth_envelope(ln.audio, self.fps)
            need = (max(ends) + float(sh.params.get("tail", 0.3))) if ends else 0.0
            sh.dur = max(float(sh.params.get("dur", 0.0)), need, 0.4)
            for b in sh.beats:
                b.t = self._resolve(b.at, sh)
            sh.beats.sort(key=lambda b: b.t)
            for a in sh.actors:
                if a.hair is None:
                    a.hair = hair_now.get(a.who, "#ff8fcf")
                a.hair = C.hair_color(a.hair)
                hair_now[a.who] = a.hair
            for b in sh.beats:
                if b.hair and b.who:
                    hair_now[b.who] = C.hair_color(b.hair)
            g += sh.dur
        self.total = g
        self.nframes = int(math.ceil(self.total * self.fps))
        self.all_lines = [ln for sh in self.shots for ln in sh.lines]

    def _resolve(self, at: Any, sh: Shot) -> float:
        if isinstance(at, (int, float)):
            return float(at)
        m = re.fullmatch(r"\s*(line(\d+)(\.end)?|end)\s*([+-]\s*[\d.]+)?\s*", str(at))
        if not m:
            raise ValueError(f"bad beat time {at!r} in shot {sh.id}")
        if m.group(1) == "end":
            base = sh.dur
        else:
            ln = sh.lines[int(m.group(2)) - 1]
            base = ln.start - sh.start + (ln.dur if m.group(3) else 0.0)
        off = float(m.group(4).replace(" ", "")) if m.group(4) else 0.0
        return base + off

    def cues(self) -> list[tuple[float, str, float]]:
        out = []
        for sh in self.shots:
            for s in sh.sfx:
                out.append((sh.start + float(s.get("at", 0.0)), s["name"], float(s.get("gain", 1.0))))
            for b in sh.beats:
                if b.sfx:
                    out.append((sh.start + b.t, b.sfx, b.gain))
        return out


# =========================================================================== per-frame scene
class Scene:
    def __init__(self, ep: Episode, bgdir: Path):
        self.ep = ep
        self.bgdir = bgdir
        self.W, self.H = ep.W, ep.H
        FX.set_canvas(self.W, self.H)

    def shot_at(self, t: float) -> Shot:
        for sh in self.ep.shots:
            if t < sh.start + sh.dur:
                return sh
        return self.ep.shots[-1]

    # ---------------------------------------------------------------- camera
    def camera(self, sh: Shot, lt: float) -> tuple[float, float, float, float]:
        W, H = self.W, self.H
        cam = sh.camera
        frame = cam.get("frame", "ws")
        on = cam.get("on")
        actors = {a.who: a for a in sh.actors}
        vert = self.ep.vertical
        zmin = max(W / SW, H / SH)
        if "z" in cam:
            cx, cy, z = cam.get("x", SW / 2), cam.get("y", SH / 2), float(cam["z"]) * zmin
        elif frame in ("two", "group") and on:
            group_ = [actors[w] for w in (on if isinstance(on, list) else [on]) if w in actors]
            s = sum(a.s for a in group_) / len(group_)
            xs = [self._actor_xy(a, sh, lt)[0] for a in group_]
            cx = (min(xs) + max(xs)) / 2
            height = cam.get("height", "ms")
            if vert:
                units, off = VFRAMES[height]
                z = W / (max(xs) - min(xs) + units * s)
            else:
                units, off = FRAMES[height]
                z = min(H / (units * s), W / (max(xs) - min(xs) + 560 * s))
            cy = sum(a.y for a in group_) / len(group_) + off * s
        elif frame in FRAMES and on in actors:
            a = actors[on]
            ax, ay = self._actor_xy(a, sh, lt) if cam.get("follow", True) else (a.x, a.y)
            if vert:
                units, off = VFRAMES[frame]
                z = W / (units * a.s)
            else:
                units, off = FRAMES[frame]
                z = H / (units * a.s)
            cx, cy = ax + float(cam.get("dx", 0)) * a.s, ay + (off + float(cam.get("dy", 0))) * a.s
        else:
            cx, cy, z = float(cam.get("x", SW / 2)), float(cam.get("y", SH / 2)), zmin
        dur = max(sh.dur, 0.01)
        u = ease_in_out(lt / dur)
        z *= 1 + float(cam.get("push", 0.04)) * u
        pan = cam.get("pan")
        if pan:
            cx += pan[0] * u
            cy += pan[1] * u
        rot = float(cam.get("rot", 0.0))
        shake = 0.0
        for b in sh.beats:
            if b.fx == "punch" and lt >= b.t:
                k = lt - b.t
                z *= 1 + 0.16 * (ease_out(clamp(k / 0.12)) if k < 0.12 else 1.0)
            if b.fx == "shake" and b.t <= lt < b.t + b.fxdur:
                shake = max(shake, 1 - (lt - b.t) / b.fxdur)
        if shake:
            cx += math.sin(lt * 63) * 20 * shake / z
            cy += math.cos(lt * 71) * 16 * shake / z
        z = max(zmin, z)
        hw, hh = W / 2 / z, H / 2 / z
        cx = clamp(cx, hw, SW - hw)
        cy = clamp(cy, hh, SH - hh)
        return cx, cy, z, rot

    def _actor_xy(self, a: Actor, sh: Shot, lt: float) -> tuple[float, float]:
        x, y = a.x, a.y
        if a.move:
            u = ease_in_out(lt / max(sh.dur, 0.01))
            x += a.move[0] * u
            y += a.move[1] * u
        if a.enter:
            k = clamp(lt / 0.7)
            x += (1 - ease_out(k)) * (900 if a.enter == "right" else -900)
        return x, y

    # ---------------------------------------------------------------- actors
    def actor_state(self, sh: Shot, a: Actor, lt: float, gt: float) -> tuple[CharState, float, float]:
        face = expression(a.expr, **a.face)
        hair = HairState(color=a.hair, style=a.style, wind=a.wind, fluff=a.fluff, acc=tuple(a.acc))
        pose = Pose(arms=a.arms, phone_glow=a.phone_glow, prop=a.prop,
                    arm_r=tuple(a.arm_r) if a.arm_r else None, arm_l=tuple(a.arm_l) if a.arm_l else None)
        x, y = self._actor_xy(a, sh, lt)
        events = [b for b in sh.beats if b.who == a.who]
        for ln, spec in zip(sh.lines, sh.line_specs):
            if spec.get("expr") and ln.who == a.who:
                events.append(Beat(at=0, who=a.who, expr=spec["expr"], face=spec.get("face", {}), t=ln.start - sh.start))
        events.sort(key=lambda b: b.t)
        for b in events:
            if lt < b.t:
                break
            k = lt - b.t
            if b.expr or b.face:
                target = expression(b.expr, **b.face) if b.expr else replace(face, **b.face)
                face = face.blend(target, smoothstep(k / 0.16))
            if b.hair:
                new = C.hair_color(b.hair)
                w = clamp(k / b.wipe)
                if w >= 1:
                    hair = replace(hair, color=new, to_color=None, wipe=0.0)
                else:
                    hair = replace(hair, color=hair.to_color or hair.color, to_color=new, wipe=ease_in_out(w))
            if b.style:
                hair = replace(hair, style=b.style)
            if b.acc is not None:
                hair = replace(hair, acc=tuple(b.acc))
            for fld in ("wind", "fluff"):
                val = getattr(b, fld)
                if val is not None:
                    prev = getattr(hair, fld)
                    p = clamp(k / max(0.01, b.tdur))
                    v = prev + (val - prev) * (ease_out_back(p, 2.6) if b.bounce else ease_in_out(p))
                    hair = replace(hair, **{fld: v})
            if b.prop is not None:
                pose = replace(pose, prop=b.prop or None)
            if b.arms or b.arm_r or b.arm_l:
                if b.arm_r:
                    pose = replace(pose, arm_r=tuple(b.arm_r))
                if b.arm_l:
                    pose = replace(pose, arm_l=tuple(b.arm_l))
                name = b.arms or "custom"
                kk = smoothstep(k / 0.3)
                if kk >= 1:
                    pose = replace(pose, arms=name, arms_to=None, arms_t=0.0)
                else:
                    pose = replace(pose, arms_to=name, arms_t=kk)
        if a.enter and lt < 0.7:
            y -= abs(math.sin(lt * 11)) * 14 * a.s
        if a.walk:
            y -= abs(math.sin(gt * 7.5)) * 9 * a.s
            face = replace(face, tilt=face.tilt + math.sin(gt * 7.5) * 2.0)
        seed = hash01(a.who) * 100
        face = replace(face, look_x=face.look_x + noise1(gt * 0.55, seed) * 0.12,
                       tilt=face.tilt + noise1(gt * 0.4, seed + 3) * 1.6)
        talk, vis = 0.0, 0.0
        fps = self.ep.fps
        for ln in self.ep.all_lines:
            if ln.who == a.who and ln.start <= gt < ln.start + ln.dur + 0.05:
                i = int((gt - ln.start) * fps)
                if 0 <= i < len(ln.env):
                    nxt = ln.env[min(i + 1, len(ln.env) - 1)]
                    fr = (gt - ln.start) * fps - i
                    talk = float(lerp(ln.env[i], nxt, fr))
                    vis = float(ln.vis[i])
        blink = 0.0
        period = 2.6 + hash01(a.who, "bp") * 1.6
        ph = (gt + hash01(a.who, "bo") * period) % period
        if ph < 0.16:
            blink = math.sin(math.pi * ph / 0.16)
        return CharState(face=face, hair=hair, pose=pose, talk=talk, viseme=vis, blink=blink), x, y

    # ---------------------------------------------------------------- frame
    def frame_bg(self, t: float) -> Optional[tuple]:
        """Background composited outside resvg (fast bilinear in PIL) for normal set shots."""
        sh = self.shot_at(t)
        lt = t - sh.start
        zmin = max(self.W / SW, self.H / SH)
        if sh.set in ("phone", "photos", "product"):
            dflt = {"phone": "bedroom", "photos": "bedroom_night", "product": "vanity"}[sh.set]
            cover = 1 + float(sh.camera.get("push", 0.04)) * ease_in_out(lt / sh.dur)
            return ((f"{sh.params.get('bg', dflt)}_blur.jpg", 0, 0, SW, SH), SW / 2, SH / 2, zmin * cover)
        if sh.params.get("mask") == "heart":
            return (("vanity_blur.jpg", 0, 0, SW, SH), SW / 2, SH / 2, zmin * 1.05)
        if sh.set in INSERTS or not sh.bg:
            return None
        cx, cy, z, rot = self.camera(sh, lt)
        if rot:
            return None
        return (sh.bg, cx, cy, z)

    def frame_svg(self, t: float, external_bg: bool = False) -> str:
        ep = self.ep
        W, H = self.W, self.H
        sh = self.shot_at(t)
        lt = t - sh.start
        defs = Defs()
        for name, s in (("glow8", 8), ("glow12", 12), ("glow24", 24), ("softglow", 6)):
            defs.add(blur_filter(name, s))
        for gid, col in (("gdot", "#ffffff"), ("gdoty", "#fff3b0"), ("gdotp", "#ffc4ea")):
            defs.add(f'<radialGradient id="{gid}"><stop offset="0" stop-color="{col}" stop-opacity="0.85"/>'
                     f'<stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>')
        layers: list[str] = []
        screen: list[str] = []
        kind = sh.set
        p = sh.params
        zmin = max(W / SW, H / SH)
        cover = 1 + float(sh.camera.get("push", 0.04)) * ease_in_out(lt / sh.dur)
        if kind == "phone":
            who = p.get("hand", "mimi")
            look = ep.looks.get(who)
            if not external_bg:
                layers.append(self._bg_full(p.get("bg", "bedroom"), blur=True))
            layers.append(FX.phone_insert(defs, lt, look.skin if look else "#f2c3a3", p.get("contact", "bestie"),
                                          p.get("messages", []), nails=look.lips if look else "#ff4fae",
                                          glow=float(p.get("glow", 1.0)), typing=bool(p.get("typing", False))))
            cx, cy, z, rot = SW / 2, SH / 2, zmin * cover, 0
        elif kind == "photos":
            look = ep.looks.get(p.get("hand", ""))
            if not external_bg:
                layers.append(self._bg_full(p.get("bg", "bedroom_night"), blur=True))
            layers.append(FX.photos_insert(defs, lt, look.skin if look else "#e7bf92", p.get("photos", []),
                                           nails=look.lips if look else "#ff4fae", tears=bool(p.get("tears", False))))
            cx, cy, z, rot = SW / 2, SH / 2, zmin * cover, 0
        elif kind == "product":
            if not external_bg:
                layers.append(self._bg_full(p.get("bg", "vanity"), blur=True))
            layers.append(FX.product_insert(defs, lt, p.get("product", "mousse")))
            cx, cy, z, rot = SW / 2, SH / 2, zmin * cover, 0
        elif kind == "chart":
            layers.append(FX.mood_chart(defs, lt, [tuple(r) for r in p.get("rows", [])], p.get("heading", "MOOD HAIR GUIDE"),
                                        float(p.get("step", 0.22))))
            cx, cy, z, rot = SW / 2, SH / 2, zmin * (1 + 0.03 * lt / sh.dur), 0
        elif kind in ("title", "end"):
            layers.append(FX.title_card(defs, lt, p.get("text", []), p.get("sub", "")))
            if kind == "end":
                layers.append(FX.confetti(lt))
            cx, cy, z, rot = SW / 2, SH / 2, zmin * (1 + 0.04 * lt / sh.dur), 0
        elif kind == "endcard":
            cx, cy, z, rot = SW / 2, SH / 2, zmin, 0
            screen.append(FX.end_card_v(defs, lt, p.get("text", []), p.get("sub", ""), W, H))
        else:
            cx, cy, z, rot = self.camera(sh, lt)
            frame = sh.camera.get("frame", "ws")
            dof = bool(sh.camera.get("dof", frame in ("ecu", "cu", "mcu")))
            if not external_bg or p.get("mask"):
                layers.append(self._bg_shot(sh, kind, dof).replace("<image ", '<image image-rendering="optimizeSpeed" ', 1))
            for a in sh.actors:
                look = ep.looks[a.who]
                st, x, y = self.actor_state(sh, a, lt, t)
                lw = (a.s * z) ** -0.55
                body = draw_character(look, st, t, defs, lw=lw, full_body=a.full)
                sx = -a.s if a.flip else a.s
                layers.append(group(body, transform=f"translate({f(x)} {f(y)}) scale({f(sx)} {f(a.s)})"))
                if st.hair.to_color:
                    hy = y + lerp(-200, 340, st.hair.wipe) * a.s
                    layers.append(FX.sparkles(x, hy, 260 * a.s, 70 * a.s, t * 1.5, n=14, seed=f"hw{a.who}",
                                              size=30 * a.s, strength=1.0))
                layers.append(self._actor_fx(sh, a, lt, t, x, y))
            if p.get("fg"):
                layers.append(SETS.FOREGROUND[p["fg"]](defs))
        # shot-level fx
        for b in sh.beats:
            if b.fx == "flash":
                screen.append(FX.flash(lt, b.t, 0.4))
            elif b.fx == "speed" and b.t <= lt < b.t + b.fxdur:
                screen.append(FX.speed_lines(t, 1 - (lt - b.t) / b.fxdur * 0.5))
            elif b.fx == "wind" and b.t <= lt < b.t + b.fxdur:
                k = lt - b.t
                screen.append(FX.wind_streaks(t, min(1.0, k / 0.25, (b.fxdur - k) / 0.4)))
            elif b.fx == "glitter" and lt >= b.t:
                screen.append(FX.glitter(t, min(1.0, (lt - b.t) / max(0.01, b.fxdur))))
            elif b.fx and b.fx.startswith("tint:") and lt >= b.t:
                col, op = (b.fx[5:].split("@") + ["0.25"])[:2]
                screen.append(FX.tint(col, float(op) * smoothstep((lt - b.t) / 0.3)))
        if p.get("glitter"):
            screen.append(FX.glitter(t, float(p["glitter"])))
        if p.get("leak"):
            screen.append(FX.light_leak(defs, t, str(p["leak"])))
        if p.get("tint"):
            col, op = (str(p["tint"]).split("@") + ["0.2"])[:2]
            screen.append(FX.tint(col, float(op)))
        if p.get("caption"):
            screen.append(FX.caption_box(p["caption"], W / 2, 140, 72))
        if p.get("label"):
            screen.append(FX.label_sticker(str(p["label"]), lt, W, H, p.get("label_color", "#ff4fae")))
        if p.get("hook"):
            hk = p["hook"]
            screen.append(FX.hook_title(hk.get("lines", []), lt, W, H, float(hk.get("dur", 4.0))))
        cam_tf = f"translate({f(W / 2)} {f(H / 2)}) rotate({f(rot)}) scale({f(z)}) translate({f(-cx)} {f(-cy)})"
        scene_g = group(layers, transform=cam_tf)
        if p.get("mask") == "heart":
            scene_g = self._heart_mask(defs, scene_g, lt, t, external_bg)
        base = "" if external_bg else f'<rect width="{W}" height="{H}" fill="#ffd9ec"/>'
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" '
                f'height="{H}" viewBox="0 0 {W} {H}">{defs.markup()}{base}'
                f"{scene_g}{''.join(screen)}</svg>")

    def _heart_mask(self, defs: Defs, scene_g: str, lt: float, t: float, external_bg: bool = False) -> str:
        W, H = self.W, self.H
        cx, cy, r = W / 2, H * 0.46, W * 0.47
        hp = FX.heart_path(cx, cy, r)
        cid = defs.uid("hm")
        defs.add(f'<clipPath id="{cid}"><path d="{hp}"/></clipPath>')
        zc = max(W / SW, H / SH) * 1.05
        outside = "" if external_bg else group(self._bg_full("vanity", blur=True),
                        transform=f"translate({f(W / 2)} {f(H / 2)}) scale({f(zc)}) translate({-SW / 2} {-SH / 2})")
        return outside + group(scene_g, clip_path=f"url(#{cid})") + FX.heart_frame(cx, cy, r, t)

    def _actor_fx(self, sh: Shot, a: Actor, lt: float, t: float, x: float, y: float) -> str:
        out = []
        for b in sh.beats:
            if b.who != a.who or not b.fx or lt < b.t:
                continue
            k = lt - b.t
            if b.fx == "burst":
                out.append(FX.burst(x, y - 40 * a.s, lt, b.t, 0.8, radius=330 * a.s, seed=f"bu{a.who}{b.t}"))
            elif b.fx == "hearts" and k < b.fxdur:
                out.append(FX.hearts(x, y - 60 * a.s, k, n=7, seed=f"he{a.who}", spread=360 * a.s, size=30 * a.s))
            elif b.fx == "steam" and k < b.fxdur:
                for side in (-1, 1):
                    out.append(FX.steam(x + side * 120 * a.s, y - 170 * a.s, k, a.s))
            elif b.fx == "anger" and k < b.fxdur:
                out.append(FX.anger_mark(x + 100 * a.s, y - 120 * a.s, a.s * 1.4, k))
            elif b.fx == "sparkles" and k < b.fxdur:
                out.append(FX.sparkles(x, y, 330 * a.s, 300 * a.s, k, n=16, seed=f"sp{a.who}", size=34 * a.s))
            elif b.fx == "poof" and k < 0.7:
                out.append(FX.poof(x, y - 90 * a.s, k, a.s))
            elif b.fx == "shine" and k < b.fxdur:
                out.append(FX.shine(x, y - 118 * a.s, k, a.s))
            elif b.fx == "tears_wipe" and k < b.fxdur:
                out.append(FX.sparkles(x, y + 10 * a.s, 120 * a.s, 40 * a.s, k, n=6, seed=f"tw{a.who}", size=18 * a.s))
        return "".join(out)

    def _bg_full(self, set_name: str, blur: bool) -> str:
        p = self.bgdir / f"{set_name}_{'blur' if blur else 'sharp'}.jpg"
        return f'<image href="{p.name}" x="0" y="0" width="{SW}" height="{SH}" preserveAspectRatio="none"/>'

    def _bg_shot(self, sh: Shot, set_name: str, blur: bool) -> str:
        if sh.bg:
            name, x, y, w, h = sh.bg
            return f'<image href="{name}" x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" preserveAspectRatio="none"/>'
        return self._bg_full(set_name, blur)


# =========================================================================== backgrounds
def prerender_backgrounds(ep: Episode, bgdir: Path) -> None:
    from PIL import Image, ImageFilter
    bgdir.mkdir(parents=True, exist_ok=True)
    needed = {sh.set for sh in ep.shots if sh.set in SETS.SETS}
    needed |= {sh.params.get("bg", d) for sh in ep.shots for k, d in (("phone", "bedroom"), ("photos", "bedroom_night"),
                                                                       ("product", "vanity")) if sh.set == k}
    if any(sh.params.get("mask") == "heart" for sh in ep.shots):
        needed.add("vanity")
    for name in sorted(needed):
        sharp = bgdir / f"{name}_sharp.jpg"
        blur = bgdir / f"{name}_blur.jpg"
        if sharp.exists() and blur.exists():
            continue
        defs = Defs()
        for i, s in (("glow8", 8), ("glow12", 12), ("glow24", 24), ("softglow", 6)):
            defs.add(blur_filter(i, s))
        body = SETS.SETS[name](defs)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{SW}" height="{SH}" viewBox="0 0 {SW} {SH}">'
               f"{defs.markup()}{body}</svg>")
        png = bytes(resvg_py.svg_to_bytes(svg_string=svg, width=SW * 2, height=SH * 2, font_dirs=FONT_DIRS))
        im = Image.open(io.BytesIO(png)).convert("RGB")
        im.save(sharp, quality=93)
        im.filter(ImageFilter.GaussianBlur(9)).save(blur, quality=90)
        print(f"  background {name} cached")


def crop_shot_backgrounds(ep: Episode, sc: "Scene", bgdir: Path) -> None:
    """Cut each shot's visible region out of the 2x background so frames decode a small image."""
    from PIL import Image
    cache: dict[str, Image.Image] = {}
    for i, sh in enumerate(ep.shots):
        if sh.set in INSERTS or sh.set not in SETS.SETS:
            continue
        frame = sh.camera.get("frame", "ws")
        blur = bool(sh.camera.get("dof", frame in ("ecu", "cu", "mcu")))
        x0, y0, x1, y1, zmax = 1e9, 1e9, -1e9, -1e9, 0.0
        for k in range(13):
            cx, cy, z, _ = sc.camera(sh, sh.dur * k / 12)
            hw, hh = sc.W / 2 / z, sc.H / 2 / z
            x0, y0 = min(x0, cx - hw), min(y0, cy - hh)
            x1, y1 = max(x1, cx + hw), max(y1, cy + hh)
            zmax = max(zmax, z * 1.2)
        m = 30
        x0, y0 = max(0, x0 - m), max(0, y0 - m)
        x1, y1 = min(SW, x1 + m), min(SH, y1 + m)
        key = f"{sh.set}_{'blur' if blur else 'sharp'}"
        if key not in cache:
            cache[key] = Image.open(bgdir / f"{key}.jpg")
        src = cache[key]
        crop = src.crop((int(x0 * 2), int(y0 * 2), int(math.ceil(x1 * 2)), int(math.ceil(y1 * 2))))
        tw = min(crop.width, int((x1 - x0) * zmax) + 2)
        th = min(crop.height, int((y1 - y0) * zmax) + 2)
        if tw < crop.width:
            crop = crop.resize((tw, th), Image.LANCZOS)
        name = f"shot{i:03d}.jpg"
        crop.save(bgdir / name, quality=92)
        sh.bg = (name, x0, y0, x1 - x0, y1 - y0)


def make_grain(path: Path, w: int, h: int) -> None:
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(11)
    g = rng.normal(128, 26, (h, w)).clip(0, 255).astype(np.uint8)
    Image.fromarray(g, "L").filter(ImageFilter.GaussianBlur(0.6)).convert("RGB").save(path)


# =========================================================================== rendering
_SCENE: Optional[Scene] = None
_BGCACHE: dict = {}


def _bg_image(name: str):
    from PIL import Image
    if name not in _BGCACHE:
        if len(_BGCACHE) > 3:
            _BGCACHE.pop(next(iter(_BGCACHE)))
        _BGCACHE[name] = Image.open(_SCENE.bgdir / name).convert("RGB")
    return _BGCACHE[name]


def frame_image(i: int):
    """Render frame i to a PIL RGB image (characters/fx via resvg, background via PIL)."""
    from PIL import Image
    sc = _SCENE
    t = i / sc.ep.fps
    bg = sc.frame_bg(t)
    svg = sc.frame_svg(t, external_bg=bg is not None)
    png = bytes(resvg_py.svg_to_bytes(svg_string=svg, font_dirs=FONT_DIRS, resources_dir=str(sc.bgdir)))
    fg = Image.open(io.BytesIO(png))
    if bg is None:
        return fg.convert("RGB")
    (name, x0, y0, w, h), cx, cy, z = bg
    src = _bg_image(name)
    pw, ph = src.size
    W, H = sc.W, sc.H
    data = (pw / (w * z), 0, (-W / 2 / z + cx - x0) * pw / w, 0, ph / (h * z), (-H / 2 / z + cy - y0) * ph / h)
    out = src.transform((W, H), Image.AFFINE, data=data, resample=Image.BILINEAR)
    out.paste(fg, (0, 0), fg)
    return out


def _render_frame(i: int) -> bytes:
    return frame_image(i).tobytes()


def render_episode(path: str, out_dir: str = "renders", workers: int = 0, preview: bool = False,
                   frames: Optional[tuple[int, int]] = None) -> dict:
    global _SCENE
    ep = Episode(Path(path))
    build = ROOT / "build" / ep.name
    build.mkdir(parents=True, exist_ok=True)
    print(f"[1/5] voices + timeline for '{ep.title}'")
    ep.build(ROOT / "build" / "tts")
    print(f"      {len(ep.shots)} shots, {ep.total:.1f}s, {ep.nframes} frames, {ep.W}x{ep.H}")
    print("[2/5] backgrounds")
    bgdir = build / "bg"
    prerender_backgrounds(ep, bgdir)
    _SCENE = Scene(ep, bgdir)
    crop_shot_backgrounds(ep, _SCENE, bgdir)
    grain = build / f"grain_{ep.W}x{ep.H}.png"
    if not grain.exists():
        make_grain(grain, ep.W, ep.H)
    print("[3/5] audio mix")
    wav = build / "mix.wav"
    A.mixdown(ep.total, ep.all_lines, ep.cues(), ep.music, wav)
    out = ROOT / out_dir
    out.mkdir(parents=True, exist_ok=True)
    rng = range(*frames) if frames else range(ep.nframes)
    if preview:
        return {"episode": ep, "scene": _SCENE}
    print(f"[4/5] drawing {len(rng)} frames")
    video = build / "video.mp4"
    bloom = float(ep.grade.get("bloom", 0.0))
    grain_op = float(ep.grade.get("grain", 0.09))
    chain = f"[0:v]vignette=angle={float(ep.grade.get('vignette', 0.5)):.2f},format=gbrp[v0];"
    if bloom > 0:
        chain += f"[v0]split[va][vb];[vb]gblur=sigma={ep.H / 60:.1f}[vg];[va][vg]blend=all_mode=screen:all_opacity={bloom}:shortest=1[v0b];"
        src = "[v0b]"
    else:
        src = "[v0]"
    chain += f"[1:v]format=gbrp[g];{src}[g]blend=all_mode=overlay:all_opacity={grain_op}:shortest=1,format=yuv420p[o]"
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{ep.W}x{ep.H}",
         "-framerate", str(ep.fps), "-i", "-",
         "-loop", "1", "-i", str(grain), "-filter_complex", chain,
         "-map", "[o]", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", str(ep.fps), "-shortest",
         "-frames:v", str(len(rng)), str(video)], stdin=subprocess.PIPE)
    n = workers or max(1, (os.cpu_count() or 2))
    t0 = time.time()
    ctx = mp.get_context("fork")
    with ctx.Pool(n) as pool:
        for k, png in enumerate(pool.imap(_render_frame, rng, chunksize=2)):
            ff.stdin.write(png)
            if k % 96 == 0:
                el = time.time() - t0
                eta = el / max(1, k) * (len(rng) - k)
                print(f"      frame {k}/{len(rng)}  {el:.0f}s elapsed, ~{eta:.0f}s left", flush=True)
    ff.stdin.close()
    ff.wait()
    print(f"      frames done in {time.time() - t0:.0f}s")
    print("[5/5] mux")
    from .vertical import captions_ass, make_vertical
    if ep.vertical:
        ass = build / "captions.ass"
        captions_ass(ep, ass, ep.W, ep.H, int(ep.captions.get("y", ep.H * 0.71)))
        dst = out / f"{ep.name}_9x16.mp4"
        vf = f"ass={ass}:fontsdir={ROOT / 'assets/fonts'}" if ep.captions.get("enabled", True) else "null"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(wav), "-vf", vf,
                        "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "aac", "-b:a", "192k",
                        "-t", f"{ep.total + 0.3:.2f}", "-movflags", "+faststart", str(dst)], check=True)
        return {"9x16": dst, "duration": ep.total}
    final43 = out / f"{ep.name}_4x3.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(wav), "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "192k", "-t", f"{ep.total + 0.3:.2f}", "-movflags", "+faststart", str(final43)], check=True)
    final916 = make_vertical(ep, final43, build, out)
    return {"4x3": final43, "9x16": final916, "duration": ep.total}
