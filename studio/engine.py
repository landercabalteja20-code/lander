"""Episode loader, timeline, per-frame scene builder and the render pipeline."""
from __future__ import annotations

import math
import multiprocessing as mp
import os
import re
import shutil
import subprocess
import sys
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
from .character import CharState, Face, HairState, Look, Pose, draw_character, expression
from .svgkit import Defs, blur_filter, clamp, ease_in_out, ease_out, ease_out_back, f, group, hash01, lerp, noise1, smoothstep

ROOT = Path(__file__).resolve().parent.parent
FONT_DIRS = [str(ROOT / "assets/fonts")]
W, H = 1440, 1080

FRAMES = {  # framing presets: (visible height in character units, vertical center offset)
    "ecu": (300, 10), "cu": (450, 0), "mcu": (600, 70), "ms": (780, 160), "full": (1000, 260),
}


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
    enter: Optional[str] = None
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


class Episode:
    def __init__(self, path: Path):
        self.path = Path(path)
        data = yaml.safe_load(self.path.read_text())
        self.data = data
        self.name = self.path.stem
        self.title = data.get("title", self.name)
        self.fps = int(data.get("fps", 24))
        self.music = data.get("music")
        self.captions = data.get("captions", {})
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
                lines.append(A.Line(who=ls["who"], text=ls["text"], voice=ls.get("voice", c["voice"]),
                                    speed=float(ls.get("speed", c.get("speed", 1.0))),
                                    pitch=float(ls.get("pitch", c.get("pitch", 0.0)))))
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
                if "at" in spec:
                    st = float(spec["at"])
                else:
                    st = cur + float(spec.get("gap", 0.0))
                ln.start = g + st
                cur = st + ln.dur + 0.1
                ends.append(st + ln.dur)
                ln.env, ln.vis = A.mouth_envelope(ln.audio, self.fps)
            need = (max(ends) + float(sh.params.get("tail", 0.3))) if ends else 0.0
            sh.dur = max(float(sh.params.get("dur", 0.0)), need, 0.4)
            # resolve beat times
            for b in sh.beats:
                b.t = self._resolve(b.at, sh)
            sh.beats.sort(key=lambda b: b.t)
            # hair continuity
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

    def shot_at(self, t: float) -> Shot:
        for sh in self.ep.shots:
            if t < sh.start + sh.dur:
                return sh
        return self.ep.shots[-1]

    # ---------------------------------------------------------------- camera
    def camera(self, sh: Shot, lt: float) -> tuple[float, float, float, float]:
        cam = sh.camera
        frame = cam.get("frame", "ws")
        on = cam.get("on")
        actors = {a.who: a for a in sh.actors}
        if "z" in cam:
            cx, cy, z = cam.get("x", W / 2), cam.get("y", H / 2), float(cam["z"])
        elif frame == "two" and isinstance(on, list):
            a, b = actors[on[0]], actors[on[1]]
            s = (a.s + b.s) / 2
            cx = (a.x + b.x) / 2
            units, off = FRAMES[cam.get("height", "ms")]
            cy = (a.y + b.y) / 2 + off * s
            z = min(H / (units * s), W / (abs(a.x - b.x) + 560 * s))
        elif frame in FRAMES and on in actors:
            a = actors[on]
            units, off = FRAMES[frame]
            z = H / (units * a.s)
            cx, cy = a.x + float(cam.get("dx", 0)) * a.s, a.y + (off + float(cam.get("dy", 0))) * a.s
        else:
            cx, cy, z = W / 2, H / 2, 1.0
        dur = max(sh.dur, 0.01)
        u = ease_in_out(lt / dur)
        z *= 1 + float(cam.get("push", 0.04)) * u
        pan = cam.get("pan")
        if pan:
            cx += pan[0] * u
            cy += pan[1] * u
        rot = float(cam.get("rot", 0.0))
        # beats: punch zoom + shake
        shake = 0.0
        for b in sh.beats:
            if b.fx == "punch" and lt >= b.t:
                k = lt - b.t
                z *= 1 + 0.16 * (ease_out(clamp(k / 0.12)) if k < 0.12 else 1.0)
            if b.fx == "shake" and b.t <= lt < b.t + b.fxdur:
                shake = max(shake, 1 - (lt - b.t) / b.fxdur)
        if shake:
            cx += math.sin(lt * 63) * 10 * shake / z * 2
            cy += math.cos(lt * 71) * 8 * shake / z * 2
        z = max(1.0, z)
        hw, hh = W / 2 / z, H / 2 / z
        cx = clamp(cx, hw, W - hw)
        cy = clamp(cy, hh, H - hh)
        return cx, cy, z, rot

    # ---------------------------------------------------------------- actors
    def actor_state(self, sh: Shot, a: Actor, lt: float, gt: float) -> tuple[CharState, float, float]:
        face = expression(a.expr, **a.face)
        hair = HairState(color=a.hair)
        pose = Pose(arms=a.arms, phone_glow=a.phone_glow)
        x, y = a.x, a.y
        events = [b for b in sh.beats if b.who == a.who]
        # lines with an expression for this speaker behave like beats at the line start
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
                    hair = HairState(color=new)
                else:
                    hair = HairState(color=hair.color if not hair.to_color else hair.to_color, to_color=new,
                                     wipe=ease_in_out(w))
            if b.arms:
                kk = smoothstep(k / 0.3)
                if kk >= 1:
                    pose = Pose(arms=b.arms, phone_glow=pose.phone_glow)
                else:
                    pose = Pose(arms=pose.arms, arms_to=b.arms, arms_t=kk, phone_glow=pose.phone_glow)
        # entrance
        if a.enter:
            k = clamp(lt / 0.7)
            off = (1 - ease_out(k)) * (900 if a.enter == "right" else -900)
            x += off
            if k < 1:
                y -= abs(math.sin(lt * 11)) * 14 * a.s
        # idle life
        seed = hash01(a.who) * 100
        face = replace(face, look_x=face.look_x + noise1(gt * 0.55, seed) * 0.12,
                       tilt=face.tilt + noise1(gt * 0.4, seed + 3) * 1.6)
        # speech
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
        # blink every ~3s (skipped while eyes are squeezed shut)
        blink = 0.0
        period = 2.6 + hash01(a.who, "bp") * 1.6
        ph = (gt + hash01(a.who, "bo") * period) % period
        if ph < 0.16:
            blink = math.sin(math.pi * ph / 0.16)
        st = CharState(face=face, hair=hair, pose=pose, talk=talk, viseme=vis, blink=blink)
        return st, x, y

    # ---------------------------------------------------------------- frame
    def frame_svg(self, t: float) -> str:
        ep = self.ep
        sh = self.shot_at(t)
        lt = t - sh.start
        defs = Defs()
        for name, s in (("glow8", 8), ("glow12", 12), ("glow24", 24), ("softglow", 6)):
            defs.add(blur_filter(name, s))
        layers: list[str] = []
        screen: list[str] = []
        kind = sh.set
        p = sh.params
        if kind == "phone":
            who = p.get("hand", "mimi")
            look = ep.looks.get(who)
            layers.append(self._bg_image("bedroom", blur=True))
            layers.append(FX.phone_insert(defs, lt, look.skin if look else "#f2c3a3", p.get("contact", "bestie"),
                                          p.get("messages", []), nails=look.lips if look else "#ff4fae",
                                          glow=float(p.get("glow", 1.0)), typing=bool(p.get("typing", False))))
            cx, cy, z, rot = W / 2, H / 2, 1 + float(sh.camera.get("push", 0.05)) * ease_in_out(lt / sh.dur), 0
        elif kind == "chart":
            layers.append(FX.mood_chart(defs, lt, [tuple(r) for r in p.get("rows", [])], p.get("heading", "MOOD HAIR GUIDE"),
                                        float(p.get("step", 0.22))))
            cx, cy, z, rot = W / 2, H / 2, 1 + 0.03 * lt / sh.dur, 0
        elif kind in ("title", "end"):
            layers.append(FX.title_card(defs, lt, p.get("text", []), p.get("sub", "")))
            if kind == "end":
                layers.append(FX.confetti(lt))
            cx, cy, z, rot = W / 2, H / 2, 1 + 0.04 * lt / sh.dur, 0
        else:
            cx, cy, z, rot = self.camera(sh, lt)
            frame = sh.camera.get("frame", "ws")
            dof = sh.camera.get("dof", frame in ("ecu", "cu", "mcu"))
            layers.append(self._bg_image(kind, blur=bool(dof)))
            for a in sh.actors:
                look = ep.looks[a.who]
                st, x, y = self.actor_state(sh, a, lt, t)
                scr = a.s * z
                lw = scr ** -0.55
                body = draw_character(look, st, t, defs, lw=lw, full_body=a.full)
                sx = -a.s if a.flip else a.s
                layers.append(group(body, transform=f"translate({f(x)} {f(y)}) scale({f(sx)} {f(a.s)})"))
                # hair magic sparkles while the color wipes
                if st.hair.to_color:
                    hy = y + lerp(-200, 340, st.hair.wipe) * a.s
                    layers.append(FX.sparkles(x, hy, 260 * a.s, 70 * a.s, t * 1.5, n=14, seed=f"hw{a.who}",
                                              size=30 * a.s, strength=1.0))
                layers.append(self._actor_fx(sh, a, lt, t, x, y))
        # shot-level fx
        for b in sh.beats:
            if b.fx == "flash":
                screen.append(FX.flash(lt, b.t, 0.4))
            elif b.fx == "speed" and b.t <= lt < b.t + b.fxdur:
                screen.append(FX.speed_lines(t, 1 - (lt - b.t) / b.fxdur * 0.5))
            elif b.fx and b.fx.startswith("tint:") and lt >= b.t:
                col, op = (b.fx[5:].split("@") + ["0.25"])[:2]
                screen.append(FX.tint(col, float(op) * smoothstep((lt - b.t) / 0.3)))
        if p.get("tint"):
            col, op = (str(p["tint"]).split("@") + ["0.2"])[:2]
            screen.append(FX.tint(col, float(op)))
        if p.get("caption"):
            screen.append(FX.caption_box(p["caption"], W / 2, 140, 72))
        screen.append(FX.vignette(defs, 0.22))
        cam_tf = (f"translate({f(W / 2)} {f(H / 2)}) rotate({f(rot)}) scale({f(z)}) translate({f(-cx)} {f(-cy)})")
        body = group(layers, transform=cam_tf) + "".join(screen)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" '
                f'height="{H}" viewBox="0 0 {W} {H}">{defs.markup()}<rect width="{W}" height="{H}" fill="#ffd9ec"/>'
                f"{body}</svg>")

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
        return "".join(out)

    def _bg_image(self, set_name: str, blur: bool) -> str:
        p = self.bgdir / f"{set_name}_{'blur' if blur else 'sharp'}.jpg"
        return (f'<image href="{p.name}" x="0" y="0" width="{W}" height="{H}" preserveAspectRatio="none"/>')


