import { useMemo } from "react";
import { random } from "remotion";
import { DoubleSide, LatheGeometry, Vector2 } from "three";
import { drawCapiz, drawSawali, drawStone, drawThatch, drawTiles, useTex, type V3 } from "./kit";

const Std: React.FC<{ c: string; r?: number; m?: number; e?: number; side?: boolean }> = ({ c, r = 0.8, m = 0, e = 0, side }) => (
  <meshStandardMaterial color={c} roughness={r} metalness={m} emissive={c} emissiveIntensity={e} side={side ? DoubleSide : undefined} />
);

/* ------------------------------------------------------------------ bahay na bato */
export const BahayNaBato: React.FC<{ position?: V3; rotation?: number; w?: number; d?: number; wall?: string; wood?: string; seed: string; lit?: boolean }> = ({
  position = [0, 0, 0],
  rotation = 0,
  w = 8,
  d = 7,
  wall = "#e9dcc0",
  wood = "#6b3f24",
  seed,
  lit,
}) => {
  const stone = useTex(`stone-${wall}`, (g, ww, hh, r) => {
    drawStone(g, ww, hh, r);
    g.fillStyle = wall;
    g.globalAlpha = 0.55;
    g.fillRect(0, 0, ww, hh);
    g.globalAlpha = 1;
  }, 256, [w / 3, 1.2]);
  const capiz = useTex(`capiz-${wood}-${lit}`, (g, ww, hh, r) => {
    drawCapiz(wood)(g, ww, hh, r);
    if (lit) {
      g.globalCompositeOperation = "multiply";
      g.fillStyle = "#ffb347";
      g.fillRect(0, 0, ww, hh * 0.66);
      g.globalCompositeOperation = "source-over";
    }
  }, 512, [Math.max(1, Math.round(w / 4)), 1]);
  const tiles = useTex("tiles", drawTiles, 256, [w / 2, 3]);
  const h1 = 3.2;
  const h2 = 3.0;
  const pot = random(`${seed}-pot`) > 0.4;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, h1 / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h1, d]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      {/* arched zaguan door */}
      <group position={[0, 0, d / 2 + 0.02]}>
        <mesh position={[0, 1.1, 0]}>
          <planeGeometry args={[1.8, 2.2]} />
          <Std c="#3a2214" r={0.6} />
        </mesh>
        <mesh position={[0, 2.2, 0]}>
          <circleGeometry args={[0.9, 20, 0, Math.PI]} />
          <Std c="#3a2214" r={0.6} />
        </mesh>
        <mesh position={[0, 2.2, 0.03]}>
          <torusGeometry args={[0.98, 0.09, 6, 20, Math.PI]} />
          <Std c="#d9c49c" r={0.9} />
        </mesh>
      </group>
      {/* upper floor (volada), overhanging */}
      <mesh position={[0, h1 + h2 / 2, 0.25]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.5, h2, d + 0.5]} />
        <meshStandardMaterial map={capiz} roughness={0.7} emissive={lit ? "#ff9a3c" : "#000000"} emissiveIntensity={lit ? 0.35 : 0} emissiveMap={lit ? capiz : null} />
      </mesh>
      <mesh position={[0, h1 + 0.08, 0.25]}>
        <boxGeometry args={[w + 0.7, 0.16, d + 0.7]} />
        <Std c={wood} r={0.7} />
      </mesh>
      {/* hip roof with terracotta tiles */}
      <mesh position={[0, h1 + h2 + 1.1, 0.25]} rotation={[0, Math.PI / 4, 0]} scale={[(w + 1.6) / 1.414, 1, (d + 1.6) / 1.414]} castShadow>
        <coneGeometry args={[1, 2.2, 4, 1]} />
        <meshStandardMaterial map={tiles} roughness={0.8} />
      </mesh>
      {/* hanging plants + lantern */}
      {pot ? (
        <group position={[w / 2 - 0.6, h1 - 0.5, d / 2 + 0.4]}>
          <mesh>
            <cylinderGeometry args={[0.25, 0.18, 0.3, 12]} />
            <Std c="#b5543a" />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <sphereGeometry args={[0.35, 10, 8]} />
            <Std c="#3f8f3a" />
          </mesh>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[(k - 1) * 0.2, 0.45, 0.15]}>
              <sphereGeometry args={[0.07, 8, 6]} />
              <Std c={["#ff4f7b", "#ffd23f", "#ff7b2e"][k]} e={0.1} />
            </mesh>
          ))}
        </group>
      ) : null}
      <Farol position={[-w / 2 + 0.7, h1 - 0.4, d / 2 + 0.5]} lit={lit} />
    </group>
  );
};

