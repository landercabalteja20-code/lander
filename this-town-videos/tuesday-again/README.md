# Tuesday, Again

Your "In this town" script, animated as a Roblox-style story video using the format from [`../README.md`](../README.md).

| | |
|---|---|
| Length | 4:22 (117 shots, one per narration line) |
| Format | 1080×1920 vertical, 30 fps, H.264 + AAC |
| Voice | AI narrator (Kokoro TTS, `am_eric`) at 1.18× speed: about 211 words per minute while talking and 171 overall, the same pace as the reference videos |
| Captions | One word at a time in Poppins ExtraBold, `#E1FE00` fill, black outline, soft shadow, centered at 72% of the height, popping in on each word |
| Music and sound | Synthesized from scratch for this video, so there is no third-party music to clear. The music bed sits about 8.5 dB under the voice |
| Visuals | Rendered in code with three.js: blocky characters with 2D cartoon faces, a pastel town, the night town, the highway that ends, the stair shaft, the flooded underground town, the photo room and the stacked-towns cutaway |

- [`script.md`](script.md): your script with the exact time each line starts. Use it if you re-record the voice or edit captions.
- `source/`: everything needed to re-render or change the video (scenes, shots, voice, music and captions).

## How the video is put together

1. **Voice.** `source/pipeline/lines.py` holds each line twice: the caption text (with numerals such as 7:06 and 17-year-old) and the spoken text (such as "seven oh six"). `tts_make.py` voices each line and joins them with gaps of 0.3–1.1 s.
2. **Caption timing.** `align.py` runs speech recognition on each voiced line to time every caption word. The result is `source/data/words.json`.
3. **Animation.** `source/anim/main.js` contains the 117 shots, one function per line. Each shot picks a set, places the characters, sets their faces and moves the camera. `render.js` renders every frame in headless Chromium.
4. **Sound.** `audio.py` builds the music for each section (hook, experiments, road, twist, horror, final), adds the sound effects at the matching words, and mixes them under the narration.
5. **Captions.** `captions.py` writes `captions.ass`, which ffmpeg burns in during the final encode.

## Re-rendering

You need Node 18+, Python 3.11+, ffmpeg built with libass, and Chromium through Playwright.

```bash
# 1. voice and caption timing (Python: kokoro-onnx, faster-whisper, soundfile, scipy, praat-parselmouth)
python pipeline/tts_make.py <kokoro-model-dir> <work-dir> 1.18
python pipeline/align.py <work-dir>
# 2. frames: serve source/anim (with node_modules/three, fonts/, timeline.json and words.json next to it), then:
node pipeline/render.js <frames-dir> 720 30 0-7862
# 3. sound and captions
python pipeline/audio.py <work-dir> <kokoro-model-dir>
python pipeline/captions.py <work-dir> captions.ass 170
# 4. final encode
ffmpeg -framerate 30 -i <frames-dir>/f_%06d.jpg -i mix.wav \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos,ass=captions.ass:fontsdir=fonts[v];[1:a]loudnorm=I=-14:TP=-1.5[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart tuesday-again.mp4
```

Fonts are not stored here. Download Poppins (ExtraBold, Bold), Saira Stencil One and Permanent Marker from Google Fonts into `anim/fonts/`.

## Changing things

- **A line's wording:** edit `lines.py`, then redo steps 1, 2, 4 and 5. Shot timings follow the new voice automatically.
- **A shot:** edit its function in `main.js` (the comment above each one is the line it illustrates), then re-render only that shot's frames.
- **Voice:** change `am_eric` in `tts_make.py`. Run `python -c "from kokoro_onnx import Kokoro; print(Kokoro(m, v).get_voices())"` to list the voices.
