// Render preview stills (one per beat, or explicit frames) without re-bundling each time.
// usage: node tools/ants/preview.mjs <outDir> [frame,frame,...] [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [outDir = "out/preview", framesArg, scaleArg = "0.4"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const tl = JSON.parse(readFileSync("src/ants/timeline.json", "utf8"));
const f = (ms) => Math.round((ms / 1000) * 30);
const frames = framesArg
  ? framesArg.split(",").map((x) => ({ id: `f${x}`, frame: Number(x) }))
  : tl.beats.map((b) => ({ id: b.id, frame: Math.round((f(b.startMs) + f(b.endMs)) / 2) }));

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const inputProps = { withAudio: false };
const composition = await selectComposition({ serveUrl, id: "WhatIfAnts", inputProps, chromiumOptions: { gl: "swangle" } });
for (const { id, frame } of frames) {
  const t = Date.now();
  await renderStill({ serveUrl, composition, frame, inputProps, output: `${outDir}/${id}.png`, scale: Number(scaleArg), chromiumOptions: { gl: "swangle" } });
  console.log(`${id} @${frame}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