export const Farol: React.FC<{ position: V3; lit?: boolean; color?: string }> = ({ position, lit, color = "#ffd27a" }) => (
  <group position={position}>
    <mesh>
      <cylinderGeometry args={[0.01, 0.01, 0.4, 4]} />
      <Std c="#222" />
    </mesh>
    <mesh position={[0, -0.35, 0]}>
      <cylinderGeometry args={[0.16, 0.12, 0.35, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={lit ? 1.6 : 0.15} roughness={0.5} transparent opacity={0.9} />
    </mesh>
    {lit ? <pointLight position={[0, -0.4, 0.2]} color="#ffb347" intensity={6} distance={7} /> : null}
  </group>
);

/* ------------------------------------------------------------------ Binondo church (octagonal belfry) */
export const Church: React.FC<{ position?: V3; rotation?: number; scale?: number }> = ({ position = [0, 0, 0], rotation = 0, scale = 1 }) => {
  const stone = useTex("church-stone", (g, w, h, r) => {
    drawStone(g, w, h, r);
    g.fillStyle = "#e7d2a6";
    g.globalAlpha = 0.35;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
  }, 256, [4, 4]);
  const tiers = [
    { r: 3.0, h: 5.0 },
    { r: 2.6, h: 3.6 },
    { r: 2.2, h: 3.2 },
    { r: 1.8, h: 2.8 },
    { r: 1.4, h: 2.4 },
  ];
  let y = 0;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      {/* facade */}
      <mesh position={[0, 8, 0]} castShadow receiveShadow>
        <boxGeometry args={[16, 16, 3]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 16, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, 0.45, 1]} castShadow>
        <boxGeometry args={[11.3, 11.3, 2.6]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[0, 20.8, 0]}>
        <boxGeometry args={[0.25, 2.2, 0.25]} />
        <Std c="#f2d27a" m={0.7} r={0.3} />
      </mesh>
      <mesh position={[0, 21.2, 0]}>
        <boxGeometry args={[1.2, 0.25, 0.25]} />
        <Std c="#f2d27a" m={0.7} r={0.3} />
      </mesh>
      {/* door + rose window + columns */}
      <mesh position={[0, 3, 1.52]}>
        <planeGeometry args={[3.6, 6]} />
        <Std c="#2c1a10" />
      </mesh>
      <mesh position={[0, 6, 1.52]}>
        <circleGeometry args={[1.8, 24, 0, Math.PI]} />
        <Std c="#2c1a10" />
      </mesh>
      <mesh position={[0, 11.5, 1.55]}>
        <torusGeometry args={[1.6, 0.25, 8, 28]} />
        <Std c="#c9b388" />
      </mesh>
      <mesh position={[0, 11.5, 1.52]}>
        <circleGeometry args={[1.5, 28]} />
        <meshStandardMaterial color="#5b8fd6" emissive="#2b4f8f" emissiveIntensity={0.4} roughness={0.2} />
      </mesh>
      {[-6, -3.6, 3.6, 6].map((x) => (
        <mesh key={x} position={[x, 7, 1.7]} castShadow>
          <cylinderGeometry args={[0.45, 0.5, 14, 14]} />
          <Std c="#d8c6a0" r={0.9} />
        </mesh>
      ))}
      {/* octagonal bell tower */}
      <group position={[11.5, 0, -1]}>
        {tiers.map((tr, i) => {
          const yy = y;
          y += tr.h;
          return (
            <group key={i} position={[0, yy, 0]}>
              <mesh position={[0, tr.h / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[tr.r, tr.r, tr.h, 8]} />
                <meshStandardMaterial map={stone} roughness={0.95} />
              </mesh>
              <mesh position={[0, tr.h, 0]}>
                <cylinderGeometry args={[tr.r + 0.35, tr.r + 0.35, 0.3, 8]} />
                <Std c="#c9b388" />
              </mesh>
              {i > 0
                ? [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
                    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
                    return (
                      <mesh key={k} position={[Math.sin(a) * (tr.r * 0.93), tr.h * 0.5, Math.cos(a) * (tr.r * 0.93)]} rotation={[0, a, 0]}>
                        <planeGeometry args={[tr.r * 0.5, tr.h * 0.55]} />
                        <Std c="#24160d" side />
                      </mesh>
                    );
                  })
                : null}
            </group>
          );
        })}
        <mesh position={[0, y + 1.2, 0]} castShadow>
          <coneGeometry args={[1.5, 2.4, 8]} />
          <meshStandardMaterial color="#b65a3c" roughness={0.7} />
        </mesh>
        <mesh position={[0, y + 2.8, 0]}>
          <boxGeometry args={[0.15, 1.2, 0.15]} />
          <Std c="#f2d27a" m={0.7} r={0.3} />
        </mesh>
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------ plants */
export const Palm: React.FC<{ position: V3; height?: number; lean?: number; rot?: number; t: number; seed: string }> = ({ position, height = 8, lean = 0.25, rot = 0, t, seed }) => {
  const segs = 7;
  const pts: V3[] = Array.from({ length: segs + 1 }).map((_, i) => {
    const u = i / segs;
    return [Math.sin(rot) * lean * height * u * u, height * u, Math.cos(rot) * lean * height * u * u];
  });
  const top = pts[segs];
  const sway = Math.sin(t * 0.9 + random(seed) * 6) * 0.05;
  return (
    <group position={position}>
      {pts.slice(0, -1).map((p, i) => {
        const q = pts[i + 1];
        const mid: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        const dx = q[0] - p[0];
        const dz = q[2] - p[2];
        const dy = q[1] - p[1];
        const len = Math.hypot(dx, dy, dz);
        return (
          <mesh key={i} position={mid} rotation={[Math.atan2(dz, dy), 0, -Math.atan2(dx, dy)]} castShadow>
            <cylinderGeometry args={[0.2 - i * 0.012, 0.24 - i * 0.012, len + 0.05, 10]} />
            <Std c={i % 2 ? "#8a7258" : "#9c8466"} r={0.95} />
          </mesh>
        );
      })}
      <group position={top} rotation={[sway, 0, sway * 0.6]}>
        {Array.from({ length: 9 }).map((_, i) => {
          const a = (i / 9) * Math.PI * 2 + random(`${seed}${i}`) * 0.4;
          const droop = 0.35 + random(`${seed}d${i}`) * 0.35;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <group rotation={[0, 0, -droop]}>
                <mesh position={[1.4, 0, 0]} scale={[1.6, 0.04, 0.42]} castShadow>
                  <sphereGeometry args={[1, 14, 8]} />
                  <Std c={i % 3 ? "#3f8f34" : "#5aa83e"} r={0.7} side />
                </mesh>
                <group position={[2.8, 0, 0]} rotation={[0, 0, -0.55]}>
                  <mesh position={[0.9, 0, 0]} scale={[1.05, 0.035, 0.32]} castShadow>
                    <sphereGeometry args={[1, 12, 8]} />
                    <Std c={i % 3 ? "#357a2c" : "#4c9636"} r={0.7} side />
                  </mesh>
                </group>
              </group>
            </group>
          );
        })}
        {[0, 1, 2].map((k) => (
          <mesh key={k} position={[Math.cos(k * 2.1) * 0.3, -0.35, Math.sin(k * 2.1) * 0.3]} castShadow>
            <sphereGeometry args={[0.24, 12, 10]} />
            <Std c={k === 1 ? "#6e8b2a" : "#7a5a2c"} r={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export const Banana: React.FC<{ position: V3; t: number; seed: string; scale?: number }> = ({ position, t, seed, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 1.1, 0]} castShadow>
      <cylinderGeometry args={[0.16, 0.22, 2.2, 10]} />
      <Std c="#6f8f3a" />
    </mesh>
    {Array.from({ length: 6 }).map((_, i) => {
      const a = (i / 6) * Math.PI * 2 + random(`${seed}${i}`);
      const sw = Math.sin(t * 1.3 + i) * 0.05;
      return (
        <group key={i} position={[0, 2.1, 0]} rotation={[0, a, 0]}>
          <group rotation={[0, 0, -0.55 - random(`${seed}r${i}`) * 0.4 + sw]}>
            <mesh position={[1.1, 0, 0]} scale={[1.2, 0.03, 0.4]} castShadow>
              <sphereGeometry args={[1, 14, 8]} />
              <Std c={i % 2 ? "#79c043" : "#5ea836"} r={0.55} side />
            </mesh>
          </group>
        </group>
      );
    })}
  </group>
);

/* ------------------------------------------------------------------ market */
export const Lathe: React.FC<{ pts: [number, number][]; color: string; position?: V3; scale?: number; r?: number }> = ({ pts, color, position, scale = 1, r = 0.8 }) => {
  const geo = useMemo(() => new LatheGeometry(pts.map(([x, y]) => new Vector2(x, y)), 18), [pts]);
  return (
    <mesh geometry={geo} position={position} scale={scale} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={r} side={DoubleSide} />
    </mesh>
  );
};
const POT: [number, number][] = [[0.01, 0], [0.18, 0.02], [0.28, 0.12], [0.3, 0.22], [0.24, 0.32], [0.18, 0.36], [0.2, 0.4]];
const JAR: [number, number][] = [[0.01, 0], [0.2, 0.02], [0.32, 0.25], [0.34, 0.45], [0.26, 0.65], [0.14, 0.75], [0.17, 0.82]];
export const Palayok: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => <Lathe pts={POT} color="#a9512f" position={position} scale={scale} />;
export const Banga: React.FC<{ position: V3; scale?: number }> = ({ position, scale = 1 }) => <Lathe pts={JAR} color="#9c4a2c" position={position} scale={scale} />;

const PRODUCE: Record<string, { c: string; s: V3; n: number }> = {
  mango: { c: "#ffb627", s: [0.07, 0.05, 0.05], n: 9 },
  rambutan: { c: "#e0303a", s: [0.035, 0.035, 0.035], n: 16 },
  calamansi: { c: "#7cc24a", s: [0.025, 0.025, 0.025], n: 20 },
  lanzones: { c: "#e3c98a", s: [0.03, 0.03, 0.03], n: 16 },
  tomato: { c: "#ff5a36", s: [0.045, 0.04, 0.045], n: 12 },
  eggplant: { c: "#6a2c8f", s: [0.035, 0.035, 0.1], n: 7 },
  fish: { c: "#b9c6cf", s: [0.12, 0.03, 0.04], n: 6 },
  puto: { c: "#fff4e0", s: [0.04, 0.025, 0.04], n: 12 },
};

export const Bilao: React.FC<{ position: V3; item: keyof typeof PRODUCE; seed: string }> = ({ position, item, seed }) => {
  const p = PRODUCE[item];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.27, 0.04, 20]} />
        <Std c="#c9a35f" r={0.95} />
      </mesh>
      {Array.from({ length: p.n }).map((_, i) => {
        const a = random(`${seed}a${i}`) * Math.PI * 2;
        const rr = Math.sqrt(random(`${seed}r${i}`)) * 0.22;
        return (
          <mesh key={i} position={[Math.cos(a) * rr, 0.04 + p.s[1], Math.sin(a) * rr]} rotation={[0, a, 0]} scale={p.s} castShadow>
            <sphereGeometry args={[1, 10, 8]} />
            <Std c={p.c} r={0.45} e={0.08} />
          </mesh>
        );
      })}
    </group>
  );
};

export const Bananas: React.FC<{ position: V3 }> = ({ position }) => (
  <group position={position}>
    {Array.from({ length: 7 }).map((_, i) => (
      <mesh key={i} position={[(i - 3) * 0.045, 0.06, 0]} rotation={[0.3, 0, 0.9 + (i - 3) * 0.08]} castShadow>
        <torusGeometry args={[0.12, 0.022, 6, 12, Math.PI * 0.6]} />
        <Std c="#ffd43b" r={0.5} e={0.08} />
      </mesh>
    ))}
  </group>
);

export const Stall: React.FC<{ position: V3; rotation?: number; cloth?: string; cloth2?: string; seed: string; items?: (keyof typeof PRODUCE)[]; nipa?: boolean }> = ({
  position,
  rotation = 0,
  cloth = "#ff5a5f",
  cloth2 = "#fff3dc",
  seed,
  items = ["mango", "rambutan", "calamansi"],
  nipa,
}) => {
  const awning = useTex(`awning-${cloth}-${cloth2}`, (g, w, h) => {
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = (x / 32) % 2 ? cloth : cloth2;
      g.fillRect(x, 0, 32, h);
    }
  }, 256);
  const thatch = useTex("thatch", drawThatch, 512, [2, 1]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]].map(([x, z], i) => (
        <mesh key={i} position={[x, 1.2, z]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 2.4, 8]} />
          <Std c="#c9a35f" r={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.08, 1.5]} />
        <Std c="#8a5a2b" r={0.8} />
      </mesh>
      <mesh position={[0, 0.42, 0]} receiveShadow>
        <boxGeometry args={[2.5, 0.84, 1.4]} />
        <Std c="#6b4423" r={0.9} />
      </mesh>
      {nipa ? (
        <mesh position={[0, 2.75, 0]} rotation={[0, Math.PI / 4, 0]} scale={[2.3, 1, 1.5]} castShadow>
          <coneGeometry args={[1, 0.8, 4, 1]} />
          <meshStandardMaterial map={thatch} roughness={1} />
        </mesh>
      ) : (
        <mesh position={[0, 2.45, 0.1]} rotation={[-0.25, 0, 0]} castShadow>
          <boxGeometry args={[2.9, 0.04, 1.9]} />
          <meshStandardMaterial map={awning} roughness={0.8} />
        </mesh>
      )}
      {items.map((it, i) => (
        <Bilao key={i} position={[(i - (items.length - 1) / 2) * 0.75, 0.91, 0.1]} item={it} seed={`${seed}${i}`} />
      ))}
      <Bananas position={[1.0, 0.9, -0.45]} />
      <Palayok position={[-1.0, 0.89, -0.45]} scale={0.6} />
    </group>
  );
};

