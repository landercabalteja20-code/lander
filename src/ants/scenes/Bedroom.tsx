import { RoundedBox } from "@react-three/drei";
import { useCurrentFrame } from "remotion";
import { BackSide } from "three";
import { FPS, mix, path, prog, wordFrame, type V3 } from "../lib";
import { Cam, Stage } from "../three/Stage";
import { Human } from "../three/Human";
import { Scatter } from "../three/props";
import { drawFur, drawQuilt, drawRug, drawStripes, drawWood, useCanvasTexture } from "../three/textures";

type SceneProps = { dur: number };

/* ------------------------------------------------------------------ HOOK: nightstand + alarm clock */
const AlarmClock: React.FC<{ frame: number }> = ({ frame }) => {
  const hour = ((6 + 59 / 60) / 12) * Math.PI * 2;
  const minute = (59 / 60) * Math.PI * 2;
  const second = ((frame / FPS) * Math.PI * 2) / 60 + 0.3;
  const R = 55;
  return (
    <group position={[0, 70, -90]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, 34, 64]} />
        <meshStandardMaterial color="#ff6b4a" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, 17.2]}>
        <circleGeometry args={[R * 0.86, 64]} />
        <meshStandardMaterial color="#fff6e8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 17]} >
        <torusGeometry args={[R * 0.9, 3.2, 12, 64]} />
        <meshStandardMaterial color="#f2d27a" metalness={0.8} roughness={0.25} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const big = i % 3 === 0;
        return (
          <mesh key={i} position={[Math.sin(a) * R * 0.74, Math.cos(a) * R * 0.74, 17.6]} rotation={[0, 0, -a]}>
            <boxGeometry args={[big ? 2.6 : 1.4, big ? 8 : 5, 0.6]} />
            <meshStandardMaterial color="#15110d" />
          </mesh>
        );
      })}
      {[
        { a: hour, l: 26, w: 3.4, c: "#15110d" },
        { a: minute, l: 38, w: 2.4, c: "#15110d" },
        { a: second, l: 40, w: 0.8, c: "#ff6b4a" },
      ].map((h, i) => (
        <group key={i} rotation={[0, 0, -h.a]} position={[0, 0, 18 + i * 0.6]}>
          <mesh position={[0, h.l / 2 - 4, 0]}>
            <boxGeometry args={[h.w, h.l, 0.5]} />
            <meshStandardMaterial color={h.c} />
          </mesh>
        </group>
      ))}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 34, 50, 0]} rotation={[0, 0, s * -0.55]} castShadow>
            <sphereGeometry args={[20, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f2d27a" metalness={0.85} roughness={0.2} side={2} />
          </mesh>
          <mesh position={[s * 30, -62, 0]} rotation={[0, 0, s * 0.35]} castShadow>
            <cylinderGeometry args={[3, 4, 22, 12]} />
            <meshStandardMaterial color="#f2d27a" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const HookScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const wood = useCanvasTexture("wood-hook", drawWood, 1024, [3, 3]);
  const k = prog(frame, 0, dur);
  return (
    <Stage bg="#2a1d18" fog={["#2a1d18", 160, 700]} sun={{ position: [80, 160, 120], intensity: 2.6, shadow: 140 }} hemi={["#ffe7c4", "#3a2a20", 0.75]}>
      <Cam position={path([[2.4, 1.6, 4.2], [7, 6, 26], [34, 28, 128]], k)} target={path([[0, 1.25, 0], [0, 8, -20], [0, 58, -90]], k)} fov={42} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial map={wood} roughness={0.5} />
      </mesh>
      <AlarmClock frame={frame} />
      {/* glass of water in the background */}
      <mesh position={[-150, 75, -230]}>
        <cylinderGeometry args={[38, 32, 150, 40, 1, true]} />
        <meshPhysicalMaterial color="#d8ecff" transparent opacity={0.35} roughness={0.05} clearcoat={1} side={2} />
      </mesh>
      {/* warm lamp glow */}
      <pointLight position={[-120, 180, -40]} intensity={60000} distance={900} color="#ffb547" />
      <Human t={t} pose={frame < dur * 0.45 ? "stand" : "lookup"} rotation={mix(0.5, Math.PI - 0.35, prog(frame, dur * 0.3, dur * 0.55))} palette={0} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ BED: walk to the edge */
const Bed: React.FC = () => {
  const quilt = useCanvasTexture("quilt", drawQuilt, 2048, [3.5, 2.25]);
  const side = useCanvasTexture("side", drawStripes("#efe4d2", "#e3d3bd"), 512, [40, 1]);
  const rug = useCanvasTexture("rug", drawRug, 2048, [2, 2]);
  const wood = useCanvasTexture("wood-bed", drawWood, 1024, [8, 1]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -450]} receiveShadow>
        <planeGeometry args={[1400, 900]} />
        <meshStandardMaterial map={quilt} roughness={0.95} />
      </mesh>
      {/* rounded mattress lip */}
      <mesh position={[0, -12, -12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[12, 12, 1400, 24]} />
        <meshStandardMaterial color="#efe4d2" roughness={0.95} />
      </mesh>
      <mesh position={[0, -130, 0]}>
        <planeGeometry args={[1400, 240]} />
        <meshStandardMaterial map={side} roughness={0.95} />
      </mesh>
      <mesh position={[0, -375, -30]}>
        <planeGeometry args={[1400, 250]} />
        <meshStandardMaterial map={wood} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -500, 400]} receiveShadow>
        <planeGeometry args={[3000, 2000]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <RoundedBox args={[720, 170, 380]} radius={70} smoothness={6} position={[-60, 70, -560]} castShadow>
        <meshStandardMaterial color="#9cbbe6" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[720, 150, 380]} radius={65} smoothness={6} position={[700, 62, -600]} rotation={[0, -0.12, 0]}>
        <meshStandardMaterial color="#f4a98f" roughness={0.9} />
      </RoundedBox>
    </group>
  );
};

