# Narrated 3D shorts — reference for the next What-If

Three vertical shorts saved on 2026-11-09 as **the reference for the next What-If episode**. They come from
the TikTok account in the watermark (`@zackdfilms92`, "ZACK D FILMS" branding). As with the earlier
reference packs, the MP4s are **not** committed: they are someone else's videos, and this repo is public.
What is kept here: a 1-frame-per-second contact sheet and a few native-resolution stills per video, plus the
measurements and beat sheets below. Narration is paraphrased; only a few words are quoted.

Use this for **format, pacing and storytelling devices**. Make our own characters, world, voice, music and
brand. Don't reuse their scripts, characters, or the ZACK D FILMS name or logo.

| Folder | Premise | Story shape | Length* | Narration |
|---|---|---|---|---|
| `01-butter-relay/` | A relay race where the baton is full of cream, so the running churns it into butter | absurd process told as fact | 40.2 s | 109 words, 2.77 words/s |
| `02-jail-lesson/` | Parents have their car-stealing son jailed "to learn a lesson", and it ends in tragedy | true-story escalation | 35.4 s | 102 words, 2.96 words/s |
| `03-baboon-salt-trap/` | A baboon won't let go of salt in a tree hole, so it can't pull its fist out; people hold on to anger the same way | nature parable turned life lesson | 46.0 s | 130 words, 2.86 words/s |

\* Up to the creator's last frame. Each download also ends with 4–5 s of TikTok's own logo outro, which is not
part of the video.

## The format in one paragraph

One off-screen narrator tells a tiny story in 100–130 words. The first frame already shows the premise
happening and the first word is spoken at 0.0 s: no title, no intro. Every clause gets its own literal picture
from a camera that never stops moving, while 2–3-word captions change about once a second. Each video
leans on one or two signature devices (a cutaway that shows the mechanism, a thought bubble, a number built
as a 3D object in the scene). The last line is the twist or the moral, and the video ends less than a
second later.

## Measured numbers

| | 01 | 02 | 03 | Rule of thumb |
|---|---|---|---|---|
| Frame | 360×638, 30 fps | same | same | render 1080×1920, 30 fps |
| Length | 40.2 s | 35.4 s | 46.0 s | 35–46 s |
| Narration | 109 words | 102 words | 130 words | 100–130 words |
| Speaking rate | 2.77 words/s | 2.96 | 2.86 | ~2.9 words/s (≈170 wpm) |
| First word | 0.00 s | 0.00 s | 0.00 s | no intro, no title card |
| Last word → end | 0.8 s | 0.9 s | 0.6 s | end < 1 s after the last word |
| Longest pause | 0.46 s | 0.58 s | 0.56 s | never more than ~0.6 s |
| Caption chunks | 45, median 0.87 s | 37, median 1.00 s | 51, median 0.80 s | a new chunk ≈ every 0.9 s |
| Hard cuts | 14 | 10 | 20 | most changes are camera moves, not cuts |
| Loudness | −10.9 LUFS | −11.9 LUFS | −11.4 LUFS | very loud master, loudness range ≈ 2 LU |
| Bed vs. voice (in pauses) | −4.7 dB | −9.3 dB | −4.2 dB | music/SFX bed mixed hot |

How these were measured: word timings with faster-whisper (`small.en`), caption changes from the white
outlined text in the caption band at 15 fps, cuts from spikes in ffmpeg's per-frame scene score, loudness with
ffmpeg `ebur128`.

## Narration

- One off-screen narrator for the whole video (measured pitch mostly 90–180 Hz, a male register). Characters
  have no lines; they react.
- Plain, concrete words. Sentences chain with *and, but, then, now, eventually, suddenly*, plus explainer
  pivots like "You see," and "The problem is,".
- Tense sets the tone: habitual "They would…" makes an invented thing sound like a real tradition (01); past
  tense for a true story (02); present tense for a parable (03).
- The last sentence is short and declarative: the punchline (01), the gut-punch (02), the moral (03).

## Story shapes

- **A. Absurd process (01):** the setup shown as fact → how it works → a "you see" science beat with a
  cutaway → "the problem is" plus a number → a comic penalty rule → physical climax → a payoff that
  redefines what winning means.
- **B. True-story escalation (02):** crime and decision in sentence one → an authority agrees → what they
  expected (thought bubble) → what actually happened (belief bubble) → the trap closes → "Suddenly" → the
  consequence → a gut-punch last line over a reaction shot.