export const Banderitas: React.FC<{ a: V3; b: V3; n?: number; t: number; sag?: number; colors?: string[] }> = ({ a, b, n = 18, t, sag = 1.2, colors = ["#ff4f7b", "#ffd23f", "#2ec4b6", "#3d7bff", "#9b5de5", "#ff7b2e", "#d7ff3a"] }) => (
  <group>
    {Array.from({ length: n }).map((_, i) => {
      const u = (i + 0.5) / n;
      const p: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u), a[2] + (b[2] - a[2]) * u];
      const yaw = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;
      return (
        <mesh key={i} position={p} rotation={[Math.sin(t * 3 + i) * 0.25, yaw, Math.PI]}>
          <coneGeometry args={[0.22, 0.42, 3, 1]} />
          <meshStandardMaterial color={colors[i % colors.length]} emissive={colors[i % colors.length]} emissiveIntensity={0.15} side={DoubleSide} roughness={0.7} />
        </mesh>
      );
    })}
  </group>
);

/* ------------------------------------------------------------------ animals */
const Leg4: React.FC<{ p: V3; swing: number; len: number; r: number; c: string; hoof?: string }> = ({ p, swing, len, r, c, hoof = "#2a1a10" }) => (
  <group position={p} rotation={[swing, 0, 0]}>
    <mesh position={[0, -len / 2, 0]} castShadow>
      <cylinderGeometry args={[r, r * 0.8, len, 8]} />
      <Std c={c} />
    </mesh>
    <mesh position={[0, -len, 0]}>
      <cylinderGeometry args={[r * 0.85, r, 0.08, 8]} />
      <Std c={hoof} />
    </mesh>
  </group>
);

