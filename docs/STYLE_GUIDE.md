# Style guide (from the 4 reference clips)

The references are AI-generated TikTok skits in a **Y2K fashion-doll cartoon** look (768×576, 4:3, 24-30 fps,
33-96 s). This studio reproduces the *genre* (look + editing rhythm) with an original cast, world and story;
it does not copy the reference account's characters, logo or catchphrase.

## Look

- **Proportions:** huge head (≈1/3 of body height), tiny torso, very long legs, chunky platform shoes.
- **Eyes:** very large almond/cat-eye shape, thick black upper lash line with a wing and 3 spiky lashes,
  colored iris with radial gradient + two white highlights, eyeshadow under a crease line.
- **Lips:** full, glossy (white highlight on the lower lip), darker lip liner; tiny nose (just nostrils).
- **Hair:** long and straight, center/side part, drawn with many fine strand lines plus a lighter sheen band;
  back layer darker than the front curtains; pointy tips.
- **Line:** dark plum outlines (never pure black), ~3 px at 1080p, a bit heavier in close-ups.
- **Shading:** flat cel fills, one shadow tone, soft pink blush; backgrounds slightly desaturated,
  paper grain over the whole frame.
- **Props:** the "hero" prop (phone, bag) gets a neon pink glow outline.
- **Palette:** pinks/magentas, mint, lilac, baby blue, cream; Y2K accessories (hoops, chokers, heart
  sunglasses, crop tops, flares, varsity jackets).

## Editing rhythm (measured)

| clip | cuts | median shot | mean shot |
|---|---|---|---|
| 1 (33 s) | 33 | 0.79 s | 0.88 s |
| 2 (37 s) | 19 | 1.75 s | 1.73 s |
| 3 (96 s) | 63 | 1.17 s | 1.46 s |
| 4 (49 s) | 29 | 1.23 s | 1.54 s |

- Mostly **close-ups**: one face per shot, reacting. Wide shots only to establish a location.
- **Inserts** of the key object (phone screen, bag) between faces.
- One short line per shot (1-3 s), hard cuts on the line ends, quick reaction shots (0.5-1 s) in between.
- Comedy comes from deadpan one-liners, exaggerated reaction faces (crying, shock), and a visual payoff
  at the end.

## Audio

- Dialogue-driven: expressive, short, sassy lines; little narration.
- Light music bed (one clip has a punchy beat), stings and whooshes on cuts.

## How the engine maps this

| reference trait | engine feature |
|---|---|
| reaction close-ups | `camera: {frame: cu/ecu, on: who}` with a slow `push` |
| exaggerated faces | expression presets (`shock`, `cry`, `smug`, `panic` …) blended in 0.16 s |
| glowing hero prop | `set: phone` insert with neon glow |
| fast cutting | shot length auto-fits each line; short `dur:` reaction shots |
| paper texture | grain overlay at 9 % in the encoder |
| depth of field | close-ups use a pre-blurred copy of the set |
