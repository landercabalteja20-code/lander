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

        def png(t):
            return bytes(resvg_py.svg_to_bytes(svg_string=sc.frame_svg(t), font_dirs=engine.FONT_DIRS,
                                               resources_dir=str(sc.bgdir)))
        if a.still:
            for t in a.still:
                p = out / f"{ep.name}_still_{t:06.2f}.png"
                p.write_bytes(png(t))
                print(p)
        if a.sheet:
            from PIL import Image
            times = []
            for sh in ep.shots:
                for u in (0.15, 0.5, 0.88):
                    times.append((sh.id, sh.start + sh.dur * u))
            thumbs = []
            for sid, t in times:
                im = Image.open(io.BytesIO(png(t))).convert("RGB").resize((360, 270))
                thumbs.append(im)
            cols = 6
            rows = (len(thumbs) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * 364, rows * 274), "white")
            for i, im in enumerate(thumbs):
                sheet.paste(im, ((i % cols) * 364, (i // cols) * 274))
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
