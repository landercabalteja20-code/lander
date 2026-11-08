# lander — 3D animation with Three.js + Remotion

- **Three.js** (via `@react-three/fiber` + `@remotion/three`): the 3D scene
- **Remotion**: timeline, audio, captions and video rendering (MP4)
- **@remotion/captions**: TikTok-style word-highlighted captions
- **@remotion/media**: `<Audio>` / `<Video>` components

## Setup

Requires Node.js 18+ (ffmpeg is bundled with Remotion).

```bash
npm install
npm run dev          # opens Remotion Studio at http://localhost:3000 (live preview)
npm run render       # renders out/video.mp4 (GPU / "angle" OpenGL)
npm run render:cpu   # same, but software WebGL – use on servers without a GPU
npm run still        # renders a single frame to out/thumbnail.png
```

## Project layout

| File | What it does |
| --- | --- |
| `src/Root.tsx` | Registers the `Main` composition (1920×1080, 30fps, 8s) |
| `src/Main.tsx` | Layers the 3D scene, captions and audio |
| `src/Scene3D.tsx` | The Three.js scene inside `<ThreeCanvas>` |
| `src/Captions.tsx` | Loads `public/captions.json` and shows animated captions |
| `public/` | Assets (audio, captions, textures, models) – load with `staticFile()` |
| `remotion.config.ts` | Render settings (WebGL renderer, concurrency) |

## Adding audio

Put a file in `public/` (e.g. `public/music.mp3`) and set `audioFile: "music.mp3"`
in `mainSchemaDefaults` in `src/Main.tsx` (or change it in the Studio's props panel).

## Captions

`public/captions.json` is an array of `Caption` objects:

```json
{ "text": " Hello", "startMs": 500, "endMs": 950, "timestampMs": 725, "confidence": 1 }
```

Have an `.srt` file? Use `parseSrt()` from `@remotion/captions`. To auto-transcribe
your audio, add `@remotion/install-whisper-cpp` and use its `toCaptions()` helper.

## Rules for 3D animation in Remotion

- Drive all motion from `useCurrentFrame()` (plus `interpolate` / `spring`). **Don't** use
  r3f's `useFrame()` or `clock` — renders must be deterministic, frame by frame.
- 3D models: put `.glb` files in `public/` and load with drei's `useGLTF(staticFile("model.glb"))`.

## Video editing toolkit

Working folders: `raw/` (source footage) → `references/` (inspiration) → `done/` (finished exports).
Media files in these folders are git-ignored.

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # faster-whisper, yt-dlp
npm install                                                          # Remotion, HyperFrames
```

| Tool | Use | Command |
| --- | --- | --- |
| FFmpeg (libass) | cut, convert, burn `.ass`/`.srt` subtitles | `ffmpeg -i in.mp4 -vf "ass=subs.ass" out.mp4` |
| faster-whisper | transcribe with word timestamps | `.venv/bin/python` → `WhisperModel("base")` |
| yt-dlp | download references | `.venv/bin/yt-dlp -o "references/%(title)s.%(ext)s" URL` |
| Remotion | React/Three.js video rendering | `npm run render` |
| HyperFrames | HTML + GSAP video rendering | `npx hyperframes init` / `npx hyperframes render` |

Note: YouTube/Vimeo block downloads from cloud servers ("confirm you're not a bot");
pass `--cookies` or run yt-dlp locally. TikTok, archive.org and direct links work.