export const Horse: React.FC<{ t: number; walking?: boolean; color?: string }> = ({ t, walking = true, color = "#8b5a33" }) => {
  const ph = t * 2 * Math.PI * 1.4;
  const sw = (o: number) => (walking ? Math.sin(ph + o) * 0.4 : 0);
  const bob = walking ? Math.abs(Math.sin(ph)) * 0.03 : 0;
  return (
    <group position={[0, bob, 0]}>
      <mesh position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.9]} castShadow>
        <capsuleGeometry args={[0.38, 1.1, 6, 14]} />
        <Std c={color} r={0.55} />
      </mesh>
      <group position={[0, 1.55, 0.8]} rotation={[-0.75 + Math.sin(ph * 2) * 0.05, 0, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <capsuleGeometry args={[0.18, 0.6, 4, 10]} />
          <Std c={color} r={0.55} />
        </mesh>
        <mesh position={[0, 0.62, -0.08]} scale={[0.3, 1, 0.5]}>
          <boxGeometry args={[0.2, 0.7, 0.3]} />
          <Std c="#2a1a10" r={0.9} />
        </mesh>
        <group position={[0, 0.85, 0.05]} rotation={[1.3, 0, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.4, 4, 10]} />
            <Std c={color} r={0.55} />
          </mesh>
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * 0.1, -0.05, -0.1]} rotation={[-0.5, 0, s * 0.2]}>
              <coneGeometry args={[0.04, 0.14, 6]} />
              <Std c={color} />
            </mesh>
          ))}
          {[1, -1].map((s) => (
            <mesh key={s} position={[s * 0.12, 0.08, 0.05]}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <Std c="#0a0705" r={0.1} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh position={[0, 1.4, -0.85]} rotation={[0.6 + Math.sin(t * 3) * 0.1, 0, Math.sin(t * 2) * 0.15]}>
        <coneGeometry args={[0.1, 0.8, 8]} />
        <Std c="#2a1a10" r={0.9} />
      </mesh>
      <Leg4 p={[0.22, 1.1, 0.55]} swing={sw(0)} len={1.05} r={0.08} c={color} />
      <Leg4 p={[-0.22, 1.1, 0.55]} swing={sw(Math.PI)} len={1.05} r={0.08} c={color} />
      <Leg4 p={[0.22, 1.1, -0.55]} swing={sw(Math.PI)} len={1.05} r={0.09} c={color} />
      <Leg4 p={[-0.22, 1.1, -0.55]} swing={sw(0)} len={1.05} r={0.09} c={color} />
    </group>
  );
};

export const Calesa: React.FC<{ position: V3; rotation?: number; t: number; body?: string; walking?: boolean }> = ({ position, rotation = 0, t, body = "#c8202e", walking = true }) => {
  const wheelRot = walking ? -t * 2.2 : 0;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={[0, 0, 1.6]}>
        <Horse t={t} walking={walking} />
      </group>
      {[1, -1].map((s) => (
        <group key={s} position={[s * 0.8, 0.75, -0.3]} rotation={[wheelRot, 0, Math.PI / 2]}>
          <mesh>
            <torusGeometry args={[0.72, 0.05, 8, 28]} />
            <Std c="#f2c84b" r={0.5} />
          </mesh>
          {Array.from({ length: 8 }).map((_, k) => (
            <mesh key={k} rotation={[0, (k / 8) * Math.PI, 0]}>
              <boxGeometry args={[1.42, 0.035, 0.035]} />
              <Std c="#3a2214" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 1.25, -0.4]} castShadow>
        <boxGeometry args={[1.4, 0.7, 1.4]} />
        <Std c={body} r={0.45} />
      </mesh>
      <mesh position={[0, 1.62, -0.4]}>
        <boxGeometry args={[1.45, 0.06, 1.45]} />
        <Std c="#f2c84b" m={0.6} r={0.35} />
      </mesh>
      <mesh position={[0, 2.05, -0.55]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.75, 0.75, 1.4, 16, 1, true, 0, Math.PI]} />
        <Std c="#1d1a24" side r={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.45, 1.05, 1.0]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
          <Std c="#3a2214" />
        </mesh>
      ))}
    </group>
  );
};

