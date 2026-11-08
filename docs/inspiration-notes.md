# Inspiration notes — "What if…?" 3D shorts

Analysis of 6 reference videos (not stored in repo). Use for **structure and pacing only** —
do not copy their visual style, fonts, HUD layout or characters.

## Shared format
- Vertical 9:16 (references are 576×1024; we render 1080×1920), 30fps, **68–84 s** long.
- Continuous audio: voice-over narration + background music / SFX.
- Low-poly / stylized 3D scenes, mostly city, park, beach, suburban house, office, café.

## Story structure (the part worth borrowing)
1. **Hook (0–3 s):** the "What if …?" question shown on screen over the opening shot.
2. **Grounding:** "You're in Central Park" / "You're on a rooftop bar" — puts the viewer in a relatable place.
3. **Escalation:** each 3–5 s beat is a new consequence, getting bigger
   (local → city → planet). Frequent camera cuts: wide → close-up → POV → aerial.
4. **Live data readout:** a counter that changes all video (countdown timer, height in ft,
   distance "HER HIPS 1,222 ft … HERE"), plus a small stat line underneath. Builds tension.
5. **Climax:** the impact / catastrophe arrives at the viewer ("HERE"), cracked-glass / whiteout.
6. **Outro (last ~6 s):** dark card repeating the question + one-line fact + call to action
   ("What idea should we try next? Tell us in the comments").

## Two caption approaches seen
- **A — one word at a time**, bold sans, center screen, synced to the voice (house/tornado, tsunami videos).
- **B — one short sentence per beat**, small italic serif, lower third (pop star, oxygen, electrons, cramps).

## Topics seen
Giant pop star walking through NYC · underground tornado-proof house · oxygen gone for 5 s ·
tsunami-proof tower · electrons gone for 5 s · every man gets period cramps for 1 min.

## Ideas for our own original look (to be decided with the next prompt)
- Own colour palette, typography and HUD design (not the white-serif/italic look).
- Built in Three.js with procedural low-poly assets → full control, no copied models.
- Reusable building blocks: `Hook`, `Beat` (scene + caption + counter), `StatCounter`,
  `CameraRig` (frame-driven cuts/moves), `OutroCard`, word-synced `Captions`.
