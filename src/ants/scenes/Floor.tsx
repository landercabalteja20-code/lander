import { Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { useCurrentFrame } from "remotion";
import { FPS, mix, path, prog, wordFrame, type V3 } from "../lib";
import { Cam, Stage } from "../three/Stage";
import { Human } from "../three/Human";
import { Scatter } from "../three/props";
import { drawPaint, drawWood, useCanvasTexture } from "../three/textures";

type SceneProps = { dur: number };

/* ------------------------------------------------------------------ CARPET: a 10 km hike through the pile */
export const CarpetScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const lead = -1.1 * t;
  const rise = prog(frame, dur * 0.55, dur);
  const colors = ["#2f7f86", "#2a6f75", "#3a9097", "#245e64", "#4aa3a6"];
  return (
    <Stage bg="#cfe3dc" fog={["#cfe3dc", 25, 6000]} sun={{ position: [40, 80, 30], intensity: 2.4, shadow: 40 }} hemi={["#f4fff8", "#1d4447", 1.0]}>
      <Cam
        position={path([[2.4, 1.7, lead + 5.5], [2.6, 4, lead + 10], [3, 24, lead + 30]], rise)}
        target={path([[-0.2, 1.4, lead - 5], [0, 3, lead - 20], [0, 30, lead - 400]], rise)}
        fov={mix(46, 50, rise)}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, -400]}>
        <planeGeometry args={[400, 1000]} />
        <meshStandardMaterial color="#1f4f54" roughness={1} />
      </mesh>
      {/* carpet tufts: 10-18 mm tall, 1 mm thick */}
      <Scatter
        count={9000}
        seed="pile"
        castShadow
        place={(i, r) => {
          const cols = 60;
          const x = ((i % cols) - cols / 2) * 1.35 + (r("jx") - 0.5) * 0.9;
          const z = 12 - Math.floor(i / cols) * 1.35 + (r("jz") - 0.5) * 0.9;
          const onPath = Math.abs(x) < 4.5;
          const h = onPath ? 0.6 + r("h") * 0.6 : 10 + r("h") * 8;
          return {
            p: [x, h / 2, z],
            r: [(r("a") - 0.5) * (onPath ? 1.2 : 0.25), r("b") * 3, (r("c") - 0.5) * (onPath ? 1.2 : 0.25)],
            s: [0.55 + r("w") * 0.3, h, 0.55 + r("w") * 0.3],
            color: colors[Math.floor(r("col") * colors.length)],
          };
        }}
      >
        <cylinderGeometry args={[0.55, 0.85, 1, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </Scatter>
      {/* the kitchen, far away: fridge + counter */}
      <mesh position={[150, 900, -2500]}>
        <boxGeometry args={[900, 1800, 700]} />
        <meshStandardMaterial color="#f2f0ea" roughness={0.4} />
      </mesh>
      <mesh position={[-650, 450, -2550]}>
        <boxGeometry args={[1400, 900, 600]} />
        <meshStandardMaterial color="#c9a27a" roughness={0.6} />
      </mesh>
      {[0, 1, 2, 3].map((k) => (
        <Human key={k} position={[k % 2 ? -0.35 : 0.3, 0.3, lead - k * 2.6]} rotation={Math.PI} t={t + k * 0.31} pose="walk" palette={k} />
      ))}
    </Stage>
  );
};

