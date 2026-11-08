import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import type { Expr } from "./Person";

/** Face decal canvas size (maps onto the front 110° of the cylinder head, straight section only). */
export const FACE_W = 512;
export const FACE_H = 300;

export type FaceKey = {
  skin: string;
  brow: string;
  expr: Expr;
  blink: boolean;
  mouth: 0 | 1 | 2 | 3; // lip-sync openness
  beard?: "mustache" | "full" | "stubble";
  beardColor?: string;
  kid?: boolean;
};

const cache = new Map<string, Texture>();

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * k)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * k)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * k)));
  return `rgb(${r},${g},${b})`;
};

/** Classic blocky-avatar face, drawn flat: big glossy eyes, chunky brows, expressive mouth. */
export const faceTexture = (f: FaceKey): Texture => {
  const key = JSON.stringify(f);
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = FACE_W;
  c.height = FACE_H;
  const g = c.getContext("2d")!;
  g.fillStyle = f.skin;
  g.fillRect(0, 0, FACE_W, FACE_H);
  g.lineCap = "round";
  g.lineJoin = "round";

  const cx = FACE_W / 2;
  const ex = 72; // eye offset from centre
  const ey = 128; // eye centre (≈ +0.015 m on the head)
  const ink = "#1a1210";

  // blush
  g.fillStyle = "rgba(255,105,125,0.32)";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 128, ey + 62, 34, 18, 0, 0, Math.PI * 2);
    g.fill();
  }

  // ---- eyes
  const eye = (s: number) => {
    const x = cx + s * ex;
    if (f.blink || f.expr === "laugh") {
      g.strokeStyle = ink;
      g.lineWidth = 13;
      g.beginPath();
      if (f.expr === "laugh") g.arc(x, ey + 14, 26, Math.PI * 1.15, Math.PI * 1.85); // ^ ^
      else g.arc(x, ey - 6, 26, Math.PI * 0.15, Math.PI * 0.85); // closed
      g.stroke();
      return;
    }
    if (f.expr === "shock") {
      g.fillStyle = "#ffffff";
      g.strokeStyle = ink;
      g.lineWidth = 8;
      g.beginPath();
      g.ellipse(x, ey, 36, 42, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = ink;
      g.beginPath();
      g.arc(x, ey + 4, 13, 0, Math.PI * 2);
      g.fill();
      return;
    }
    const rx = 25;
    const ry = f.expr === "happy" ? 30 : 36;
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    // glints
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x + 8, ey - 13, 9, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(x - 9, ey + 12, 4.5, 0, Math.PI * 2);
    g.fill();
    // lids for smug / sad / happy squint
    if (f.expr === "smug" || f.expr === "sad") {
      g.fillStyle = f.skin;
      g.fillRect(x - rx - 4, ey - ry - 4, rx * 2 + 8, f.expr === "smug" ? ry : ry * 0.7);
      g.strokeStyle = ink;
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(x - rx - 2, ey - ry + (f.expr === "smug" ? ry : ry * 0.7) - 2);
      g.lineTo(x + rx + 2, ey - ry + (f.expr === "smug" ? ry : ry * 0.7) - 2 + (f.expr === "sad" ? -s * 6 : 0));
      g.stroke();
    }
    if (f.expr === "happy") {
      g.fillStyle = f.skin;
      g.beginPath();
      g.ellipse(x, ey + ry + 6, rx + 6, 16, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  eye(-1);
  eye(1);

  // ---- brows (chunky, angled per emotion)
  const browAng: Record<Expr, number> = { neutral: 0, happy: -0.12, laugh: -0.15, shock: -0.1, worried: 0.38, smug: -0.2, angry: -0.45, sad: 0.42 };
  const browLift: Record<Expr, number> = { neutral: 0, happy: -4, laugh: -6, shock: -16, worried: -6, smug: 2, angry: 6, sad: -4 };
  g.strokeStyle = f.brow;
  g.lineWidth = f.kid ? 11 : 14;
  for (const s of [-1, 1]) {
    const a = browAng[f.expr] * -s + (f.expr === "smug" && s > 0 ? 0.35 : 0);
    const x = cx + s * ex;
    const y = ey - 56 + browLift[f.expr] + (f.expr === "smug" && s > 0 ? -10 : 0);
    g.beginPath();
    g.moveTo(x - Math.cos(a) * 28, y - Math.sin(a) * 28 * s);
    g.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28 * s);
    g.stroke();
  }

  // ---- beard (under the mouth)
  const my = 232;
  if (f.beard === "full") {
    g.fillStyle = f.beardColor ?? f.brow;
    g.beginPath();
    g.moveTo(cx - 150, 175);
    g.quadraticCurveTo(cx - 140, FACE_H + 30, cx, FACE_H + 10);
    g.quadraticCurveTo(cx + 140, FACE_H + 30, cx + 150, 175);
    g.quadraticCurveTo(cx, 220, cx - 150, 175);
    g.fill();
  } else if (f.beard === "stubble") {
    g.fillStyle = "rgba(40,25,15,0.18)";
    g.fillRect(cx - 120, 200, 240, 100);
  }

  // ---- mouth
  const open = f.expr === "shock" ? 3 : f.mouth;
  g.strokeStyle = shade(f.skin, 0.35);
  g.fillStyle = "#4a1418";
  if (open > 0) {
    const w = f.expr === "laugh" || f.expr === "happy" ? 54 : 40 + open * 4;
    const h = [0, 12, 24, 36][open] + (f.expr === "laugh" ? 6 : 0);
    g.beginPath();
    if (f.expr === "shock") g.ellipse(cx, my - 4, 24, 30, 0, 0, Math.PI * 2);
    else {
      g.moveTo(cx - w, my - 10);
      g.quadraticCurveTo(cx, my - 18, cx + w, my - 10);
      g.quadraticCurveTo(cx + w * 0.8, my - 10 + h * 1.6, cx, my - 10 + h * 1.6);
      g.quadraticCurveTo(cx - w * 0.8, my - 10 + h * 1.6, cx - w, my - 10);
    }
    g.fill();
    if (open >= 2 && f.expr !== "shock") {
      g.fillStyle = "#ffffff";
      g.fillRect(cx - w * 0.7, my - 13, w * 1.4, 9);
      g.fillStyle = "#e5606f";
      g.beginPath();
      g.ellipse(cx, my - 10 + h * 1.25, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.lineWidth = 11;
    g.strokeStyle = "#4a1418";
    g.beginPath();
    if (f.expr === "happy" || f.expr === "neutral") g.arc(cx, my - 40, 46, Math.PI * 0.22, Math.PI * 0.78);
    else if (f.expr === "smug") {
      g.moveTo(cx - 34, my - 4);
      g.quadraticCurveTo(cx + 10, my + 4, cx + 44, my - 18);
    } else if (f.expr === "worried") {
      g.moveTo(cx - 40, my);
      g.bezierCurveTo(cx - 20, my - 14, cx + 0, my + 14, cx + 20, my);
      g.quadraticCurveTo(cx + 30, my - 8, cx + 40, my);
    } else if (f.expr === "angry") {
      g.moveTo(cx - 40, my + 4);
      g.lineTo(cx + 40, my + 4);
    } else g.arc(cx, my + 34, 40, Math.PI * 1.25, Math.PI * 1.75); // sad frown
    g.stroke();
  }

  if (f.beard === "mustache") {
    g.fillStyle = f.beardColor ?? f.brow;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * 30, my - 30, 34, 13, s * 0.25, 0, Math.PI * 2);
      g.fill();
    }
  }

  // ---- extras: sweat drop / tear
  if (f.expr === "worried" || f.expr === "shock") {
    g.fillStyle = "#8fd8ff";
    g.beginPath();
    const sx = cx + 170;
    g.moveTo(sx, 40);
    g.quadraticCurveTo(sx + 22, 86, sx, 96);
    g.quadraticCurveTo(sx - 22, 86, sx, 40);
    g.fill();
  }
  if (f.expr === "sad") {
    g.fillStyle = "#8fd8ff";
    g.beginPath();
    g.ellipse(cx - ex + 10, ey + 52, 8, 14, 0, 0, Math.PI * 2);
    g.fill();
  }

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
};
