import { useMemo } from "react";
import { random } from "remotion";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: (k: string | number) => number) => void;

/** Deterministic procedural texture drawn on a 2D canvas (seeded randomness). */
export const useCanvasTexture = (seed: string, draw: Draw, size = 1024, repeat: [number, number] = [1, 1]) =>
  useMemo(() => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    draw(ctx, size, size, (k) => random(`${seed}-${k}`));
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(...repeat);
    tex.anisotropy = 8;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

export const speckle = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rnd: (k: string | number) => number,
  n: number,
  colors: string[],
  rMax = 3,
) => {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(rnd(`c${i}`) * colors.length)];
    ctx.globalAlpha = 0.25 + rnd(`a${i}`) * 0.5;
    ctx.beginPath();
    ctx.arc(rnd(`x${i}`) * w, rnd(`y${i}`) * h, 0.5 + rnd(`r${i}`) * rMax, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const drawWood: Draw = (ctx, w, h, rnd) => {
  ctx.fillStyle = "#b9773f";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) {
    const y0 = rnd(`y${i}`) * h;
    ctx.strokeStyle = rnd(`d${i}`) > 0.5 ? "rgba(110,60,25,0.35)" : "rgba(230,170,110,0.25)";
    ctx.lineWidth = 1 + rnd(`w${i}`) * 5;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 16) {
      const y = y0 + Math.sin(x * 0.006 + i) * 10 + Math.sin(x * 0.021 + i * 3) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // plank seams
  ctx.fillStyle = "rgba(60,30,10,0.55)";
  for (let k = 0; k < 4; k++) ctx.fillRect(0, (k * h) / 4, w, 3);
};

export const drawQuilt: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#f3e9da";
  ctx.fillRect(0, 0, w, h);
  const n = 4;
  const s = w / n;
  for (let i = -1; i <= n; i++) {
    for (let j = -1; j <= n; j++) {
      const cx = i * s + (j % 2 ? s / 2 : 0);
      const cy = (j * s) / 2;
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.55);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(160,140,115,0.25)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s / 2);
      ctx.lineTo(cx + s / 2, cy);
      ctx.lineTo(cx, cy + s / 2);
      ctx.lineTo(cx - s / 2, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgba(150,125,95,0.7)";
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  for (let k = -n; k <= n * 2; k++) {
    ctx.beginPath();
    ctx.moveTo(k * s, 0);
    ctx.lineTo(k * s + h, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(k * s, 0);
    ctx.lineTo(k * s - h, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
};

export const drawStripes = (base: string, line: string): Draw => (ctx, w, h) => {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) {
    ctx.fillStyle = line;
    ctx.fillRect(x, 0, 18, h);
  }
};

export const drawRug: Draw = (ctx, w, h, rnd) => {
  ctx.fillStyle = "#b8573e";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#e9c37e";
  ctx.lineWidth = 28;
  for (let r = 120; r < w; r += 220) {
    ctx.beginPath();
    ctx.rect(w / 2 - r, h / 2 - r, r * 2, r * 2);
    ctx.stroke();
  }
  speckle(ctx, w, h, rnd, 9000, ["#7a2f22", "#d9805f", "#f0d2a0"], 2.2);
};

export const drawFur: Draw = (ctx, w, h, rnd) => {
  ctx.fillStyle = "#e3893a";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = "rgba(150,70,20,0.55)";
    ctx.lineWidth = 30 + rnd(`s${i}`) * 30;
    ctx.beginPath();
    const x0 = (i / 9) * w;
    for (let y = 0; y <= h; y += 20) ctx.lineTo(x0 + Math.sin(y * 0.01 + i) * 40, y);
    ctx.stroke();
  }
  // individual hairs
  for (let i = 0; i < 26000; i++) {
    const x = rnd(`x${i}`) * w;
    const y = rnd(`y${i}`) * h;
    ctx.strokeStyle = rnd(`c${i}`) > 0.5 ? "rgba(255,200,140,0.35)" : "rgba(120,55,15,0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y + 14);
    ctx.stroke();
  }
};

export const drawSoil: Draw = (ctx, w, h, rnd) => {
  ctx.fillStyle = "#4a3324";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, rnd, 16000, ["#2c1d13", "#6b4a33", "#8a6a4d", "#3b2a1e"], 4);
};

export const drawLeaf: Draw = (ctx, w, h, rnd) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#2f7d2b");
  g.addColorStop(0.5, "#56a83a");
  g.addColorStop(1, "#2f7d2b");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(220,255,170,0.7)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(210,250,160,0.45)";
  for (let i = 1; i < 14; i++) {
    const x = (i / 14) * w;
    ctx.beginPath();
    ctx.moveTo(x - 40, h / 2);
    ctx.quadraticCurveTo(x + 20, h * 0.3, x + 90, 0);
    ctx.moveTo(x - 40, h / 2);
    ctx.quadraticCurveTo(x + 20, h * 0.7, x + 90, h);
    ctx.stroke();
  }
  speckle(ctx, w, h, rnd, 3000, ["#1f5a1c", "#7cc35a"], 2);
};

export const drawPaint: Draw = (ctx, w, h, rnd) => {
  ctx.fillStyle = "#efe6d8";
  ctx.fillRect(0, 0, w, h);
  speckle(ctx, w, h, rnd, 6000, ["#d9cfbf", "#fbf6ee"], 2);
};