/* ------------------------------------------------------------------ RICE: one grain = months of food */
export const RiceScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const wood = useCanvasTexture("wood-floor", drawWood, 2048, [6, 6]);
  const k = prog(frame, 0, dur);
  const a = mix(-0.9, 0.5, k);
  const rad = mix(11, 8.5, k);
  return (
    <Stage bg="#f3d6a8" fog={["#f3d6a8", 30, 260]} sun={{ position: [30, 50, 20], intensity: 2.6, shadow: 20 }} hemi={["#fff3dc", "#7a5233", 1.0]}>
      <Cam position={[Math.sin(a) * rad, mix(2.2, 3.4, k), Math.cos(a) * rad]} target={[0, 1.4, 0]} fov={44} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial map={wood} roughness={0.55} />
      </mesh>
      {/* a 6.5 mm grain of rice */}
      <mesh position={[0, 1.05, -1]} rotation={[0, 0.3, Math.PI / 2]} scale={[1, 1, 0.9]} castShadow receiveShadow>
        <capsuleGeometry args={[1.08, 4.4, 12, 32]} />
        <meshPhysicalMaterial color="#fffaf0" roughness={0.35} clearcoat={0.4} sheen={1} sheenColor="#ffffff" emissive="#fff3e0" emissiveIntensity={0.12} />
      </mesh>
      {/* more grains + a bread crumb further away */}
      <Scatter count={14} seed="grains" castShadow place={(i, r) => ({ p: [(r("x") - 0.5) * 70, 1, -12 - r("z") * 60], r: [0, r("ry") * 6, Math.PI / 2], s: [1, 1, 0.9] })}>
        <capsuleGeometry args={[1.08, 4.4, 8, 20]} />
        <meshStandardMaterial color="#fffaf0" roughness={0.4} />
      </Scatter>
      <mesh position={[-14, 2.4, -26]} rotation={[0.3, 0.6, 0.2]} castShadow>
        <dodecahedronGeometry args={[4, 1]} />
        <meshStandardMaterial color="#c98b45" roughness={0.9} flatShading />
      </mesh>
      <Human position={[0.2, 2.02, -1.1]} rotation={0.4} t={t} pose="cheer" palette={2} />
      <Human position={[2.3, 0, 0.8]} rotation={-2.4} t={t} pose="lookup" palette={1} />
      <Human position={[-2.6, 0, 0.6]} rotation={2.5} t={t + 0.4} pose="walk" palette={3} />
      <Human position={[-1, 0, 1.6]} rotation={3.0} t={t + 0.2} pose="stand" palette={4} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ DROP: surface tension trap */
export const DropScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tiles = useCanvasTexture(
    "tiles",
    (ctx, w, h) => {
      ctx.fillStyle = "#3f5562";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#22313a";
      ctx.fillRect(0, 0, w, 8);
      ctx.fillRect(0, 0, 8, h);
    },
    512,
    [2, 2],
  );
  const trap = wordFrame("drop", "trap");
  const k = prog(frame, 0, dur);
  const wob = 1 + 0.025 * Math.sin(t * 7);
  const sink = prog(frame, trap - 10, trap + 25) * 0.25;
  return (
    <Stage bg="#5d7482" fog={["#5d7482", 40, 220]} sun={{ position: [20, 40, 30], intensity: 2.8, shadow: 14 }} hemi={["#f2fbff", "#4d6470", 1.1]}>
      <Cam position={path([[10, 4, 12], [7.4, 2.6, 8.6]], k)} target={[0.8, 0.9, 0.6]} fov={40} />
      <Environment resolution={256} frames={1} environmentIntensity={0.35}>
        <Lightformer form="rect" intensity={4} position={[0, 12, -6]} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[10, 4, 6]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={3} position={[-6, 6, 8]} scale={3} />
        <Lightformer form="rect" intensity={1} color="#ffd9a8" position={[0, -3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={tiles} roughness={0.25} metalness={0.05} />
      </mesh>
      {/* a single 8 mm water drop on the kitchen floor */}
      <mesh scale={[4.2 * wob, 2.1 / wob, 4.2 * wob]} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#d6efff" roughness={0.02} clearcoat={1} transparent opacity={0.38} emissive="#6b97bf" emissiveIntensity={0.12} />
      </mesh>
      {/* bright specular hint */}
      <mesh position={[-1.2, 1.85, 1.2]} scale={[0.9, 0.25, 0.5]} rotation={[0.4, 0.6, 0]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <Human position={[2.8, -0.55 - sink, 2.2]} rotation={0.75} t={t} pose="struggle" palette={3} />
      <Human position={[5, 0, 3.6]} rotation={-2.1} t={t + 0.5} pose="lookup" palette={1} />
      {/* other drops in the distance */}
      <Scatter count={6} seed="drops" place={(i, r) => ({ p: [-8 - r("x") * 40, 0, -6 - r("z") * 40], s: [2 + r("s") * 4, 1 + r("s") * 2, 2 + r("s") * 4] })}>
        <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#c7e6ff" roughness={0.02} clearcoat={1} transparent opacity={0.4} />
      </Scatter>
    </Stage>
  );
};

/* ------------------------------------------------------------------ DOOR: the handle is 1 km up */
export const DoorScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const paint = useCanvasTexture("paint", drawPaint, 1024, [4, 4]);
  const wood = useCanvasTexture("wood-hall", drawWood, 2048, [3, 3]);
  const up = prog(frame, 6, dur * 0.62);
  const down = prog(frame, dur * 0.66, dur - 6);
  const handle: V3 = [330, 1000, 40];
  const human: V3 = [300, 0, 42];
  const camUp = path([[307, 1.5, 49], [330, 260, 380], [360, 980, 520]], up);
  const camPos = path([camUp, [395, 1040, 150]], down);
  const tgtUp = path([[300, 1.6, 42], [310, 600, 40], handle], up);
  const tgt = path([tgtUp, human], down);
  return (
    <Stage bg="#d8c9b4" fog={["#d8c9b4", 300, 4500]} sun={{ position: [800, 1600, 1400], intensity: 2.2, shadow: 1300 }} hemi={["#fff6e6", "#7a6550", 1.1]}>
      <Cam position={camPos} target={tgt} fov={mix(46, 55, up)} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8000, 8000]} />
        <meshStandardMaterial map={wood} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2000, -2]} receiveShadow>
        <planeGeometry args={[8000, 4000]} />
        <meshStandardMaterial map={paint} roughness={0.9} />
      </mesh>
      {/* the door */}
      <RoundedBox args={[820, 2010, 40]} radius={6} position={[0, 1013, 20]} castShadow receiveShadow>
        <meshStandardMaterial color="#f7f1e6" roughness={0.6} />
      </RoundedBox>
      {[
        [-190, 1500],
        [190, 1500],
        [-190, 550],
        [190, 550],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 41]}>
          <boxGeometry args={[300, i < 2 ? 700 : 780, 4]} />
          <meshStandardMaterial color="#efe6d6" roughness={0.6} />
        </mesh>
      ))}
      {/* handle */}
      <mesh position={[330, 1000, 42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[30, 30, 8, 32]} />
        <meshStandardMaterial color="#c9a14a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[270, 1000, 75]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[10, 120, 8, 16]} />
        <meshStandardMaterial color="#c9a14a" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[330, 1000, 58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[12, 12, 34, 16]} />
        <meshStandardMaterial color="#c9a14a" metalness={0.85} roughness={0.25} />
      </mesh>
      <Human position={human} rotation={Math.PI - 0.3} t={t} pose="lookup" palette={4} />
      <mesh position={[human[0], 0.5, human[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={down}>
        <torusGeometry args={[22, 2.2, 8, 48]} />
        <meshBasicMaterial color="#d7ff3a" />
      </mesh>
    </Stage>
  );
};
