import { Easing, interpolate } from "remotion";
import timelineJson from "./timeline.json";
import scriptJson from "./script.json";

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type V3 = [number, number, number];

export const C = {
  ink: "#15110D",
  cream: "#FFF3DF",
  lime: "#D7FF3A",
  amber: "#FFB547",
  coral: "#FF6B4A",
  display: '"Bricolage Grotesque", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
};

export type Word = { text: string; startMs: number; endMs: number; timestampMs: number; confidence: number };
export type BeatTiming = { id: string; voiceStartMs: number; voiceEndMs: number; startMs: number; endMs: number };
export type BeatScript = { id: string; clock: string; stat: [string, string]; text: string };

export const timeline = timelineJson as { totalMs: number; beats: BeatTiming[]; words: Word[]; impactsMs: number[] };
export const script = scriptJson as unknown as { title: string; beats: BeatScript[] };

export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);
export const TOTAL_FRAMES = msToFrame(timeline.totalMs);

export const beats = timeline.beats.map((b, i) => ({
  ...b,
  ...script.beats[i],
  from: msToFrame(b.startMs),
  dur: msToFrame(b.endMs) - msToFrame(b.startMs),
  voiceFrom: msToFrame(b.voiceStartMs),
}));
export type Beat = (typeof beats)[number];
export const beatById = (id: string) => beats.find((b) => b.id === id)!;

/** First frame (relative to the beat) at which `word` is spoken inside beat `id`. */
export const wordFrame = (id: string, word: string) => {
  const b = beatById(id);
  const w = timeline.words.find(
    (x) => x.startMs >= b.voiceStartMs && x.startMs <= b.voiceEndMs + 50 && x.text.toLowerCase().includes(word.toLowerCase()),
  );
  return w ? msToFrame(w.startMs) - b.from : 0;
};

export const ease = Easing.bezier(0.45, 0, 0.2, 1);

/** 0..1 progress between two frames (clamped, eased). */
export const prog = (frame: number, start: number, end: number, e: (t: number) => number = ease) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixV = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** Smooth path through several keyframes, t in 0..1. */
export const path = (pts: V3[], t: number): V3 => {
  const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
  const local = t * (pts.length - 1) - seg;
  const s = local * local * (3 - 2 * local);
  return mixV(pts[seg], pts[seg + 1], s);
};
