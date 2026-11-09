# What If… — pop star shorts

Procedural 3D "What if…" vertical videos. Everything (characters, sets, music, singing, captions) is generated from code. Three.js renders the frames, numpy synthesises the song, and ffmpeg muxes the MP4.

```
whatif/
  references/            saved reference shorts (stills + contact sheets) and STYLE.md (the format rules)
  kit/                   reusable 3D models
    popstar.js           the girl: rigged, singing, dancing (presets SUNNY + EMERALD)
    stage.js             stadium stage (LED wall, truss, moving beams) + flatbed-truck stage
    crowd.js             instanced crowds: blob, crystal, jelly, golem, tall, mushroom, tiny, human + light sea
    sky.js               gradient sky, stars, planets with rings, suns, aurora, galaxy
    city.js              window-grid buildings, water tower, cars, streetlights, strip mall, parking lot, signs
    particles.js         snow, embers, spores, dust, confetti, rain
    terrain.js           height-field terrain, animated ocean
    util.js              seeded rng, noise, easing, camera paths, canvas textures
  audio/synth.py         offline synth: formant-synthesised singing voice, pads, bells, drums, FX, reverb
  engine/                player + renderer (overlay text matches references/STYLE.md)
  episodes/
    popstar-47-planets/  episode.js (shots, captions, HUD) · sets.js · music.py · script.md · out/*.mp4
    _lab/                turntable of both pop star presets for checking the models
```

## Make / re-render an episode

```bash
cd whatif
npm install                                        # three + fonts
pip install numpy scipy
python3 episodes/popstar-47-planets/music.py       # -> build/song.wav + build/sing.json (lip sync), ~75 s
node engine/render.cjs popstar-47-planets --stills 10,50,120   # quick review stills -> build/stills/
node engine/render.cjs popstar-47-planets --workers 3          # full render -> out/popstar-47-planets.mp4
```

Rendering needs Chromium via Playwright (`npm i -g playwright` if you don't have it). Frames are written to `build/frames/`. Re-running resumes where it stopped.

**Live preview:** serve the folder (`python3 -m http.server` inside `whatif/`) and open
`http://localhost:8000/engine/player.html?ep=popstar-47-planets`. Space plays and pauses, and the slider scrubs.

## Using the girl in the next episode

```js
import { createPopStar } from '../../kit/popstar.js';
const star = createPopStar('SUNNY');        // blonde, yellow sequin mini dress, star belt, yellow boots
// const star = createPopStar('EMERALD');   // red hair with bangs, green satin gown
// const star = createPopStar('SUNNY', { dress: '#c0c0c8', hair: ['#222', '#333', '#111', '#2a2a2a'] }); // restyle
scene.add(star.group);
star.update(t, {
  beat,                 // song beat (drives sway / bounce)
  mouth, vowel,         // lip sync: 0..1 and 'a'|'e'|'i'|'o'|'u'|'m' (see build/sing.json)
  armL: 'hip',          // mic | hip | down | up | reach | out | wave | heart | point | shield
  armR: 'mic',          // her right hand holds the mic and aims it at her mouth automatically
  armL2: 'up', armLw: 0.5, // optional blend to a second pose
  look: camera.position,   // she finds the camera
  dance: 1, hop: 0, wind: 0, eyesClosed: 0, crouch: 0,
});
star.setWet(1);         // rain look
```

All animation is a pure function of time, so frames can render in parallel and in any order.

## Format checklist (from references/STYLE.md)

- Title question in serif, top third, with one key phrase in gold. Show it for the first ~6 s.
- Left HUD: CAPS label / big serif counter `n /N` / mono sub-lines / dark pill with a red dot.
- One italic serif caption every ~5 s: deadpan, with a measurable fact.
- Hard cuts every ~4–5 s that alternate wide, hero low-angle, close-up and crowd.
- The counter escalates, and the last stage goes "off the scale" or flips the premise.
- Dark end card: re-ask the question, add a tiny mono fact line, an italic question, and a gold "TELL US IN THE COMMENTS ↓".