export const Carabao: React.FC<{ position: V3; rotation?: number; t: number }> = ({ position, rotation = 0, t }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 1.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.15, 1, 1]} castShadow>
      <capsuleGeometry args={[0.5, 1.2, 6, 14]} />
      <Std c="#4a4743" r={0.75} />
    </mesh>
    <group position={[0, 1.0, 1.05]} rotation={[0.35 + Math.sin(t * 1.2) * 0.05, 0, 0]}>
      <mesh position={[0, 0, 0.25]} castShadow>
        <boxGeometry args={[0.5, 0.45, 0.6]} />
        <Std c="#4a4743" r={0.75} />
      </mesh>
      <mesh position={[0, -0.08, 0.58]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.36, 0.28, 0.12]} />
        <Std c="#2c2a28" r={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.4, 0.22, 0.1]} rotation={[0.2, s * 0.4, s * -0.2]}>
            <torusGeometry args={[0.45, 0.06, 8, 16, Math.PI * 0.9]} />
            <Std c="#2b2620" r={0.5} />
          </mesh>
          <mesh position={[s * 0.18, 0.07, 0.52]}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <Std c="#050403" r={0.1} />
          </mesh>
        </group>
      ))}
    </group>
    {[[0.35, 0.7], [-0.35, 0.7], [0.35, -0.7], [-0.35, -0.7]].map(([x, z], i) => (
      <Leg4 key={i} p={[x, 0.75, z]} swing={0} len={0.75} r={0.12} c="#3f3c39" />
    ))}
    <mesh position={[0, 1.05, -1.15]} rotation={[0.3 + Math.sin(t * 2.5) * 0.25, 0, Math.sin(t * 3.1) * 0.3]}>
      <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
      <Std c="#2c2a28" />
    </mesh>
  </group>
);

