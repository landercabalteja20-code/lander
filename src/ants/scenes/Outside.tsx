import { random, useCurrentFrame } from "remotion";
import { BackSide } from "three";
import { FPS, beatById, mix, msToFrame, path, prog, timeline, wordFrame, type V3 } from "../lib";
import { Cam, Stage } from "../three/Stage";
import { Human } from "../three/Human";
import { Ant } from "../three/Ant";
import { Scatter, Splash, WaterMaterial, useLeafGeometry } from "../three/props";
import { drawLeaf, drawSoil, useCanvasTexture } from "../three/textures";

type SceneProps = { dur: number };

const Ground: React.FC<{ seed: string; dark?: boolean }> = ({ seed, dark }) => {
  const soil = useCanvasTexture(`soil-${seed}`, drawSoil, 2048, [10, 10]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshStandardMaterial map={soil} roughness={dark ? 0.35 : 1} color={dark ? "#9a8a80" : "#ffffff"} />
      </mesh>
      {/* pebbles (sand grains, to you) */}
      <Scatter count={70} seed={`peb-${seed}`} castShadow receiveShadow place={(i, r) => {
        const x = (r("x") - 0.5) * 140;
        const z = 10 - r("z") * 160;
        if (Math.abs(x) < 7 && z > -30) return null;
        const s = 0.8 + r("s") * 4;
        return { p: [x, s * 0.4, z], r: [r("a") * 3, r("b") * 3, 0], s: [s, s * 0.7, s * 0.9], color: ["#8d8173", "#a39686", "#6f6458", "#b5a998"][i % 4] };
      }}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={dark ? 0.3 : 0.9} flatShading />
      </Scatter>
      {/* grass blades: 100 mm skyscrapers */}
      <Scatter count={140} seed={`grass-${seed}`} castShadow place={(i, r) => {
        const x = (r("x") - 0.5) * 300;
        const z = -25 - r("z") * 260;
        const h = 50 + r("h") * 90;
        return { p: [x, h / 2, z], r: [(r("a") - 0.5) * 0.3, r("b") * 3, (r("c") - 0.5) * 0.35], s: [3 + r("w") * 2, h, 0.35], color: ["#3e7d2c", "#5c9a3a", "#2f6624", "#78a845"][i % 4] };
      }}>
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </Scatter>
    </group>
  );
};

/* ------------------------------------------------------------------ ANTS: 2.5 million per person, now your size */
export const AntsScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const reveal = prog(frame, 0, wordFrame("ants", "million"));
  const close = prog(frame, wordFrame("ants", "Now") - 8, wordFrame("ants", "Now") + 22);
  const ants = Array.from({ length: 26 }).map((_, i) => {
    const lane = (i % 3) - 1;
    const z0 = -10 - i * 6.5 - random(`az${i}`) * 3;
    const z = Math.min(-7 - (i % 3) * 2.5, z0 + t * 6.5);
    const x = lane * 6 + Math.sin(z * 0.08 + i) * 3;
    const stopped = z0 + t * 6.5 > z;
    return { x, z, stopped, i };
  });
  return (
    <Stage bg="#f0b878" fog={["#f0b878", 40, 420]} sun={{ position: [-60, 45, -90], intensity: 3.0, color: "#ffc98a", shadow: 45 }} hemi={["#ffe2b8", "#5b3a22", 0.95]}>
      <Cam
        position={path([[1.8, 1.7, 8.5], [2.5, 3.5, 12], [0.4, 3.1, 5.8]], reveal * 0.5 + close * 0.5)}
        target={path([[0, 1.5, -8], [0, 2, -40], [0, 1.6, -7.5]], reveal * 0.5 + close * 0.5)}
        fov={mix(46, 34, close)}
      />
      <Ground seed="ants" />
      {ants.map((a) => (
        <Ant key={a.i} position={[a.x, 0, a.z]} rotation={0.0 + Math.cos(a.z * 0.08 + a.i) * 0.24} t={t + a.i * 0.13} speed={a.stopped ? 0 : 2.4} />
      ))}
      <Human position={[-0.9, 0, 1.4]} rotation={Math.PI + 0.2} t={t} pose="lookup" palette={0} />
      <Human position={[0.8, 0, 1.9]} rotation={Math.PI - 0.3} t={t + 0.3} pose="stand" palette={1} />
      <Human position={[0, 0, 3]} rotation={Math.PI} t={t + 0.6} pose="lookup" palette={2} />
      {/* warm sky dome */}
      <mesh>
        <sphereGeometry args={[900, 24, 12]} />
        <meshBasicMaterial color="#f0b878" side={BackSide} />
      </mesh>
    </Stage>
  );
};

/* ------------------------------------------------------------------ RAIN: every drop is 50x your weight */
const impactsIn = (id: string) => {
  const b = beatById(id);
  return timeline.impactsMs
    .map((ms, i) => ({ f: msToFrame(ms) - b.from, i }))
    .filter((x) => x.f > -20 && x.f < b.dur + 30);
};

const FallingDrop: React.FC<{ at: V3; f: number; frame: number; r?: number }> = ({ at, f, frame, r = 1.5 }) => {
  const k = (frame - (f - 9)) / 9; // 9 frames of fall
  if (k < 0 || k > 1) return null;
  return (
    <mesh position={[at[0], at[1] + (1 - k) * 70 + r * 0.8, at[2]]} scale={[r, r * 1.25, r]}>
      <sphereGeometry args={[1, 24, 16]} />
      <WaterMaterial />
    </mesh>
  );
};

