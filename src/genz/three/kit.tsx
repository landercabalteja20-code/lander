import { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { random } from "remotion";
import { BackSide, CanvasTexture, RepeatWrapping, SRGBColorSpace, type PerspectiveCamera, type Texture } from "three";

export type V3 = [number, number, number];
export const W = 1080;
export const H = 1920;

/* ------------------------------------------------------------------ camera + stage */
export const Cam: React.FC<{ position: V3; target: V3; fov?: number; roll?: number }> = ({ position, target, fov = 40, roll = 0 }) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(...target);
    camera.fov = fov;
    camera.near = 0.03;
    camera.far = 2000;
    camera.updateProjectionMatrix();
  });
  return null;
};

export const Stage: React.FC<{
  bg: string;
  fog?: [string, number, number];
  sun?: { position: V3; intensity?: number; color?: string; shadow?: number; target?: V3 };
  hemi?: [string, string, number];
  rim?: { position: V3; color: string; intensity: number };
  ambient?: number;
  exposure?: number;
  children: React.ReactNode;
}> = ({ bg, fog, sun, hemi = ["#fff3dc", "#6b4f3a", 0.9], rim, ambient = 0.12, exposure = 1.0, children }) => {
  const s = sun?.shadow ?? 0;
  return (
    <ThreeCanvas width={W} height={H} shadows={s > 0} gl={{ antialias: true, toneMappingExposure: exposure }} dpr={1}>
      <color attach="background" args={[bg]} />
      {fog ? <fog attach="fog" args={fog} /> : null}
      <hemisphereLight args={hemi} />
      <ambientLight intensity={ambient} />
      {sun ? (
        <directionalLight
          position={sun.position}
          intensity={sun.intensity ?? 2.6}
          color={sun.color ?? "#ffe2b0"}
          castShadow={s > 0}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-s}
          shadow-camera-right={s}
          shadow-camera-top={s}
          shadow-camera-bottom={-s}
          shadow-camera-near={0.5}
          shadow-camera-far={Math.hypot(...sun.position) * 2.5}
          shadow-bias={-0.0003}
          shadow-normalBias={0.03}
        />
      ) : null}
      {rim ? <directionalLight position={rim.position} color={rim.color} intensity={rim.intensity} /> : null}
      {children}
    </ThreeCanvas>
  );
};

/* ------------------------------------------------------------------ canvas textures */
type Draw = (g: CanvasRenderingContext2D, w: number, h: number, r: (k: string | number) => number) => void;
const texCache = new Map<string, Texture>();
export const tex = (key: string, draw: Draw, size = 512, repeat: [number, number] = [1, 1], w = size, h = size): Texture => {
  const k = `${key}|${repeat.join(",")}|${w}x${h}`;
  const hit = texCache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g, w, h, (x) => random(`${key}-${x}`));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  texCache.set(k, t);
  return t;
};
export const useTex = (key: string, draw: Draw, size = 512, repeat: [number, number] = [1, 1], w = size, h = size) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => tex(key, draw, size, repeat, w, h), [key]);

export const speckle = (g: CanvasRenderingContext2D, w: number, h: number, r: (k: string | number) => number, n: number, cols: string[], rMax = 3, a = 0.5) => {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = a * (0.4 + r(`a${i}`) * 0.6);
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(r(`x${i}`) * w, r(`y${i}`) * h, 0.6 + r(`r${i}`) * rMax, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
};

export const drawPlaza: Draw = (g, w, h, r) => {
  g.fillStyle = "#cfae7f";
  g.fillRect(0, 0, w, h);
  speckle(g, w, h, r, 2500, ["#b8915f", "#e0c49a", "#a67c4e"], 5, 0.5);
  for (let i = 0; i < 220; i++) {
    const x = r(`cx${i}`) * w;
    const y = r(`cy${i}`) * h;
    g.fillStyle = ["#a99a86", "#bcae98", "#958671"][i % 3];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(x, y, 10 + r(`cw${i}`) * 12, 7 + r(`ch${i}`) * 8, r(`ca${i}`) * 3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(80,60,40,0.4)";
    g.lineWidth = 2;
    g.stroke();
  }
  g.globalAlpha = 1;
};

export const drawStone: Draw = (g, w, h, r) => {
  g.fillStyle = "#cdbb98";
  g.fillRect(0, 0, w, h);
  const rows = 8;
  for (let y = 0; y < rows; y++) {
    const off = (y % 2) * 0.5;
    for (let x = -1; x < 5; x++) {
      const bx = (x + off) * (w / 4);
      const by = (y * h) / rows;
      g.fillStyle = ["#d6c4a0", "#c4b089", "#dccbaa", "#bfa985"][(x + y * 3 + 8) % 4];
      g.fillRect(bx + 2, by + 2, w / 4 - 4, h / rows - 4);
    }
  }
  speckle(g, w, h, r, 1500, ["#a8946f", "#efe3c8"], 2.5, 0.4);
};

export const drawCapiz = (wood: string): Draw => (g, w, h) => {
  g.fillStyle = wood;
  g.fillRect(0, 0, w, h);
  // planks
  g.strokeStyle = "rgba(0,0,0,0.25)";
  for (let x = 0; x < w; x += 22) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  // capiz sliding windows
  const n = 3;
  const ww = w / n;
  for (let k = 0; k < n; k++) {
    const x0 = k * ww + ww * 0.1;
    const y0 = h * 0.12;
    const wd = ww * 0.8;
    const ht = h * 0.52;
    g.fillStyle = "#3b2416";
    g.fillRect(x0 - 6, y0 - 6, wd + 12, ht + 12);
    const cell = wd / 7;
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < Math.floor(ht / cell); j++) {
        const gr = g.createLinearGradient(x0 + i * cell, y0 + j * cell, x0 + (i + 1) * cell, y0 + (j + 1) * cell);
        gr.addColorStop(0, "#fff8ec");
        gr.addColorStop(1, "#e9dcc6");
        g.fillStyle = gr;
        g.fillRect(x0 + i * cell + 2, y0 + j * cell + 2, cell - 4, cell - 4);
      }
    // ventanilla with balusters
    const vy = y0 + ht + 14;
    g.fillStyle = "#2d1a10";
    g.fillRect(x0 - 6, vy, wd + 12, h * 0.2);
    g.fillStyle = "#9b6a3c";
    for (let b = 0; b < 9; b++) g.fillRect(x0 + (b * wd) / 9 + 4, vy + 6, 8, h * 0.2 - 12);
  }
};

export const drawTiles: Draw = (g, w, h) => {
  g.fillStyle = "#b65a3c";
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) {
    for (let x = (y / 26) % 2 ? 0 : 20; x < w; x += 40) {
      const gr = g.createLinearGradient(x, y, x, y + 26);
      gr.addColorStop(0, "#d27a52");
      gr.addColorStop(1, "#8f4029");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x + 20, y + 13, 18, 13, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
};

export const drawThatch: Draw = (g, w, h, r) => {
  g.fillStyle = "#b8935a";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = r(`x${i}`) * w;
    const y = r(`y${i}`) * h;
    g.strokeStyle = ["#d9b878", "#8e6a3a", "#c9a466", "#a27c45"][i % 4];
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 3, y + 26);
    g.stroke();
  }
  g.strokeStyle = "rgba(60,40,20,0.5)";
  g.lineWidth = 4;
  for (let y = 0; y < h; y += 42) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
};