export const BedScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cliff = wordFrame("bed", "edge") - 6;
  const walk = prog(frame, 0, cliff + 10);
  const hz = mix(-34, -4.5, walk);
  const look = prog(frame, cliff, cliff + 50);
  const camA: V3 = [0.9, 0.9, hz + 9];
  const camB: V3 = [7, 16, 22];
  return (
    <Stage bg="#f6dcc0" fog={["#f6dcc0", 400, 2200]} sun={{ position: [-90, 160, 90], intensity: 2.4, shadow: 60 }} hemi={["#fff1dc", "#a0806a", 1.0]}>
      <Cam position={path([camA, [3, 4, 14], camB], look)} target={path([[0, 5, hz - 30], [0, -10, -6], [0, -140, -10]], look)} fov={mix(44, 52, look)} />
      <Bed />
      <Human position={[0, 0, hz]} t={t} pose={walk < 1 ? "walk" : "stand"} palette={0} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ FALL: drifting down the side of the bed */
export const FallScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const land = dur - 34;
  const f = prog(frame, 0, land, (x) => x);
  const y = mix(-6, -499.2, f);
  const landed = frame >= land;
  const side = useCanvasTexture("side", drawStripes("#efe4d2", "#e3d3bd"), 512, [40, 1]);
  const wood = useCanvasTexture("wood-bed", drawWood, 1024, [8, 1]);
  const rug = useCanvasTexture("rug", drawRug, 2048, [2, 2]);
  const sway = Math.sin(t * 1.3) * 2;
  const camY = landed ? -497.5 + 1.2 * prog(frame, land, dur) : y - 2.5;
  return (
    <Stage bg="#e9c9a7" fog={["#e9c9a7", 40, 380]} sun={{ position: [-60, 120, 160], intensity: 2.2 }} hemi={["#fff1dc", "#8f6c52", 1.1]}>
      <Cam position={[9 + sway, camY, 24]} target={[sway * 0.3, landed ? -498.6 : y + 0.5, 12]} fov={38} />
      <mesh position={[0, -130, 0]}>
        <planeGeometry args={[1400, 240]} />
        <meshStandardMaterial map={side} roughness={0.95} />
      </mesh>
      <mesh position={[0, -12, -12]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[12, 12, 1400, 24]} />
        <meshStandardMaterial color="#efe4d2" roughness={0.95} />
      </mesh>
      <mesh position={[0, -375, -30]}>
        <planeGeometry args={[1400, 250]} />
        <meshStandardMaterial map={wood} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -500, 400]}>
        <planeGeometry args={[3000, 2000]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      {/* dust motes hanging in the air: they show how slowly you drift */}
      <Scatter count={260} seed="dust" place={(i, r) => ({ p: [r("x") * 60 - 30, -r("y") * 510, 2 + r("z") * 26], s: Array(3).fill(0.08 + r("s") * 0.22) as V3 })}>
        <sphereGeometry args={[1, 6, 5]} />
        <meshStandardMaterial color="#fff7e6" emissive="#ffe9c2" emissiveIntensity={0.9} transparent opacity={0.8} />
      </Scatter>
      <Human
        position={[0, landed ? -500 : y, 12]}
        t={t}
        pose={landed ? "cheer" : "fall"}
        palette={0}
        spin={landed ? [0, 0, 0] : [0.25 * Math.sin(t * 0.9), t * 0.6, 0.2 * Math.sin(t * 1.1)]}
      />
    </Stage>
  );
};

