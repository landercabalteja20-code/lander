import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { random } from "remotion";

export type Pattern =
  | { kind: "solid" }
  | { kind: "stripes"; colors: string[]; width?: number; vertical?: boolean }
  | { kind: "checks"; colors: string[] }
  | { kind: "floral"; colors: string[] }
  | { kind: "embroidery"; colors: string[] }
  | { kind: "denim"; colors: string[]; rips?: boolean }
  | { kind: "weave"; colors: string[] }
  | { kind: "print"; colors: string[]; text: string };

const cache = new Map<string, Texture>();

/** Cached procedural fabric textures. */
export const fabric = (base: string, p: Pattern | undefined, repeat: [number, number] = [1, 1]): Texture | null => {
  if (!p || p.kind === "solid") return null;
  const key = JSON.stringify([base, p, repeat]);
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const r = (k: string | number) => random(`${key}-${k}`);
  if (p.kind === "stripes") {
    const w = p.width ?? 32;
    p.colors.forEach((col, i) => {
      g.fillStyle = col;
      for (let x = i * w * 0.5; x < size; x += w * p.colors.length * 0.5 + w) {
        if (p.vertical) g.fillRect(x, 0, w * 0.5, size);
        else g.fillRect(0, x, size, w * 0.5);
      }
    });
  } else if (p.kind === "checks") {
    g.globalAlpha = 0.55;
    p.colors.forEach((col, i) => {
      g.fillStyle = col;
      for (let x = i * 16; x < size; x += 64) {
        g.fillRect(x, 0, 24, size);
        g.fillRect(0, x, size, 24);
      }
    });
    g.globalAlpha = 1;
  } else if (p.kind === "floral") {
    for (let i = 0; i < 26; i++) {
      const x = r(`x${i}`) * size;
      const y = r(`y${i}`) * size;
      const col = p.colors[i % p.colors.length];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.fillStyle = col;
        g.beginPath();
        g.arc(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#fff3b0";
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
    }
  } else if (p.kind === "embroidery") {
    g.strokeStyle = p.colors[0];
    g.lineWidth = 2;
    for (let y = 20; y < size; y += 40) {
      g.beginPath();
      for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin(x * 0.12) * 6);
      g.stroke();
      for (let x = 10; x < size; x += 32) {
        g.beginPath();
        g.arc(x, y + 20, 5, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else if (p.kind === "denim") {
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = r(`d${i}`) > 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,40,0.12)";
      g.fillRect(r(`x${i}`) * size, r(`y${i}`) * size, 6, 1);
    }
    if (p.rips) {
      for (let i = 0; i < 5; i++) {
        const y = 40 + i * 44 + r(`ry${i}`) * 10;
        const x = r(`rx${i}`) * 140;
        g.fillStyle = "#f2efe6";
        g.fillRect(x, y, 70 + r(`rw${i}`) * 50, 7);
        g.fillStyle = "rgba(255,255,255,0.8)";
        for (let k = 0; k < 6; k++) g.fillRect(x + k * 14, y - 3, 2, 13);
      }
    }
  } else if (p.kind === "weave") {
    for (let y = 0; y < size; y += 16)
      for (let x = 0; x < size; x += 16) {
        g.fillStyle = (x + y) % 32 ? p.colors[0] : p.colors[1] ?? base;
        g.fillRect(x + 1, y + 1, 14, 14);
      }
  } else if (p.kind === "print") {
    g.fillStyle = p.colors[0];
    g.font = "bold 46px sans-serif";
    g.textAlign = "center";
    p.text.split("\n").forEach((line, i) => g.fillText(line, size / 2, 110 + i * 52));
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(...repeat);
  cache.set(key, tex);
  return tex;
};
