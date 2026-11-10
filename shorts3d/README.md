# shorts3d — narrated 3D What-If shorts

Makes vertical (1080×1920) narrated 3D shorts in the format saved in
[`references/zackdfilms-3d-shorts/STYLE.md`](../references/zackdfilms-3d-shorts/STYLE.md): one narrator at ~2.9 words/s,
a new picture every 1–2 s, a camera that never stops moving, 2–3-word captions, numbers built as 3D objects in the scene,
thought bubbles, and an ending less than a second after the last line.

Everything is generated locally and is original: sculpted characters, sets, voices (Kokoro TTS, Apache-2.0),
music and sound effects. No API keys.

| Episode | Length | Video |
|---|---|---|
| What if animals could somehow talk? | 44 s | `episodes/animals-talk/out/animals-talk.mp4` |

## Setup (once)

```bash
./setup.sh                  # three.js, Python tools (.venv), Kokoro voices, caption font, then sculpts the cast
```

## Make / re-render an episode

```bash
.venv/bin/python tools/characters.py                      # sculpt the cast -> assets/chars/*.glb (~20 s)
.venv/bin/python tools/build_audio.py animals-talk        # voices, word timings, music, SFX, captions -> build/
node engine/render.cjs animals-talk --shots               # shot list with timings
node engine/render.cjs animals-talk --stills 3.7,24.7     # review stills -> build/stills/
node engine/render.cjs animals-talk --workers 4           # full render -> out/animals-talk.mp4
```

Live preview: run `python3 -m http.server` in this folder and open
`http://localhost:8000/engine/player.html?ep=animals-talk` (space = play/pause, slider scrubs).
Check a character on a turntable with `node engine/render.cjs _lab --stills 0.5,2.5 --q "char=cat&jaw=0.5"`.

## How it fits together

| Path | What it does |
|---|---|
| `episodes/<ep>/lines.json` | the script: who says what, voice per character (Kokoro voices can be blended: `am_michael*0.65+am_fenrir*0.35`), pitch/speed, pauses, sound-effect cues and music sections, all anchored to words |
| `tools/build_audio.py` | voices every line, checks it with faster-whisper, aligns word timings, builds lip-sync envelopes, scores music + SFX, masters to −12 LUFS / −1 dBTP, writes `build/timeline.json` and `build/captions.ass` |
| `episodes/<ep>/episode.js` | sets and shots. Each shot starts on a word (`'n2@165'`, `'cow+-0.1'`, `'parrot.end+0.12'`), so re-voicing never needs re-timing |
| `tools/sculpt.py`, `tools/characters.py` | characters sculpted from smooth signed-distance shapes (clay-like blends, painted regions) and exported as GLB node trees with pivots for head, jaw, ears, tail, wings and arms |
| `kit/character.js` | loads a character, gives it fur/feather/skin materials, glossy eyes with painted irises (slit pupils for cats), eyelids and whiskers, and a `pose()` API |
| `kit/fx.js` | gradient skies, chunky 3D text counters, thought bubbles (a live sub-scene inside a cloud) |
| `kit/props.js` | procedural props: bedroom, farm, car interior, burger, city, office |
| `engine/` | renderer (depth of field, bloom, film grade), player page, headless frame renderer + ffmpeg mux |

## Making the next episode

Copy `episodes/animals-talk/` to a new folder, rewrite `lines.json` (110–125 words, story shape from the style guide),
run `build_audio.py`, then write shots in `episode.js` that start on the words they illustrate.
New characters go in `tools/characters.py` (see `dog()` for a talking animal: head, jaw, ears, tail, eyes).
