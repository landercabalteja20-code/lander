# In This Town, Nobody Is Allowed to Say Goodbye

Your cinematic mystery script, animated as a Roblox-style story video in the format from [`../README.md`](../README.md). It follows the same pipeline as [`../tuesday-again/`](../tuesday-again/), with a darker grade, more interiors and a slower score.

| | |
|---|---|
| Length | 6:44 (174 shots, one per narration line). The script is about 1,200 words, so at the reference pace it runs longer than the 4–5 minutes in the brief |
| Format | 1080×1920 vertical, 30 fps, H.264 + AAC, loudness −14 LUFS |
| Voice | AI narrator (Kokoro TTS, `am_eric`) at 1.18× speed. The mother's key lines ("Goodbye, Elias.", "You're my father.", "Because I was seven…", "Goodbye.") are voiced slower and softer |
| Captions | One word at a time in Poppins ExtraBold, `#E1FE00` fill, black outline and soft shadow, popping in on each word. Long words shrink to fit the frame. The sign, the ledger stamp and the back of the ticket stay in capitals |
| Music and sound | Synthesized from scratch, so there is no third-party music to clear. The score follows the story: a music box for the town's rule, then piano. The music cuts out when the station clock stops. Drones play in the terminal, a heartbeat under the photographs and the basement, strings for the last goodbye, and an out-of-tune music box for the twist. The score sits about 9 dB under the voice |
| Visuals | Rendered in code with three.js: the autumn town, the station and platform by day and night, the station hall, the abandoned terminal with its photo walls and records room, the family home with the hidden bedroom and the basement, the school office, and the present-day platform |

- [`script.md`](script.md): your narration with the exact time each line starts. Use it if you re-record the voice or edit captions.
- `source/`: everything needed to re-render or change the video (scenes, shots, voice, music and captions).

## What was added or interpreted

- **Narration** is word for word from your script. Numbers appear as numerals in the captions (17-year-old, 1961, 7, 70) and are spoken as words.
- **Epilogue (lines 168–174)** is built from your "storytelling trick" notes. An old woman sits alone at a present-day station outside Bellwether, holding a ticket dated 1961. A conductor asks "Are you waiting for somebody?" and she answers "No. I think somebody's been waiting for me." The station clock then runs backward and the picture cuts to black.
- **The photographs carry the reveal.** Every photo in the film is rendered from the 3D scenes, then aged and framed. They include the 1961 photo under the station clock, the wedding, the newborn, the family photos that change, the albums, the oldest photograph and the final polaroid with his handwriting on the back. The twist returns to the oldest photograph, as your notes suggest.
- **The ending stays ambiguous.** Nothing on screen settles whether Bellwether was supernatural or imagined.

## How the video is put together

1. **Voice.** `source/pipeline/lines.py` holds each of the 174 lines twice: the caption text and the spoken text. `tts_make.py` voices each line and joins them with gaps of 0.3–1.2 s.
2. **Caption timing.** `align.py` runs speech recognition on each voiced line to time every caption word. The result is `source/data/words.json`.
3. **Animation.** `source/anim/main.js` contains the 174 shots, one function per line, with the line as a comment above it. Each shot picks a set, places the characters, sets their faces and moves the camera. Close-ups and two-shots use one framing helper, `cu()`, so faces stay readable in the vertical frame. `sets2.js` builds the station, hall, terminal, home and office.
4. **Sound.** `audio.py` writes the score cue by cue and places the sound effects at the matching words. These include the clock that stops, the door with no handle, the stamp in the ledger, the train whistle, the departing train and the clock running backward. It then mixes them under the narration and cuts to silence with the picture.
5. **Captions.** `captions.py` writes `captions.ass`, which ffmpeg burns in during the final encode.

## Re-rendering

You need Node 18+, Python 3.11+, ffmpeg built with libass, and Chromium through Playwright.

```bash
# 1. voice and caption timing (Python: kokoro-onnx, faster-whisper, soundfile, scipy)
cp pipeline/lines.py <work-dir>/
python pipeline/tts_make.py <kokoro-model-dir> <work-dir> 1.18
python pipeline/align.py <work-dir>
# 2. frames: serve source/anim (with node_modules/three, fonts/, timeline.json and words.json next to it)
#    on http://127.0.0.1:8766, then:
bash pipeline/render_all.sh <frames-dir>
# 3. sound and captions
python pipeline/audio.py <work-dir>
python pipeline/captions.py <work-dir> captions.ass 170
# 4. final encode
ffmpeg -framerate 30 -i <frames-dir>/f_%06d.jpg -i <work-dir>/mix.wav \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos,ass=captions.ass:fontsdir=fonts[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart nobody-says-goodbye.mp4
```

Fonts are not stored here. Download Poppins (ExtraBold, Black, Bold), Saira Stencil One and Permanent Marker from Google Fonts into `anim/fonts/`.

## Changing things

- **The more unsettling ending.** Your notes suggest letting the photographs carry the reveal. To do that, drop the lines that explain it (163–167, from "He never returned from the train." to "It was the last place she saw him alive."). That saves about 13 seconds. Remove them from `lines.py`, delete their shot functions in `main.js`, and redo steps 1–5.
- **A 4–5 minute cut.** The narration runs at about 179 words a minute. Reaching 4:45 means trimming about 350 words (roughly 2 minutes) from the script itself.
- **A line's wording:** edit `lines.py`, then redo steps 1–5. Shot timings follow the new voice automatically.
- **A shot:** edit its function in `main.js`, then re-render only that shot's frames. `pipeline/preview.js` renders one still per shot for a quick check, and `sheet.py` turns those stills into contact sheets.
- **Voice:** change `am_eric` in `tts_make.py`, or the speed for a single line in `SPECIAL`.