export const drawSawali: Draw = (g, w, h) => {
  g.fillStyle = "#d8b97c";
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16)
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16 + y / 16) % 2 ? "#e6cc93" : "#b8965a";
      g.fillRect(x, y, (x / 16 + y / 16) % 2 ? 16 : 8, 16);
    }
};

export const drawWood: Draw = (g, w, h, r) => {
  g.fillStyle = "#7a4428";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.strokeStyle = r(`d${i}`) > 0.5 ? "rgba(60,25,10,0.35)" : "rgba(170,100,60,0.25)";
    g.lineWidth = 1 + r(`w${i}`) * 4;
    const y0 = r(`y${i}`) * h;
    g.beginPath();
    for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.01 + i) * 6);
    g.stroke();
  }
  g.fillStyle = "rgba(30,12,5,0.6)";
  for (let k = 0; k < 6; k++) g.fillRect(0, (k * h) / 6, w, 3);
};

export const drawGrass: Draw = (g, w, h, r) => {
  g.fillStyle = "#5f9a3c";
  g.fillRect(0, 0, w, h);
  speckle(g, w, h, r, 5000, ["#7cb84f", "#4a7f2c", "#8ccf5a", "#3c6a24"], 3, 0.6);
};

/* ------------------------------------------------------------------ sky */
export const Sky: React.FC<{ top: string; mid: string; horizon: string; sun?: { dir: V3; color: string; size?: number }; stars?: boolean }> = ({ top, mid, horizon, sun, stars }) => {
  const t = useMemo(
    () =>
      tex(`sky-${top}-${mid}-${horizon}-${stars}`, (g, w, h, r) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, top);
        gr.addColorStop(0.42, mid);
        gr.addColorStop(0.5, horizon);
        gr.addColorStop(1, horizon);
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        if (stars) speckle(g, w, h * 0.45, r, 900, ["#ffffff", "#ffeebb", "#cfe3ff"], 1.4, 0.9);
      }, 512, [1, 1], 64, 512),
    [top, mid, horizon, stars],
  );
  return (
    <group>
      <mesh>
        <sphereGeometry args={[900, 32, 16]} />
        <meshBasicMaterial map={t} side={BackSide} fog={false} />
      </mesh>
      {sun ? (
        <mesh position={sun.dir.map((v) => v * 800) as V3}>
          <sphereGeometry args={[sun.size ?? 40, 24, 16]} />
          <meshBasicMaterial color={sun.color} fog={false} />
        </mesh>
      ) : null}
    </group>
  );
};

export const Clouds: React.FC<{ seed: string; n?: number; y?: number; spread?: number; t: number; color?: string }> = ({ seed, n = 8, y = 120, spread = 500, t, color = "#ffffff" }) => (
  <group>
    {Array.from({ length: n }).map((_, i) => {
      const r = (k: string) => random(`${seed}-${i}-${k}`);
      const x = (r("x") - 0.5) * spread + t * 0.8;
      const z = -150 - r("z") * 350;
      const s = 14 + r("s") * 22;
      return (
        <group key={i} position={[x, y + r("y") * 60, z]} scale={s}>
          {[0, 1, 2, 3, 4].map((k) => (
            <mesh key={k} position={[(k - 2) * 0.75, Math.sin(k * 1.7) * 0.25 + (k === 2 ? 0.35 : 0), Math.cos(k * 2.1) * 0.3]} scale={[1, 0.75, 0.8]}>
              <sphereGeometry args={[0.8 + (k === 2 ? 0.35 : 0), 14, 10]} />
              <meshStandardMaterial color={color} roughness={1} emissive={color} emissiveIntensity={0.35} fog={false} />
            </mesh>
          ))}
        </group>
      );
    })}
  </group>
);
