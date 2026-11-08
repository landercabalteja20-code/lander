import type { V3 } from "../lib";

export type Pose = "stand" | "walk" | "run" | "fall" | "struggle" | "lookup" | "huddle" | "cheer";

const PALETTES = [
  { shirt: "#ff6b4a", pants: "#2b2f45", skin: "#f1c7a0", hair: "#3b2416" },
  { shirt: "#3d7bff", pants: "#3a2c24", skin: "#8d5a3b", hair: "#17110d" },
  { shirt: "#ffd23f", pants: "#1f3b4d", skin: "#e8b48e", hair: "#a1532a" },
  { shirt: "#2ec4b6", pants: "#423047", skin: "#c98c62", hair: "#20140c" },
  { shirt: "#9b5de5", pants: "#2c3a2a", skin: "#6b4129", hair: "#0f0b08" },
];

const Limb: React.FC<{ r: number; len: number; color: string; rot: V3; pos: V3 }> = ({ r, len, color, rot, pos }) => (
  <group position={pos} rotation={rot}>
    <mesh position={[0, -len / 2 - r * 0.6, 0]} castShadow>
      <capsuleGeometry args={[r, len, 4, 10]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  </group>
);

/**
 * Stylised person, 1.8 units tall (1 unit = 1 mm in the shrunk world).
 * Fully frame-driven: pass `t` (seconds) for the animation clock.
 */
export const Human: React.FC<{
  position?: V3;
  rotation?: number;
  t: number;
  pose?: Pose;
  palette?: number;
  scale?: number;
  spin?: V3;
}> = ({ position = [0, 0, 0], rotation = 0, t, pose = "stand", palette = 0, scale = 1, spin = [0, 0, 0] }) => {
  const p = PALETTES[palette % PALETTES.length];
  const tau = Math.PI * 2;

  let legL = 0, legR = 0, legSpread = 0, armL: V3 = [0, 0, 0.12], armR: V3 = [0, 0, -0.12];
  let lean = 0, bob = 0, head: V3 = [0, 0, 0], hipY = 0.82;

  if (pose === "walk" || pose === "run") {
    const run = pose === "run";
    const ph = tau * (run ? 2.4 : 1.6) * t;
    const amp = run ? 0.9 : 0.5;
    legL = amp * Math.sin(ph);
    legR = -legL;
    armL = [-legL * (run ? 1.1 : 0.9), 0, 0.12];
    armR = [legL * (run ? 1.1 : 0.9), 0, -0.12];
    if (run) {
      armL[0] -= 0.5;
      armR[0] -= 0.5;
    }
    lean = run ? 0.28 : 0.04;
    bob = Math.abs(Math.sin(ph)) * (run ? 0.08 : 0.03);
  } else if (pose === "fall") {
    const f = Math.sin(t * 7);
    armL = [0, 0, 2.2 + 0.15 * f];
    armR = [0, 0, -2.2 - 0.15 * f];
    legSpread = 0.35 + 0.08 * Math.sin(t * 6 + 1);
    legL = 0.2 * Math.sin(t * 5);
    legR = -legL;
  } else if (pose === "struggle") {
    armL = [-2.6 + 0.7 * Math.sin(t * 9), 0, 0.5];
    armR = [-2.6 + 0.7 * Math.sin(t * 9 + 2), 0, -0.5];
    lean = 0.15 * Math.sin(t * 3);
    head = [-0.3, 0.2 * Math.sin(t * 4), 0];
  } else if (pose === "lookup") {
    head = [-0.75, 0, 0];
    armL = [0.1, 0, 0.18];
    armR = [0.1, 0, -0.18];
    bob = 0.01 * Math.sin(t * 2);
  } else if (pose === "huddle") {
    hipY = 0.38;
    legL = legR = -1.5;
    armL = [-0.9, 0, -0.45];
    armR = [-0.9, 0, 0.45];
    lean = 0.35 + 0.03 * Math.sin(t * 10);
    head = [0.2, 0, 0];
  } else if (pose === "cheer") {
    armL = [0, 0, 2.6 + 0.2 * Math.sin(t * 8)];
    armR = [0, 0, -2.6 - 0.2 * Math.sin(t * 8)];
    bob = Math.abs(Math.sin(t * 6)) * 0.12;
  }

  return (
    <group position={position} rotation={[spin[0], rotation + spin[1], spin[2]]} scale={scale}>
      <group position={[0, bob, 0]}>
        {/* legs */}
        <Limb r={0.085} len={0.55} color={p.pants} pos={[0.1, hipY, 0]} rot={[legL, 0, legSpread]} />
        <Limb r={0.085} len={0.55} color={p.pants} pos={[-0.1, hipY, 0]} rot={[legR, 0, -legSpread]} />
        <group position={[0, hipY, 0]} rotation={[lean, 0, 0]}>
          {/* torso */}
          <mesh position={[0, 0.33, 0]} castShadow>
            <capsuleGeometry args={[0.19, 0.36, 4, 12]} />
            <meshStandardMaterial color={p.shirt} roughness={0.7} />
          </mesh>
          {/* arms */}
          <Limb r={0.062} len={0.42} color={p.shirt} pos={[0.27, 0.6, 0]} rot={armL} />
          <Limb r={0.062} len={0.42} color={p.shirt} pos={[-0.27, 0.6, 0]} rot={armR} />
          {/* head */}
          <group position={[0, 0.78, 0]} rotation={head}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <sphereGeometry args={[0.15, 20, 16]} />
              <meshStandardMaterial color={p.skin} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.1, -0.015]} rotation={[-0.35, 0, 0]}>
              <sphereGeometry args={[0.158, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={p.hair} roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};
