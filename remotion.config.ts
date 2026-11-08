import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// WebGL (Three.js) needs a GPU-capable OpenGL backend in headless Chrome.
// "angle" works on most machines; use "swangle" on servers without a GPU.
Config.setChromiumOpenGlRenderer("angle");
// Three.js scenes render frames in parallel – keep concurrency modest to avoid GPU context loss.
Config.setConcurrency(1);