const RainStreaks: React.FC<{ frame: number; count?: number; spread?: number }> = ({ frame, count = 220, spread = 140 }) => (
  <Scatter
    count={count}
    seed="streak"
    frame={frame}
    place={(i, r) => {
      const speed = 5 + r("v") * 2;
      const y = 120 - ((r("y") * 120 + frame * speed) % 120);
      return { p: [(r("x") - 0.5) * spread, y, -6 - r("z") * 120], s: [0.12, 4 + r("l") * 4, 0.12] };
    }}
  >
    <cylinderGeometry args={[1, 1, 1, 4]} />
    <meshBasicMaterial color="#c9d8e6" transparent opacity={0.5} />
  </Scatter>
);

export const RainScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const impacts = impactsIn("rain");
  const runX = -6 + t * 2.2;
  const flash = Math.max(0, 1 - Math.abs(frame - 3) / 3) + Math.max(0, 1 - Math.abs(frame - 10) / 2) * 0.7;
  const shake = impacts.reduce((acc, im) => {
    const d = frame - im.f;
    return d >= 0 && d < 14 ? acc + Math.exp(-d * 0.35) * 0.18 * Math.sin(d * 2.4) : acc;
  }, 0);
  const pts: V3[] = impacts.map((im) => {
    const near = im.i % 2 === 0;
    return [runX + (near ? 2 + random(`rx${im.i}`) * 4 : -4 + random(`rx${im.i}`) * 12), 0, near ? -2 - random(`rz${im.i}`) * 3 : -6 - random(`rz${im.i}`) * 14];
  });
  return (
    <Stage bg="#465462" fog={["#465462", 25, 260]} sun={{ position: [30, 80, 40], intensity: 1.3 + flash * 5, color: "#cfe0ff", shadow: 30 }} hemi={["#aabcd0", "#30281f", 0.95 + flash * 2]} ambient={0.25}>
      <Cam position={[runX + 0.5, 2.2 + shake, 10.5]} target={[runX + 0.8, 2.6 + shake * 0.5, -6]} fov={50} roll={shake * 0.08} />
      <Ground seed="rain" dark />
      <RainStreaks frame={frame} />
      {impacts.map((im, k) => (
        <group key={im.i}>
          <FallingDrop at={pts[k]} f={im.f} frame={frame} />
          <Splash at={pts[k]} age={frame - im.f} seed={`sp${im.i}`} size={1.3} />
        </group>
      ))}
      {[0, 1, 2].map((k) => (
        <Human key={k} position={[runX - k * 1.6 + 0.4, 0, -0.4 + k * 0.9]} rotation={Math.PI / 2} t={t + k * 0.2} pose="run" palette={k} />
      ))}
    </Stage>
  );
};

/* ------------------------------------------------------------------ LEAF: the only shelter */
export const LeafScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const leafTex = useCanvasTexture("leaf", drawLeaf, 1024);
  const geo = useLeafGeometry(78, 34, 5);
  const impacts = impactsIn("leaf");
  const leafPos: V3 = [0, 8.5, -1];
  const dip = impacts.reduce((acc, im) => {
    const d = frame - im.f;
    return d >= 0 ? acc + Math.exp(-d * 0.12) * Math.sin(d * 0.55) * 0.05 : acc;
  }, 0);
  const k = prog(frame, 0, dur);
  const hits: V3[] = impacts.map((im) => [-14 + random(`lx${im.i}`) * 28, 0, -8 + random(`lz${im.i}`) * 10]);
  return (
    <Stage bg="#4a5866" fog={["#4a5866", 40, 260]} sun={{ position: [20, 90, 30], intensity: 1.6, color: "#d8e6ff", shadow: 45 }} hemi={["#b9cadb", "#3a3028", 1.1]} ambient={0.3}>
      <Cam position={path([[5, 2.4, 30], [3, 1.6, 17]], k)} target={path([[0, 5.5, -2], [0, 3.6, -1.5]], k)} fov={46} />
      <pointLight position={[0, 5, 1]} intensity={25} distance={22} color="#ffc27a" />
      <Ground seed="leaf" dark />
      <RainStreaks frame={frame} count={260} spread={160} />
      {/* twig holding the leaf up */}
      <mesh position={[-20, 4, -3]} rotation={[0, 0, -1.1]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 30, 10]} />
        <meshStandardMaterial color="#5e432c" roughness={0.9} />
      </mesh>
      <group position={leafPos} rotation={[dip, 0.25, 0.06 + dip * 0.5]}>
        <mesh geometry={geo} castShadow receiveShadow>
          <meshStandardMaterial map={leafTex} roughness={0.45} side={2} />
        </mesh>
        {impacts.map((im, i) => (
          <group key={im.i}>
            <FallingDrop at={[hits[i][0], -0.6, hits[i][2] * 0.5]} f={im.f} frame={frame} r={1.4} />
            <Splash at={[hits[i][0], -0.6 - 0.03 * hits[i][2] * hits[i][2], hits[i][2] * 0.5]} age={frame - im.f} seed={`lsp${im.i}`} size={1.1} />
          </group>
        ))}
      </group>
      {[0, 1, 2, 3].map((n) => (
        <Human key={n} position={[-2.7 + n * 1.6, 0, -0.6 + (n % 2) * 0.9]} rotation={0.6 + n * 0.2} t={t + n * 0.37} pose="huddle" palette={n} />
      ))}
    </Stage>
  );
};