/* ------------------------------------------------------------------ CAT: a 300 m tall face wakes up */
const CatEye: React.FC<{ x: number; open: number; pupil: number }> = ({ x, open, pupil }) => {
  const r = 11;
  return (
    <group position={[x, 90, -102]} rotation={[0.1, x > 0 ? 0.32 : -0.32, 0]}>
      <mesh>
        <sphereGeometry args={[r, 32, 24]} />
        <meshPhysicalMaterial color="#c6d23a" roughness={0.05} clearcoat={1} emissive="#4d5a05" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, r * 0.93]} scale={[mix(0.12, 0.62, pupil) * r, 0.88 * r, 0.25 * r]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#050403" roughness={0.1} />
      </mesh>
      <mesh position={[r * 0.35, r * 0.4, r * 0.92]}>
        <sphereGeometry args={[r * 0.11, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* upper + lower lids */}
      <mesh rotation={[mix(1.85, -0.75, open), 0, 0]}>
        <sphereGeometry args={[r * 1.08, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c9732f" roughness={0.9} side={2} />
      </mesh>
      <mesh rotation={[Math.PI + 0.75, 0, 0]}>
        <sphereGeometry args={[r * 1.07, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#c9732f" roughness={0.9} side={2} />
      </mesh>
    </group>
  );
};

export const CatScene: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fur = useCanvasTexture("fur", drawFur, 2048, [2, 2]);
  const rug = useCanvasTexture("rug", drawRug, 2048, [2, 2]);
  const wake = wordFrame("cat", "wakes");
  const notice = wordFrame("cat", "noticed");
  const open = prog(frame, wake, wake + 20) * 0.75 + prog(frame, notice, notice + 8) * 0.25;
  const pupil = 0.15 + prog(frame, notice, notice + 10) * 0.85;
  const push = prog(frame, 0, notice);
  const zoom = prog(frame, notice - 2, notice + 14);
  const lift = prog(frame, wake, wake + 40) * 8;
  return (
    <Stage bg="#5a3a2c" fog={["#5a3a2c", 200, 900]} sun={{ position: [140, 220, 160], intensity: 2.6, color: "#ffd6a0" }} hemi={["#ffe4c4", "#6b4030", 0.8]}>
      <Cam
        position={path([[1.5, 0.8, 15], [2, 1.4, 7], [2, 8, -30]], push * 0.5 + zoom * 0.5)}
        target={path([[0, 58, -120], [0, 70, -110], [20, 90, -100]], push * 0.5 + zoom * 0.5)}
        fov={mix(48, 26, zoom)}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <group position={[0, lift, 0]}>
        {/* head */}
        <mesh position={[0, 80, -150]} scale={[1.15, 0.95, 1]}>
          <sphereGeometry args={[55, 48, 36]} />
          <meshStandardMaterial map={fur} roughness={0.95} />
        </mesh>
        {/* body */}
        <mesh position={[0, 60, -330]} scale={[1.3, 0.9, 2.2]}>
          <sphereGeometry args={[90, 40, 30]} />
          <meshStandardMaterial map={fur} roughness={0.95} />
        </mesh>
        {/* ears */}
        {[1, -1].map((s) => (
          <group key={s}>
            <mesh position={[s * 38, 132, -158]} rotation={[-0.15, 0, s * -0.35]}>
              <coneGeometry args={[24, 52, 4]} />
              <meshStandardMaterial map={fur} roughness={0.95} />
            </mesh>
            <mesh position={[s * 37, 130, -150]} rotation={[-0.15, 0, s * -0.35]} scale={0.6}>
              <coneGeometry args={[24, 52, 4]} />
              <meshStandardMaterial color="#e9a39a" roughness={0.9} />
            </mesh>
            {/* muzzle */}
            <mesh position={[s * 11, 60, -99]}>
              <sphereGeometry args={[13, 24, 18]} />
              <meshStandardMaterial color="#f6e2c8" roughness={0.95} />
            </mesh>
            {/* whiskers */}
            {[0, 1, 2].map((w) => (
              <mesh key={w} position={[s * 60, 60 + w * 4 - 4, -92]} rotation={[0, s * 0.2, s * (Math.PI / 2 + (w - 1) * 0.12)]}>
                <cylinderGeometry args={[0.35, 0.5, 90, 5]} />
                <meshStandardMaterial color="#fffaf0" />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 74, -88]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[6.5, 7, 3]} />
          <meshStandardMaterial color="#d96f78" roughness={0.5} />
        </mesh>
        <CatEye x={24} open={open} pupil={pupil} />
        <CatEye x={-24} open={open} pupil={pupil} />
      </group>
      <Human position={[0.6, 0, 0]} rotation={Math.PI - 0.25} t={t} pose="lookup" palette={0} />
      <mesh>
        <sphereGeometry args={[2000, 16, 8]} />
        <meshBasicMaterial color="#5a3a2c" side={BackSide} />
      </mesh>
    </Stage>
  );
};