# =========================================================================== backgrounds
def prerender_backgrounds(ep: Episode, bgdir: Path) -> None:
    from PIL import Image, ImageFilter
    bgdir.mkdir(parents=True, exist_ok=True)
    needed = {sh.set for sh in ep.shots if sh.set in SETS.SETS} | ({"bedroom"} if any(s.set == "phone" for s in ep.shots) else set())
    for name in sorted(needed):
        sharp = bgdir / f"{name}_sharp.jpg"
        blur = bgdir / f"{name}_blur.jpg"
        if sharp.exists() and blur.exists():
            continue
        defs = Defs()
        for i, s in (("glow8", 8), ("glow12", 12), ("glow24", 24), ("softglow", 6)):
            defs.add(blur_filter(i, s))
        body = SETS.SETS[name](defs)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
               f"{defs.markup()}{body}</svg>")
        png = bytes(resvg_py.svg_to_bytes(svg_string=svg, width=W * 2, height=H * 2, font_dirs=FONT_DIRS))
        import io
        im = Image.open(io.BytesIO(png)).convert("RGB")
        im.save(sharp, quality=93)
        im.filter(ImageFilter.GaussianBlur(9)).save(blur, quality=90)
        print(f"  background {name} cached")


def make_grain(path: Path) -> None:
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(11)
    g = rng.normal(128, 26, (H, W)).clip(0, 255).astype(np.uint8)
    Image.fromarray(g, "L").filter(ImageFilter.GaussianBlur(0.6)).convert("RGB").save(path)


