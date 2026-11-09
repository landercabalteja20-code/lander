# References

Reference shorts saved for What-If episodes. Other creators' MP4s are never committed, since this repo is
public. Each pack keeps a contact sheet, a few stills and a `STYLE.md` with the measured format.

| Pack | What it is | Where |
|---|---|---|
| [`zackdfilms-3d-shorts/`](zackdfilms-3d-shorts/STYLE.md) | **The reference for the next What-If** (saved 2026-11-09): 3 narrated, semi-realistic 3D shorts (an absurd made-up sport, a true story, a parable) | here |
| `whatif/references/STYLE.md` + 2 folders of stills | low-poly 3D pop-star What-Ifs with a serif title, HUD counter and end card | branch `claude/funny-gates-8k40w2` |
| `docs/STYLE_GUIDE.md` | 4 Y2K fashion-doll 2D cartoon skits | branch `claude/zealous-ramanujan-vyot46` |
| `docs/inspiration-notes.md` | notes on 6 "What if…?" 3D shorts (structure and pacing) | branch `claude/3d-animation-threejs-remotion-betz0y` |

Read a file from another branch without switching: `git fetch origin && git show origin/<branch>:<path>`.

## Adding a pack

1. Make a folder named after the source or format, with one subfolder per video named after its premise.
2. Keep `contact-sheet.jpg` (one frame per second, timestamped) and a few native-resolution
   `still-<time>s-<technique>.jpg` frames. Don't commit the videos.
3. Write `STYLE.md`: what to borrow, measured numbers (length, words per second, caption timing, cuts,
   loudness), beat sheets in our own words, and what not to copy.
