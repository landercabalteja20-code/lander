import { Easing, interpolate } from "remotion";
import timelineJson from "./timeline.json";
import scriptJson from "./script.json";

export const FPS = 30;
export type V3 = [number, number, number];

export const C = {
  ink: "#14110F",
  cream: "#FFF3DF",
  lime: "#D7FF3A",
  pink: "#FF4FA3",
  purple: "#8E5CFF",
  gold: "#FFC94A",
  display: '"Bricolage Grotesque", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  serif: '"Playfair Display", Georgia, serif',
};

export type Word = { text: string; startMs: number; endMs: number };
type RawLine = { i: number; scene: string; speaker: string; voiceStartMs: number; voiceEndMs: number; words: Word[]; mouth: string };
type RawScene = { id: string; startMs: number; endMs: number };
type ScriptLine = { scene: string; speaker: string; text: string; translation?: string };
type SceneInfo = { year: string; place: string; battery: number; odds: number };

const tl = timelineJson as unknown as { totalMs: number; scenes: RawScene[]; lines: RawLine[]; pingMs: number };
const sc = scriptJson as unknown as { names: Record<string, string>; lines: ScriptLine[]; scenes: Record<string, SceneInfo> };

export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);
export const TOTAL_FRAMES = msToFrame(tl.totalMs);
export const PING_FRAME = msToFrame(tl.pingMs);
export const NAMES = sc.names;

export const lines = tl.lines.map((l) => ({
  ...l,
  ...sc.lines[l.i],
  from: msToFrame(l.voiceStartMs),
  to: msToFrame(l.voiceEndMs),
}));
export type Line = (typeof lines)[number];

export const scenes = tl.scenes.map((s) => ({
  ...s,
  ...sc.scenes[s.id],
  from: msToFrame(s.startMs),
  dur: msToFrame(s.endMs) - msToFrame(s.startMs),
  lines: lines.filter((l) => l.scene === s.id),
}));
export type Scene = (typeof scenes)[number];
export const sceneById = (id: string) => scenes.find((s) => s.id === id)!;

/** Mouth openness 0..1 for `speaker` at absolute frame `f` (lip-sync from the voice track). */
export const mouthAt = (speaker: string, f: number) => {
  const l = lines.find((x) => x.speaker === speaker && f >= x.from && f < x.from + x.mouth.length);
  if (!l) return 0;
  return Number(l.mouth[f - l.from]) / 9;
};

/** Is `speaker` currently talking (absolute frame)? */
export const talking = (speaker: string, f: number) => lines.some((x) => x.speaker === speaker && f >= x.from - 2 && f <= x.to + 2);

/** Scene-local shot index: which line of this scene is current (0-based, -1 before the first). */
export const shotIndex = (s: Scene, local: number) => {
  let k = 0;
  s.lines.forEach((l, i) => {
    if (s.from + local >= l.from - 4) k = i;
  });
  return k;
};
export const lineLocal = (s: Scene, i: number) => (s.lines[i] ? s.lines[i].from - s.from : 0);
export const wordLocal = (s: Scene, word: string) => {
  for (const l of s.lines) {
    const w = l.words.find((x) => x.text.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "").includes(word.toLowerCase()));
    if (w) return msToFrame(w.startMs) - s.from;
  }
  return 0;
};

export const ease = Easing.bezier(0.45, 0, 0.2, 1);
export const prog = (f: number, a: number, b: number, e: (t: number) => number = ease) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixV = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
export const path = (pts: V3[], t: number): V3 => {
  const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
  const u = t * (pts.length - 1) - seg;
  return mixV(pts[seg], pts[seg + 1], u * u * (3 - 2 * u));
};
