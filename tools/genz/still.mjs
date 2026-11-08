// Render stills of any composition without re-bundling per frame.
// usage: node tools/genz/still.mjs <compId> <outDir> <frame,frame,...> [scale] [propsJson]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [id, outDir, framesArg = "0", scaleArg = "0.5", propsArg = "{}"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const inputProps = JSON.parse(propsArg);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id, inputProps, chromiumOptions: { gl: "swangle" } });
for (const frame of framesArg.split(",").map(Number)) {
  const t = Date.now();
  await renderStill({ serveUrl, composition, frame, inputProps, output: `${outDir}/${id}-${frame}.png`, scale: Number(scaleArg), chromiumOptions: { gl: "swangle" } });
  console.log(`${id} @${frame}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
