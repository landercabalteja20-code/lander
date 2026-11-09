# What if P-POP was bigger than K-POP?

A 3-minute (exactly 180 s) real-time 3D animated musical starring **HIRAYA**, a fictional five-member Filipina girl group. Five glossy fashion-doll idols with anime faces perform an original song, **“KILIG (Worldwide)”**, in an alternate-reality Manila where P-POP is the biggest music industry on Earth.

Everything is generated in code, in the browser: the 3D world (Three.js), the dolls and their faces, the choreography, the camera work, and the whole soundtrack, including the five singing voices (Web Audio). There are no image, model or audio files.

## Run it

Any static file server works. From the repo root:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Press **Play the film** with sound on.

| Key | Action |
|---|---|
| Space | Play / pause |
| ← / → | Seek 5 s |
| C | Captions (karaoke lyrics + interview subtitles) |
| M | Mute |
| F | Fullscreen |

URL options: `?q=high|medium|low` sets the crowd size (100k / 50k / 20k fans) and render resolution, and `?t=95` opens paused at 1:35.

## Export to MP4

`tools/render-mp4.js` renders the film to a 1280×720, 24 fps H.264 MP4 with the soundtrack as 192 kbps AAC. It needs Node 18+ and ffmpeg.

```bash
cd tools && npm install && npx playwright install chromium && cd ..
node tools/render-mp4.js --workers 3 --quality high --out hiraya.mp4
```

It renders the soundtrack offline, then draws every frame in a headless browser using film time, so lip-sync and on-screen text line up exactly. Frames are split into segments at camera cuts and rendered in parallel. On a machine without a GPU this takes a few hours; use `--from 52 --to 96` to render a single section.

## The film

| Time | Bars | Scene | What happens |
|---|---|---|---|
| 0:00 | 1–4 | Cold open | Aerial over a pastel, futuristic Manila. Title card. |
| 0:08 | 5–13 | Manila 2026 | Holographic HIRAYA billboards, hover-jeepneys, pink monorail, Hiraya Dome. Documentary “facts” and a news ticker. |
| 0:26 | 14–24 | Backstage | Pink dressing room, bulb-lit vanities, costume rack, the five mics in a display case. One talking-head interview per member. |
| 0:48 | 25–26 | Showtime | Dark stadium, 100,000 lightsticks. The members rise on stage lifts. |
| 0:52 | 27–28 | Drop | “HI-RA-YA!” Fireworks, confetti, lights up. |
| 0:56 | 29–36 | Verse | Amara, then Liway. |
| 1:12 | 37–40 | Pre-chorus | Tala, then the group call “Ready na ba kayo?” |
| 1:20 | 41–48 | Chorus | All five. |
| 1:36 | 49–56 | Rap | Saya, then Yzel. |
| 1:52 | 57–60 | Pre-chorus | Liway, Tala. |
| 2:00 | 61–68 | Chorus | All five, with ad-libs. |
| 2:16 | 69–74 | Dance break | Yzel center, lightstick strobe in member colors. |
| 2:28 | 75–78 | Bridge | Amara alone. Slow motion and holographic butterflies. Ends on a held high note into a key change. |
| 2:36 | 79–86 | Final chorus | Up a half step. Fireworks. |
| 2:52 | 87–88 | Finale | “Ma-bu-hay!” Freeze on the group pose. |
| 2:56 | 89–90 | Epilogue | “KILIG.” Fade to black at exactly 3:00. |

The song runs at 120 BPM in 4/4, so one bar is 2 s and the film is exactly 90 bars.

## HIRAYA

| Member | Role | Look | Microphone | Voice |
|---|---|---|---|---|
| **Amara** | Leader & main vocalist | Long black high ponytail, pearl-pink satin jacket, white corset, silver pleated skirt, pearls | Pearl-pink metal, silver grille, pearls | Clear, elegant lead with big high notes |
| **Yzel** | Main dancer | Silver-lavender wolf cut, violet/black racing jacket, purple cargo shorts, chrome, platform sneakers | Metallic violet, black grille, glowing purple ring | Confident, slightly husky |
| **Liway** | Vocalist | Brown bubble ponytails with icy-blue streaks, baby-blue sparkle cardigan, blue/white bubble skirt, silver leg warmers | Translucent icy blue with stars | Sweet, airy harmonies |
| **Saya** | Rapper | Long cherry-red braids, red varsity jacket, black cargo mini, chrome chains | Candy red, black grille, silver flames | Bold, low-register rap |
| **Tala** | Center | Caramel space buns with gold highlights, butter-yellow sparkle jacket, white pleated skirt, gold accents | Champagne gold, pearl grille, gold star charms | Bright, playful pop |

Every member is built once in `src/members.js` and `src/characters.js`, and every scene uses those same objects, so faces, hair, outfits and mics never change between shots. Each doll holds only her own mic.

## How the lip-sync works

`src/song.js` is the vocal score. Every syllable has a start time, length, pitch and singer. The same score drives three systems:

1. **Audio**: `src/audio.js` sings each syllable with a formant voice synth (sawtooth + breath noise through vowel formant filters), using each member’s voice settings. In choruses Amara and Tala sing the melody, Liway a third above, and Yzel and Saya an octave below.
2. **Mouths**: `src/lipsync.js` turns the syllable under the playhead into a mouth shape (jaw opening, lip spread, rounding; closed lips on m/b/p; diphthongs on ay/aw). Members who are not in the current line keep their mouths closed and keep dancing.
3. **Captions**: karaoke highlighting, colored by singer.

The visuals take their clock from the audio clock, so picture and sound stay locked together. To replace the synthesized vocals with a real recording, sing the score in `src/song.js` at 120 BPM and the mouths will match.

## Code map

| File | Role |
|---|---|
| `src/timeline.js` | Master clock, sections, documentary chyrons, lightstick programs, fireworks, slow motion |
| `src/song.js` | Lyrics, melody, rap rhythms, interviews, chords |
| `src/audio.js` | Web Audio engine: drums, bass, pads, kulintang gongs, voices, crowd, real-time scheduler, offline render |
| `src/members.js` | The five members’ designs, colors and voices |
| `src/faces.js` | 2D anime face painter (eyes, lashes, shimmer shadow, glossy lips) and billboard portraits |
| `src/characters.js` | 3D doll rig, hair with spring physics, outfits, microphones, mic-to-mouth IK |
| `src/choreo.js` | Dance moves, formations, and the per-member director |
| `src/lipsync.js` | Visemes, blinks, expressions, eye contact with the camera |
| `src/city.js`, `src/backstage.js`, `src/stadium.js` | The three sets |
| `src/camera.js` | The shot list: every cut, dolly, orbit and crane |
| `src/ui.js`, `styles.css` | Chyrons, captions, controls |

## Limits

- The singing voices are synthesized vowel sounds, so the lyrics come through in the captions rather than as clear words. A real vocal recording made to the score will lip-sync without any code changes.
- This is a real-time render. It needs WebGL2 and runs best on a desktop GPU. Choose **Low** on phones and older laptops.
