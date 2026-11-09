"""Command line:

    python -m studio EPISODE.yaml                 # full render -> renders/<name>_4x3.mp4 and _9x16.mp4
    python -m studio EPISODE.yaml --sheet         # contact sheet of every shot (fast review)
    python -m studio EPISODE.yaml --still 12.5    # one frame at 12.5 s -> renders/<name>_still.png
"""
import argparse
import io
import sys
from pathlib import Path

import resvg_py

from . import engine


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m studio")
    ap.add_argument("episode")
    ap.add_argument("--still", type=float, action="append", help="render single frame(s) at these seconds")
    ap.add_argument("--sheet", action="store_true", help="render a contact sheet (3 frames per shot)")
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--out", default="renders")
    a = ap.parse_args()
    if a.still or a.sheet:
        ctx = engine.render_episode(a.episode, a.out, preview=True)
        ep, sc = ctx["episode"], ctx["scene"]
        out = engine.ROOT / a.out
        out.mkdir(parents=True, exist_ok=True)

        if a.still:
            for t in a.still:
                p = out / f"{ep.name}_still_{t:06.2f}.png"
                engine.frame_image(min(ep.nframes - 1, int(t * ep.fps))).save(p)
                print(p)
        if a.sheet:
            import multiprocessing as mp
            from PIL import Image
            frames = []
            for sh in ep.shots:
                for u in (0.15, 0.5, 0.88):
                    frames.append(min(ep.nframes - 1, int((sh.start + sh.dur * u) * ep.fps)))
            with mp.get_context("fork").Pool(a.workers or None) as pool:
                raws = pool.map(engine._render_frame, frames, chunksize=2)
            tw = 360 if ep.W > ep.H else 180
            th = int(tw * ep.H / ep.W)
            thumbs = [Image.frombytes("RGB", (ep.W, ep.H), b).resize((tw, th)) for b in raws]
            cols = 6 if ep.W > ep.H else 12
            rows = (len(thumbs) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * (tw + 4), rows * (th + 4)), "white")
            for i, im in enumerate(thumbs):
                sheet.paste(im, ((i % cols) * (tw + 4), (i // cols) * (th + 4)))
            p = out / f"{ep.name}_sheet.jpg"
            sheet.save(p, quality=88)
            print(p)
        return
    res = engine.render_episode(a.episode, a.out, workers=a.workers)
    print(f"\nDone: {res['duration']:.1f}s episode")
    print(f"  4:3  -> {res['4x3']}")
    print(f"  9:16 -> {res['9x16']}")


if __name__ == "__main__":
    main()