# =========================================================================== rendering
_SCENE: Optional[Scene] = None


def _render_frame(i: int) -> bytes:
    sc = _SCENE
    t = i / sc.ep.fps
    svg = sc.frame_svg(t)
    return bytes(resvg_py.svg_to_bytes(svg_string=svg, font_dirs=FONT_DIRS, resources_dir=str(sc.bgdir)))


def render_episode(path: str, out_dir: str = "renders", workers: int = 0, preview: bool = False,
                   frames: Optional[tuple[int, int]] = None) -> dict:
    global _SCENE
    ep = Episode(Path(path))
    build = ROOT / "build" / ep.name
    build.mkdir(parents=True, exist_ok=True)
    print(f"[1/5] voices + timeline for '{ep.title}'")
    ep.build(ROOT / "build" / "tts")
    print(f"      {len(ep.shots)} shots, {ep.total:.1f}s, {ep.nframes} frames")
    print("[2/5] backgrounds")
    bgdir = build / "bg"
    prerender_backgrounds(ep, bgdir)
    grain = build / "grain.png"
    if not grain.exists():
        make_grain(grain)
    print("[3/5] audio mix")
    wav = build / "mix.wav"
    A.mixdown(ep.total, ep.all_lines, ep.cues(), ep.music, wav)
    _SCENE = Scene(ep, bgdir)
    out = ROOT / out_dir
    out.mkdir(parents=True, exist_ok=True)
    rng = range(*frames) if frames else range(ep.nframes)
    if preview:
        return {"episode": ep, "scene": _SCENE}
    print(f"[4/5] drawing {len(rng)} frames")
    video = build / "video.mp4"
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(ep.fps), "-c:v", "png", "-i", "-",
         "-loop", "1", "-i", str(grain),
         "-filter_complex", "[0:v]format=gbrp[v];[1:v]format=gbrp[g];[v][g]blend=all_mode=overlay:all_opacity=0.09,"
                            "format=yuv420p[o]",
         "-map", "[o]", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-r", str(ep.fps), "-shortest",
         str(video)], stdin=subprocess.PIPE)
    n = workers or max(1, (os.cpu_count() or 2))
    t0 = time.time()
    ctx = mp.get_context("fork")
    with ctx.Pool(n) as pool:
        for k, png in enumerate(pool.imap(_render_frame, rng, chunksize=2)):
            ff.stdin.write(png)
            if k % 48 == 0:
                el = time.time() - t0
                eta = el / max(1, k) * (len(rng) - k)
                print(f"      frame {k}/{len(rng)}  {el:.0f}s elapsed, ~{eta:.0f}s left", flush=True)
    ff.stdin.close()
    ff.wait()
    print(f"      frames done in {time.time() - t0:.0f}s")
    print("[5/5] mux + vertical version")
    final43 = out / f"{ep.name}_4x3.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(wav), "-c:v", "copy", "-c:a", "aac",
                    "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final43)], check=True)
    from .vertical import make_vertical
    final916 = make_vertical(ep, final43, build, out)
    return {"4x3": final43, "9x16": final916, "duration": ep.total}
