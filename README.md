# lander — What-If cartoon studio

Turns a short YAML script into a finished **Y2K fashion-doll style** cartoon (big lashed eyes, glossy lips,
strand-lined long hair, pastel pink world, fast reaction-shot editing), with voices, music, sound effects and
TikTok captions, all generated locally. No API keys or paid tools required.

Output for each episode:

| file | use |
|---|---|
| `renders/<episode>_9x16.mp4` | TikTok / Reels / Shorts: hook title on top, captions under the picture |
| `renders/<episode>_4x3.mp4`  | clean 4:3 master (same framing as the reference clips), no captions |

Current episode: **`episodes/mood_hair.yaml` — "What if your hair changed color with your mood?"** (~58 s).

## 1. Install (one time)

```bash
./setup.sh
```

This installs/downloads:

- **ffmpeg** (video encoding, captions via libass), if missing
- Python packages in `.venv/`: `resvg-py` (SVG renderer), `numpy`, `pillow`, `pyyaml`, `soundfile`,
  `kokoro-onnx` (neural text-to-speech)
- **Kokoro-82M** voice model + 27 English voices (Apache-2.0, ~340 MB, from Hugging Face) → `assets/models/`
- Fonts from Google Fonts (SIL Open Font License): Titan One, Fredoka, Baloo 2, Pacifico, Shrikhand → `assets/fonts/`

## 2. Render

```bash
.venv/bin/python -m studio episodes/mood_hair.yaml            # full render (~3-6 min on 4 CPU cores)
.venv/bin/python -m studio episodes/mood_hair.yaml --sheet    # quick contact sheet of every shot
.venv/bin/python -m studio episodes/mood_hair.yaml --still 12 # single frame at 12 s
```

Voices are cached in `build/tts/`, so re-renders after visual tweaks are fast.

## 3. Make your next What-If

Copy `episodes/mood_hair.yaml`, change the premise, and edit the shots. Each shot is a few lines:

```yaml
- id: jealous
  set: cafe                                  # bedroom | cafe | street | phone | chart | title | end
  actors:
    - {who: mimi, x: 360, y: 330, s: 0.75, expr: shock, face: {look_x: 0.9}}
  camera: {frame: cu, on: mimi, push: 0.1}   # ecu | cu | mcu | ms | full | two | ws
  beats:                                     # things that happen during the shot
    - {at: 0.25, who: mimi, expr: jealous, hair: green, sfx: scratch}
    - {at: 0.25, fx: punch}
  lines:
    - {who: dani, text: "Uh oh. She's going green.", at: 0.95}
```

- **Shot length is automatic**: it fits the dialogue (override with `dur:`).
- **Expressions:** neutral, soft, happy, laugh, love, dreamy, shock, gasp, panic, jealous, angry, sad, cry, smug,
  deadpan, embarrassed, sleepy, yawn, nervous, confident, suspicious, squeal. Fine-tune with `face:`
  (`look_x`, `look_y`, `turn`, `tilt`, `blush`, `eye_open`, `smile`, `tears` …).
- **Arms:** down, hip, phone, phone_up, cheeks, wave, hair, point, chin, shrug, mouth, cross.
- **Hair colors:** lilac, pink, hotpink, green, lime, blue, red, gold, violet, sunny, brown, coral, or any `#hex`.
  A `hair:` beat plays the root-to-tip color wipe with sparkles.
- **FX:** burst, hearts, sparkles, steam, anger, flash, speed, punch, shake, `tint:#hex@0.3`.
- **SFX:** ding, sparkle, whoosh, buzz, pop, scratch, boing, notify, tada, dun, gulp.
- **Voices:** set per character in `cast:` (e.g. `af_heart`, `af_bella`, `af_nicole`, `am_michael`, `bf_emma`;
  full list in `setup.sh`). Add `speed:` or `pitch:` (semitones) to tweak.
- **New characters:** add a `look:` block (skin, eye, lips, hair, outfit `top`/`bottom` + colors, earrings,
  `glasses_on_head`, `freckles`, `kind: boy` …) — see `studio/character.py` → `Look`.

## How it works

`studio/` is a small 2D animation engine:

| module | what it does |
|---|---|
| `character.py` | parametric doll rig drawn as SVG: eyes/lashes/brows/lips with visemes, tears, blush, strand-lined hair with color wipes, IK arms, outfits |
| `sets.py` | bedroom, café, street backgrounds (pre-rendered once, sharp + depth-of-field blur) |
| `fx.py` | sparkles, hearts, speed lines, flashes, phone close-up, mood chart, title/end cards |
| `audio.py` | Kokoro TTS voices, lip-sync envelopes, original synth music bed, synthesized SFX, mixdown with ducking |
| `engine.py` | YAML → timeline → per-frame SVG → resvg (multi-core) → ffmpeg (+ paper grain) |
| `vertical.py` | 9:16 layout + karaoke-style captions (mood words are colored) |

Everything (art, music, SFX) is generated, so the output is original and royalty-free. Voices come from the
Apache-2.0 Kokoro model. See `docs/STYLE_GUIDE.md` for the reference analysis the look and pacing are based on.
