# "What if… pop star" — reference style guide

Two reference shorts were saved here as stills and contact sheets. They came from other creators' accounts, so the original MP4s are not committed. Only frames for study are kept. This guide records what makes the format work, so every new episode matches it.

| Folder | Premise | Length | Escalating counter |
|---|---|---|---|
| `popstar-100x-taller/` | "What if a pop star was 100 times taller?" | 84 s | `THE STAR 1,616 ft` → `HER HIPS 4 ft` |
| `popstar-level9-thunderstorm/` | "What if a Level 9 thunderstorm hit her concert?" | 87 s | `STORM LEVEL 1/9` → `12` ("off the scale") |

## Format (both videos share it)

- **Vertical 9:16**, 1080×1920 (refs were 576×1024), 30 fps.
- **Low-poly, game-engine 3D look**: flat colours, simple boxy cities, soft fog, no textures beyond window grids/sequins. Reads as "procedural toy world".
- **One hero: the pop star.** She is always performing (mic in hand, dancing) no matter how absurd things get. Her calm vs. the escalating chaos is the joke.
- **Hard cuts every ~3–5 s**, each a new camera angle: wide establishing → low-angle hero → close-up face → crowd/POV → environment detail.
- **Escalation structure**: a numeric counter climbs through stages, each stage gets one caption, and the final stage goes "off the scale".
- **Ending**: hard cut to a dark end card that re-asks the question and ends with a comment call-to-action.

## Typography & layout (measured at 1080 px wide)

| Element | Font | Size | Position | Colour |
|---|---|---|---|---|
| Title question | Serif regular (Newsreader) | ~64 px, 2 lines | centred, ~25 % from top, first ~6 s | white; key phrase in gold `#E8C15A` |
| HUD label | Sans semibold caps, tracking +4 px | ~24 px | left 6 %, ~42 % from top | white 90 % |
| HUD big number | Serif regular | ~84 px, with small `/9` at 45 % opacity | under label | white |
| HUD sub line | Mono caps, tracking +3 px | ~20 px | under number | white 65 % |
| HUD pill | Mono caps on dark translucent pill, red dot `●` | ~18 px | under sub line | white |
| Caption | Serif *italic* | ~52 px, max 80 % width | centred, ~60 % from top | white, soft drop shadow |
| End card bg | — | — | full screen | `#141414` |
| End card title / fact / question / CTA | serif / mono caps grey / serif italic / sans caps gold `#D9A93D` | 64 / 18 / 52 / 22 px | stacked around centre | — |

Captions are short, deadpan, with a measurable fact ("She weighs more than the Titanic.", "Level 5. Hail the size of golf balls.").

## The two girls (rebuilt in `kit/popstar.js`)

The models could not be extracted from the videos, which contain pixels only. Both were rebuilt from scratch as procedural Three.js characters with the same look.

- **`SUNNY`** (100× taller): chunky low-poly blonde, big voluminous shoulder-length hair with side bangs, warm tan skin, red lips, gold choker, hoop earrings, gold bracelets. Yellow **sequin** strapless sweetheart mini dress, brown belt with silver **star buckle**, yellow boots, handheld silver mic.
- **`EMERALD`** (thunderstorm): long straight red hair with blunt bangs, pale skin, dark lips, green satin floor-length gown with puffed shoulders and long sleeves, gold belt with ornament, gold bracelets, mic.

## Sets seen in the references (rebuilt in `kit/`)

- Manhattan-style city: brick and beige towers with window grids, water towers, yellow taxis, trees (`kit/city.js`)
- Night skyline with lit windows, rooftop stage, rain streaks, lightning (`kit/city.js`, `kit/particles.js`)
- Office interior with cubicles (referenced only)
- Running crowds of simple people (`kit/crowd.js`, species `human`)