export const Rooster: React.FC<{ position: V3; rotation?: number; t: number; seed: string }> = ({ position, rotation = 0, t, seed }) => {
  const peck = Math.max(0, Math.sin(t * 3 + random(seed) * 6)) ** 6;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.3, 0]} scale={[0.75, 0.8, 1]} castShadow>
        <sphereGeometry args={[0.16, 14, 10]} />
        <Std c="#b5481f" r={0.5} />
      </mesh>
      <group position={[0, 0.42, 0.12]} rotation={[peck * 1.1, 0, 0]}>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.07, 12, 10]} />
          <Std c="#d9732e" r={0.5} />
        </mesh>
        <mesh position={[0, 0.16, 0.0]} scale={[0.4, 1, 1]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <Std c="#e8202e" r={0.5} />
        </mesh>
        <mesh position={[0, 0.07, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.02, 0.06, 6]} />
          <Std c="#ffc23a" />
        </mesh>
      </group>
      {["#1f6b4a", "#0f2d26", "#2a8f5e", "#14110f"].map((c, k) => (
        <mesh key={k} position={[0, 0.42, -0.14]} rotation={[-0.9 - k * 0.15, (k - 1.5) * 0.25, 0]}>
          <capsuleGeometry args={[0.025, 0.22, 3, 6]} />
          <Std c={c} r={0.25} m={0.3} />
        </mesh>
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.08, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
          <Std c="#ffc23a" />
        </mesh>
      ))}
    </group>
  );
};