- **C. Parable (03):** animal action → its problem → the easy way out, shown as a hypothetical → pivot to
  people at ~40 % → three or four human parallels → callback to the animal → a one-line moral over a visual
  rhyme (the baboon's fist, then a human fist).

## Picture

- **Literal illustration.** Each clause gets its own image, so the composition changes every 1–2 s.
- **The camera never stops.** Push-ins, orbits, tracking shots and fast swoops from one subject to the next
  (behind the parents, over the bench, onto the judge in ~0.3 s). Only 10–20 hard cuts per video; the rest are
  continuous moves and bubble transitions.
- **Shot mix:** mostly close-ups and macro inserts of hands and props, a wide shot only to establish a place,
  heavy depth of field.
- **Cutaways explain the mechanism:** fat globules clumping on a pale backdrop (`01/still-15.2s-science-cutaway`),
  the tree trunk cut open in cross-section around the fist (`03/still-04.2s-cross-section`), and the "what if
  it let go" alternative shown as salt pouring out (`03/still-12.6s-show-the-alternative`).
- **Numbers live inside the 3D world, not in a HUD:** chunky pink 3D text that rides beside the runner and
  counts up 76 → 98 → 103 METERS (`01/still-07.6s-live-3d-counter`), a floating "LAP 80"
  (`01/still-22.6s-3d-text-lap`), a stopwatch prop reading 29:54 (`01/still-18.6s-stat-as-prop`).
- **Thought bubbles** hold a live 3D scene: an imagined outcome (`02/still-04.3s-thought-bubble`), a mistaken
  belief (`02/still-17.2s-belief-bubble`), a memory (`03/still-30.6s-memory-cloud`). They pop open beside a
  head and grow. In 02 a bubble expands to fill the frame and becomes the next scene; in 03 the memory cloud
  swells over a family dinner until it fills the frame while the family disappears. Two styles: a misty white
  oval with trailing dots (02) and a cartoon cloud with a thick white rim (03).
- **Look:** semi-realistic 3D people (stylised realism, game-cinematic quality) with expressive faces; natural
  daylight and saturated blue skies; clean, simple sets. Dark story turns switch to low-key purple-blue light.
- **Violence is implied:** the wind-up (a raised fist), then the aftermath, never the impact
  (`02/still-24.4s-implied-violence`).
- **Branding lives in the world:** the creator's name is printed on characters' t-shirts and painted on the
  tree trunk (`03/still-38.3s-callback-branding`), never as an overlay. For ours, put our own name on props
  the same way.

## Captions

Measured on the 360 px frames; multiply by 3 for 1080×1920.

- One line, centred. The line's centre sits at 78–79 % of the frame height, clear of TikTok's bottom UI.
- White bold sans-serif, sentence case, thin dark outline plus a soft shadow.
- Text height (ascender to descender) ≈ 3.3 % of the frame height (≈64 px at 1920). Never wider than ~70 % of
  the frame.
- 1–4 words per chunk (usually 2–3), broken at phrase boundaries and synced to the voice. A caption is on
  screen 97–99 % of the time.
- They look auto-generated (one chunk reads "lane free" where the narrator says "lane three"), so captions
  built from faster-whisper word timestamps match the look.

## Sound

- The narration sits on a continuous music and sound-effects bed that is mixed hot: in the pauses the bed is
  only 4–9 dB below the voice.
- Master: −11 to −12 LUFS integrated, loudness range ≈ 2 LU, peaks at about 0 dBFS. Our studios normalise to
  −14 LUFS, which will sound quieter next to these. To match, aim for about −12 LUFS with a −1 dBTP limiter.

## Ending

- The last line lands on the strongest image (a judge biting the toast, the parents' grief, a clenched fist),
  and the video ends 0.6–0.9 s after the last word.
- No end card, no question, no "tell us in the comments". The pop-star references had all three; this
  format has none.

## Beat sheets

Times are in seconds. Narration is paraphrased.

### 01 — butter relay (40.2 s)

| Time | Narration | Picture | Device |
|---|---|---|---|
| 0.0–4.5 | Cream gets poured into a hollow relay baton, then corked ("They would pour…"). | macro: carton pouring into a blue baton; kids at a table taking batons | cold open in the middle of the process (`still-01.6s-macro-hook`) |
| 4.7–10.1 | Each kid sprints 100 m and hands it off hard. | runner tracked from the side, pink 3D distance counting up beside her; rough handoff | live 3D counter |
| 10.4–17.1 | "You see": every stride shakes the cream until the fat clumps. | baton full of cream; microscopic fat globules gathering; a straining face | science cutaway |
| 17.4–22.9 | "The problem is" it takes almost 30 minutes, so one relay is 80 sprints. | stopwatch reading 29:54; runner passing a floating "LAP 80" | stat as a prop, 3D text |
| 23.0–29.0 | Drop the baton and the cork pops, so the team is disqualified for buttering a lane. | dropped baton, cream splashed on the track, team walking off | comic penalty rule |
| 29.0–31.8 | The runners collapse at the finish. | runners face-down on the track | physical climax |
| 32.1–39.4 | Judges slice the batons open, scoop out the butter, spread it on toast, and the best-tasting breakfast wins. | judge with a whistle cutting a baton lengthwise, spoon of butter on bread, a bite | payoff redefines winning (`still-37.8s-payoff`) |

### 02 — jail lesson (35.4 s)

| Time | Narration | Picture | Device |
|---|---|---|---|
| 0.0–5.1 | A teen steals his mother's car; his parents want him jailed to learn a lesson. | key in the ignition; high wide of the house and the car; parents in court with a bubble of the son behind bars | establishing wide, imagined-outcome bubble |
| 5.5–17.4 | The judge agrees. They expect him kept apart from adults, but guards cuff him to an assault suspect who believes the boy is a witness. | camera swoops to the judge, gavel slam; a bubble grows from the judge and becomes the prison yard; handcuffs; the bearded man; his belief in a bubble | authority beat, bubble as transition, belief bubble |
| 18.0–20.6 | They ride together in a prison van. | prisoners loaded into the van | the trap closes |
| 21.1–22.5 | "Suddenly," the man snaps. | dark van interior, purple-blue low-key light | tone shift through lighting |
| 23.1–29.6 | He attacks; by the time guards notice, the boy is nearly dead. | raised fist, then the boy lying on the van floor, guards at the doors | violence implied |
| 30.0–34.4 | The son they wanted to scare straight dies the next day. | hospital corridor, doctor, mother covering her mouth | gut-punch over a reaction shot (`still-34.6s-reaction-ending`) |

### 03 — baboon salt trap (46.0 s)

| Time | Narration | Picture | Device |
|---|---|---|---|
| 0.0–4.7 | A baboon reaches into a hole in a tree and grabs a handful of salt. | wide: tree and baboon in a red desert; trunk cut open to show the hand closing on salt | cross-section cutaway |
| 5.0–11.0 | The closed fist won't fit back out; it pulls and pulls. | arm stuck in the hole; baboon screaming and bracing against the trunk | struggle |
| 11.4–18.3 | It could escape at once by letting go, but it refuses. | the hand opens and salt pours out, then back to the gripping fist | show the alternative |
| 18.7–21.0 | People get trapped the same way. | a man at night in a city, coffee stain down his shirt, furious | pivot at 40 % |
| 21.3–26.5 | They grip anger tighter because letting go feels like losing. | close-up of a tightening fist | visual rhyme with the baboon |
| 26.5–33.0 | Waiting for revenge, their thoughts keep returning to the same person and the same pain. | lying awake; a cloud bubble replays a man walking up and knocking coffee all over him | memory bubble |
| 33.4–37.1 | Slowly their whole life revolves around it. | family dinner; the memory cloud above him swells until it fills the frame while the family vanishes from the table | the bubble takes over the picture |
| 37.2–42.7 | The baboon isn't trapped by the hole but by what it won't release. | back to the tree (name painted on the trunk), the cross-section again | callback to the opening image |
| 43.3–45.4 | And sometimes people are too. | close-up of a clenched human fist | final image rhymes with the first (`still-44.6s-final-image`) |

## How this differs from our earlier What-If packs

- No on-screen "What if…?" title, no HUD panel, no end card (the pop-star pack on `claude/funny-gates-8k40w2`
  had all three).
- Led by narration, not dialogue (the cartoon studio on `claude/zealous-ramanujan-vyot46` is dialogue-driven
  with a voiced cast).
- 35–46 s instead of 1–3 minutes.
- Semi-realistic 3D people instead of low-poly 3D or a 2D doll cartoon.

## Making the next What-If in this format

1. Write 110–125 words. The first sentence states the premise as if it's real, over a shot of it already
   happening. If the series needs the words "What if", make that the spoken first line on that shot, with no
   separate title card.
2. Pick a story shape (A, B or C) and decide the twist in the last line before writing the middle.
3. Give every clause a literal image. Plan one cutaway, one number built as 3D text or a prop, and one
   thought bubble.
4. One calm, confident narrator at ~2.9 words/s with pauses under 0.6 s. Nobody else speaks.
5. Captions: 2–3 words per chunk from word timestamps, white bold with an outline, one line at 78 % height.
6. Keep the music and SFX bed close under the voice, and master around −12 LUFS.
7. End within a second of the last word.

Tools already built on other branches that fit: Kokoro narration, faster-whisper word timings and
Remotion word captions (`claude/3d-animation-threejs-remotion-betz0y`); the procedural Three.js kit and
renderer in `whatif/` (`claude/funny-gates-8k40w2`); expressive Chatterbox voices and loudness normalisation
(`claude/zealous-ramanujan-vyot46`). The gap is the semi-realistic people: every existing kit draws low-poly or
cartoon characters, so decide at the start of the episode how to get closer to this look.