export const Dog: React.FC<{ position: V3; rotation?: number; t: number }> = ({ position, rotation = 0, t }) => (
  <group position={position} rotation={[0, rotation, 0]}>
    <mesh position={[0, 0.35, -0.05]} rotation={[0.9, 0, 0]} castShadow>
      <capsuleGeometry args={[0.14, 0.3, 4, 10]} />
      <Std c="#b9824e" />
    </mesh>
    <group position={[0, 0.62, 0.12]} rotation={[0, Math.sin(t * 0.8) * 0.4, 0]}>
      <mesh castShadow>
        <sphereGeometry args={[0.12, 14, 10]} />
        <Std c="#b9824e" />
      </mesh>
      <mesh position={[0, -0.03, 0.12]} scale={[0.7, 0.6, 1]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <Std c="#e8c9a0" />
      </mesh>
      <mesh position={[0, -0.0, 0.19]}>
        <sphereGeometry args={[0.02, 8, 6]} />
        <Std c="#111" r={0.2} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.08, 0.1, -0.02]} rotation={[0, 0, s * -0.3]}>
            <coneGeometry args={[0.04, 0.12, 6]} />
            <Std c="#8a5a33" />
          </mesh>
          <mesh position={[s * 0.05, 0.03, 0.1]}>
            <sphereGeometry args={[0.018, 8, 6]} />
            <Std c="#111" r={0.1} />
          </mesh>
        </group>
      ))}
    </group>
    <mesh position={[0, 0.25, -0.3]} rotation={[-0.6, 0, Math.sin(t * 9) * 0.6]}>
      <capsuleGeometry args={[0.025, 0.18, 3, 6]} />
      <Std c="#b9824e" />
    </mesh>
    {[1, -1].map((s) => (
      <mesh key={s} position={[s * 0.08, 0.15, 0.12]}>
        <cylinderGeometry args={[0.03, 0.03, 0.3, 6]} />
        <Std c="#b9824e" />
      </mesh>
    ))}
  </group>
);

/* ------------------------------------------------------------------ fire, hut, river */
export const Fire: React.FC<{ position: V3; t: number; scale?: number }> = ({ position, t, scale = 1 }) => (
  <group position={position} scale={scale}>
    {Array.from({ length: 7 }).map((_, i) => {
      const f = 0.75 + 0.35 * Math.sin(t * (9 + i) + i * 1.7) * Math.sin(t * 5.3 + i);
      const a = (i / 7) * Math.PI * 2;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.08 * (i % 3), 0.15 * f, Math.sin(a) * 0.08 * (i % 3)]} scale={[1, f, 1]}>
          <coneGeometry args={[0.09 - (i % 3) * 0.015, 0.4, 8]} />
          <meshBasicMaterial color={i % 3 === 0 ? "#fff1a8" : i % 3 === 1 ? "#ffb02e" : "#ff5a1f"} transparent opacity={0.85} />
        </mesh>
      );
    })}
    {[0, 1, 2].map((k) => (
      <mesh key={k} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, (k / 3) * Math.PI]}>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 6]} />
        <Std c="#3b2416" />
      </mesh>
    ))}
    <pointLight position={[0, 0.4, 0]} color="#ff9a3c" intensity={8 + 3 * Math.sin(t * 13) * Math.sin(t * 7)} distance={8} />
  </group>
);

export const NipaHut: React.FC<{ position: V3; rotation?: number; lit?: boolean }> = ({ position, rotation = 0, lit }) => {
  const sawali = useTex("sawali", drawSawali, 256, [3, 1.5]);
  const thatch = useTex("thatch", drawThatch, 512, [2, 1]);
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[[-1.6, -1.3], [1.6, -1.3], [-1.6, 1.3], [1.6, 1.3]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 1.2, 8]} />
          <Std c="#a8875a" />
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.6, 0.12, 3.0]} />
        <Std c="#b89463" />
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 1.9, 2.8]} />
        <meshStandardMaterial map={sawali} roughness={0.95} />
      </mesh>
      <mesh position={[0.6, 2.35, 1.41]}>
        <planeGeometry args={[1.0, 0.8]} />
        <meshStandardMaterial color={lit ? "#ffb347" : "#2a1a10"} emissive={lit ? "#ff9a3c" : "#000"} emissiveIntensity={lit ? 1.2 : 0} />
      </mesh>
      <mesh position={[0, 4.0, 0]} rotation={[0, Math.PI / 4, 0]} scale={[2.9, 1, 2.5]} castShadow>
        <coneGeometry args={[1, 1.9, 4, 1]} />
        <meshStandardMaterial map={thatch} roughness={1} />
      </mesh>
      {lit ? <pointLight position={[0.6, 2.4, 2.0]} color="#ffb347" intensity={10} distance={6} /> : null}
    </group>
  );
};

export const Banca: React.FC<{ position: V3; rotation?: number; t: number; color?: string; seed: string }> = ({ position, rotation = 0, t, color = "#e63946", seed }) => {
  const bob = Math.sin(t * 1.6 + random(seed) * 6) * 0.05;
  const stripes = useTex(`banca-${color}`, (g, w, h) => {
    g.fillStyle = "#fff3dc";
    g.fillRect(0, 0, w, h);
    g.fillStyle = color;
    g.fillRect(0, h * 0.35, w, h * 0.3);
    g.fillStyle = "#ffd23f";
    g.fillRect(0, h * 0.68, w, h * 0.08);
    g.fillStyle = "#2b5fd9";
    g.fillRect(0, h * 0.22, w, h * 0.08);
  }, 128);
  return (
    <group position={[position[0], position[1] + bob, position[2]]} rotation={[bob * 0.5, rotation, bob]}>
      <mesh rotation={[0, 0, Math.PI / 2]} scale={[0.5, 1, 0.55]} castShadow>
        <capsuleGeometry args={[0.6, 4.5, 6, 16]} />
        <meshStandardMaterial map={stripes} roughness={0.6} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[0, 0.25, s * 1.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 4.6, 8]} />
            <Std c="#c9a35f" />
          </mesh>
          {[-1.2, 1.2].map((x) => (
            <mesh key={x} position={[x, 0.3, s * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.6, 6]} />
              <Std c="#a8875a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
