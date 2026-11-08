import { random } from "remotion";
import { DoubleSide, LatheGeometry, Vector2 } from "three";
import { faceTexture } from "./robloxFace";
import { fabric, type Pattern } from "./patterns";

type V3 = [number, number, number];

export type Expr = "neutral" | "happy" | "laugh" | "shock" | "worried" | "smug" | "angry" | "sad";
export type Pose =
  | "idle" | "talk" | "walk" | "run" | "wave" | "point" | "shrug" | "phone" | "phoneUp" | "carryHead"
  | "carryShoulder" | "stir" | "fan" | "cheer" | "facepalm" | "hips" | "crossed" | "sit" | "holdBook"
  | "shock" | "dab" | "offer" | "pray" | "hug" | "sitFloor";

export type Outfit =
  | "hoodie" | "tee" | "barista" | "barong" | "camisa" | "baro" | "changshan" | "friar" | "officer"
  | "cuadrillero" | "european" | "dress";
export type Hair = "short" | "fluffy" | "curly" | "bun" | "long" | "braid" | "queue" | "tonsure" | "bald" | "afro" | "ponytail" | "none";
export type Hat = "salakot" | "bucket" | "kepi" | "tophat" | "straw" | "cap" | "skullcap" | "veil" | null;
export type Prop = "phone" | "phoneLit" | "cup" | "fan" | "basket" | "lance" | "book" | "cane" | "parasol" | "batirol" | "stone" | "coin" | null;

export type Spec = {
  seed: string;
  height: number;
  build: number;
  belly?: number;
  kid?: boolean;
  skin: string;
  hair: Hair;
  hairColor: string;
  hairTips?: string;
  beard?: "mustache" | "full" | "stubble";
  eyes?: string;
  outfit: Outfit;
  top: string;
  topPattern?: Pattern;
  bottom: string;
  bottomPattern?: Pattern;
  accent?: string;
  accentPattern?: Pattern;
  shoes: string | null;
  hat?: Hat;
  hatColor?: string;
  hatPattern?: Pattern;
  glasses?: boolean;
  earbuds?: boolean;
  print?: string;
  prop?: Prop;
};

type Arm = { raise: number; out: number; elbow: number };
type Leg = { lift: number; spread: number; knee: number };
type J = { lean: number; side: number; twist: number; yaw: number; pitch: number; roll: number; arms: [Arm, Arm]; legs: [Leg, Leg]; y: number };

const A = (raise = 0, out = 0.08, elbow = 0.15): Arm => ({ raise, out, elbow });
const L = (lift = 0, spread = 0.02, knee = 0): Leg => ({ lift, spread, knee });

/** Joint angles for a pose at time t (s). Index 0 = left (+x), 1 = right (-x). */
const joints = (pose: Pose, t: number, ph: number): J => {
  const br = Math.sin(t * 2.2 + ph);
  const j: J = { lean: 0.02 * br, side: 0.015 * Math.sin(t * 0.7 + ph), twist: 0, yaw: 0.08 * Math.sin(t * 0.5 + ph), pitch: 0, roll: 0, arms: [A(0.05, 0.1, 0.2), A(0.05, 0.1, 0.2)], legs: [L(), L()], y: 0 };
  const sw = (f: number, a: number) => a * Math.sin(t * f * Math.PI * 2 + ph);
  switch (pose) {
    case "talk":
      j.arms[1] = A(0.55 + sw(0.9, 0.25), 0.25, 1.3 + sw(1.3, 0.25));
      j.arms[0] = A(0.15 + sw(0.7, 0.12), 0.12, 0.5);
      j.pitch = sw(1.1, 0.06);
      j.yaw += sw(0.4, 0.15);
      break;
    case "walk":
    case "run": {
      const run = pose === "run";
      const f = run ? 2.5 : 1.7;
      const s = Math.sin(t * f * Math.PI * 2 + ph);
      const a = run ? 0.85 : 0.5;
      j.legs = [L(a * s, 0.02, (run ? 1.1 : 0.5) * Math.max(0, -s) + 0.08), L(-a * s, 0.02, (run ? 1.1 : 0.5) * Math.max(0, s) + 0.08)];
      j.arms = [A(-a * s * 0.9, 0.1, run ? 1.4 : 0.35), A(a * s * 0.9, 0.1, run ? 1.4 : 0.35)];
      j.lean = run ? 0.25 : 0.05;
      j.y = Math.abs(Math.cos(t * f * Math.PI * 2 + ph)) * (run ? 0.06 : 0.025);
      break;
    }
    case "wave":
      j.arms[1] = A(2.5, 0.35 + sw(1.8, 0.3), 0.4);
      j.roll = 0.08;
      break;
    case "point":
      j.arms[1] = A(1.45 + sw(0.5, 0.05), 0.15, 0.05);
      j.lean = -0.04;
      break;
    case "shrug":
      j.arms = [A(0.25, 0.55, 1.5), A(0.25, 0.55, 1.5)];
      j.roll = 0.12;
      j.y = 0.012;
      break;
    case "phone":
      j.arms[1] = A(0.75, 0.05, 1.9);
      j.arms[0] = A(0.55, 0.0, 1.7);
      j.pitch = 0.32;
      break;
    case "phoneUp":
      j.arms[1] = A(2.9 + sw(0.8, 0.08), 0.15, 0.1);
      j.pitch = -0.4;
      j.y = 0.02 * Math.abs(Math.sin(t * 4));
      break;
    case "carryHead":
      j.arms = [A(2.6, 0.45, 1.25), A(2.6, 0.45, 1.25)];
      break;
    case "carryShoulder":
      j.arms[1] = A(2.2, 0.35, 2.3);
      j.arms[0] = A(-0.2 + sw(0.8, 0.2), 0.15, 0.4);
      j.lean = 0.18;
      j.roll = -0.1;
      break;
    case "stir":
      j.arms = [A(0.75 + sw(3, 0.06), 0.02, 1.65), A(0.75 - sw(3, 0.06), 0.02, 1.65)];
      j.pitch = 0.3;
      j.lean = 0.1;
      break;
    case "fan":
      j.arms[1] = A(0.7, 0.1 + sw(2.2, 0.25), 2.1);
      break;
    case "cheer":
      j.arms = [A(2.8, 0.5 + sw(2, 0.15), 0.2), A(2.8, 0.5 - sw(2, 0.15), 0.2)];
      j.y = Math.abs(Math.sin(t * 6)) * 0.06;
      j.pitch = -0.15;
      break;
    case "facepalm":
      j.arms[1] = A(1.05, 0.05, 2.55);
      j.pitch = 0.35;
      j.yaw = 0;
      break;
    case "hips":
      j.arms = [A(-0.15, 0.65, 2.1), A(-0.15, 0.65, 2.1)];
      j.lean = -0.04;
      break;
    case "crossed":
      j.arms = [A(0.55, -0.25, 2.15), A(0.6, -0.25, 2.1)];
      j.lean = -0.05;
      break;
    case "sit":
      j.legs = [L(1.5, 0.08, 1.5), L(1.5, 0.08, 1.5)];
      j.y = -0.4;
      j.arms = [A(0.35, 0.12, 0.9), A(0.35, 0.12, 0.9)];
      break;
    case "sitFloor":
      j.legs = [L(1.45, 0.55, 2.3), L(1.45, 0.55, 2.3)];
      j.y = -0.7;
      j.arms = [A(0.45, 0.2, 1.0), A(0.45, 0.2, 1.0)];
      j.lean = 0.08;
      break;
    case "holdBook":
      j.arms = [A(0.8, 0.22, 1.0), A(0.8, 0.22, 1.0)];
      j.pitch = 0.3;
      break;
    case "shock":
      j.arms = [A(0.55, 0.45, 1.3), A(0.55, 0.45, 1.3)];
      j.lean = -0.1;
      j.y = 0.015;
      break;
    case "dab":
      j.arms[0] = A(2.4, 0.6, 0.0);
      j.arms[1] = A(1.3, -0.4, 2.3);
      j.pitch = 0.35;
      j.yaw = -0.6;
      break;
    case "offer":
      j.arms[1] = A(1.15, 0.05, 0.6);
      j.lean = 0.05;
      break;
    case "pray":
      j.arms = [A(0.7, -0.15, 2.0), A(0.7, -0.15, 2.0)];
      j.pitch = 0.2;
      break;
    case "hug":
      j.arms = [A(1.2, -0.1, 1.4), A(1.2, -0.1, 1.4)];
      j.lean = 0.08;
      break;
    default:
      break;
  }
  return j;
};

const M: React.FC<{ c: string; map?: ReturnType<typeof fabric>; r?: number; m?: number; e?: number; side?: boolean; o?: number }> = ({ c, map, r = 0.75, m = 0, e = 0, side, o }) => (
  <meshStandardMaterial
    color={map ? "#ffffff" : c}
    map={map ?? null}
    roughness={r}
    metalness={m}
    emissive={c}
    emissiveIntensity={e}
    side={side ? DoubleSide : undefined}
    transparent={o !== undefined}
    opacity={o ?? 1}
  />
);

const Cap: React.FC<{ r: number; len: number; y: number; children: React.ReactNode; sx?: number; sz?: number }> = ({ r, len, y, children, sx = 1, sz = 1 }) => (
  <mesh position={[0, y, 0]} scale={[sx, 1, sz]} castShadow>
    <capsuleGeometry args={[r, len, 4, 12]} />
    {children}
  </mesh>
);

/* ---------------------------------------------------------------- roblox-style head */
export const HEAD_R = 0.136; // radius
export const HEAD_HH = 0.12; // half height
const HEAD_RC = 0.045; // edge rounding
const FACE_ARC = 1.92; // radians of the front covered by the face decal
const FACE_HALF = HEAD_HH - HEAD_RC; // decal sits on the straight part only

const headGeo = (() => {
  const pts: Vector2[] = [new Vector2(0, -HEAD_HH)];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 8; i++) {
      const a = a0 + ((a1 - a0) * i) / 8;
      pts.push(new Vector2(cx + Math.cos(a) * HEAD_RC, cy + Math.sin(a) * HEAD_RC));
    }
  };
  arc(HEAD_R - HEAD_RC, -HEAD_HH + HEAD_RC, -Math.PI / 2, 0);
  arc(HEAD_R - HEAD_RC, HEAD_HH - HEAD_RC, 0, Math.PI / 2);
  pts.push(new Vector2(0, HEAD_HH));
  return new LatheGeometry(pts, 40);
})();

const blinkAt = (seed: string, t: number) => {
  const period = 2.6 + random(`${seed}-blink`) * 2.4;
  return (t + random(`${seed}-bo`) * period) % period < 0.13;
};

const RHair: React.FC<{ spec: Spec }> = ({ spec }) => {
  const c = spec.hairColor;
  const mat = <meshStandardMaterial color={c} roughness={0.8} />;
  const R = HEAD_R + 0.012;
  const hatted = !!spec.hat && spec.hat !== "veil";
  // short cap: crown + band down to the hairline, plus the back of the head
  const cap = (low = 0.062) => (
    <group>
      <mesh position={[0, HEAD_HH + 0.004, 0]} scale={[1, 0.32, 1]} castShadow>
        <sphereGeometry args={[R, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        {mat}
      </mesh>
      <mesh position={[0, (HEAD_HH + low) / 2, 0]} castShadow>
        <cylinderGeometry args={[R, R, HEAD_HH - low, 28, 1, true]} />
        <meshStandardMaterial color={c} roughness={0.8} side={DoubleSide} />
      </mesh>
      <mesh position={[0, -0.01, 0]} castShadow>
        <cylinderGeometry args={[R, R * 0.97, HEAD_HH * 2 - 0.05, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76]} />
        <meshStandardMaterial color={c} roughness={0.8} side={DoubleSide} />
      </mesh>
    </group>
  );
  const blob = (p: V3, r: number, col = c, k = 0) => (
    <mesh key={k} position={p} castShadow>
      <sphereGeometry args={[r, 12, 10]} />
      <meshStandardMaterial color={col} roughness={0.8} />
    </mesh>
  );
  switch (spec.hair) {
    case "none":
      return null;
    case "bald":
      return (
        <mesh position={[0, -0.005, 0]} castShadow>
          <cylinderGeometry args={[R, R, 0.07, 28, 1, true, Math.PI * 0.45, Math.PI * 1.1]} />
          <meshStandardMaterial color={c} roughness={0.85} side={DoubleSide} />
        </mesh>
      );
    case "tonsure":
      return (
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[HEAD_R + 0.004, 0.024, 8, 32]} />
          {mat}
        </mesh>
      );
    case "afro":
      return (
        <group>
          {cap()}
          {blob([0, 0.1, -0.03], 0.2)}
        </group>
      );
    case "curly":
    case "fluffy": {
      const curly = spec.hair === "curly";
      const n = curly ? 22 : 12;
      return (
        <group>
          {cap()}
          {hatted
            ? null
            : Array.from({ length: n }).map((_, i) => {
                const a = (i / n) * Math.PI * 2 + random(`${spec.seed}-ha${i}`) * 0.4;
                const rr = (0.45 + random(`${spec.seed}-hr${i}`) * 0.55) * R;
                const top = spec.hairTips && i % 3 === 0 ? spec.hairTips : c;
                return blob([Math.sin(a) * rr, HEAD_HH + 0.02 + random(`${spec.seed}-hy${i}`) * 0.03, Math.cos(a) * rr - 0.01], curly ? 0.042 : 0.055, top, i);
              })}
          {/* fringe swoop over the forehead */}
          <mesh position={[0.02, 0.085, HEAD_R - 0.005]} rotation={[0.35, 0.15, -0.35]} scale={[1.5, 0.45, 0.5]} castShadow>
            <sphereGeometry args={[0.055, 14, 10]} />
            <meshStandardMaterial color={spec.hairTips ?? c} roughness={0.8} />
          </mesh>
        </group>
      );
    }
    case "bun":
      return (
        <group>
          {cap()}
          {hatted ? null : blob([0, 0.11, -0.12], 0.065)}
        </group>
      );
    case "long":
      return (
        <group>
          {cap()}
          <mesh position={[0, -0.1, -0.06]} scale={[1, 1, 0.6]} castShadow>
            <cylinderGeometry args={[R, R + 0.02, 0.3, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
            <meshStandardMaterial color={c} roughness={0.8} side={DoubleSide} />
          </mesh>
        </group>
      );
    case "braid":
    case "queue": {
      const q = spec.hair === "queue";
      return (
        <group>
          {q ? (
            <mesh position={[0, 0.0, 0]} castShadow>
              <cylinderGeometry args={[R, R, HEAD_HH * 2 - 0.02, 28, 1, true, Math.PI * 0.6, Math.PI * 0.8]} />
              <meshStandardMaterial color={c} roughness={0.8} side={DoubleSide} />
            </mesh>
          ) : (
            cap()
          )}
          {Array.from({ length: q ? 10 : 6 }).map((_, i) => blob([0, -0.06 - i * 0.055, -R - 0.005 - Math.min(i, 2) * 0.01], 0.03 - i * 0.0012, c, i))}
        </group>
      );
    }
    case "ponytail":
      return (
        <group>
          {cap()}
          <mesh position={[0, 0.02, -R - 0.03]} rotation={[0.35, 0, 0]} castShadow>
            <capsuleGeometry args={[0.04, 0.16, 4, 10]} />
            {mat}
          </mesh>
        </group>
      );
    default:
      return cap();
  }
};

const RobloxHead: React.FC<{ spec: Spec; expr: Expr; t: number; mouth: number }> = ({ spec, expr, t, mouth }) => {
  const m = mouth < 0.1 ? 0 : mouth < 0.4 ? 1 : mouth < 0.7 ? 2 : 3;
  const browCol = spec.hairColor === "#d8d4cc" || spec.hairColor === "#9d978f" ? "#8a847b" : spec.hair === "tonsure" ? "#5a3d26" : spec.hairColor;
  const face = faceTexture({
    skin: spec.skin,
    brow: browCol,
    expr,
    blink: blinkAt(spec.seed, t),
    mouth: m as 0 | 1 | 2 | 3,
    beard: spec.beard,
    beardColor: spec.hairColor,
    kid: spec.kid,
  });
  return (
    <group>
      <mesh geometry={headGeo} castShadow>
        <meshStandardMaterial color={spec.skin} roughness={0.55} emissive={spec.skin} emissiveIntensity={0.04} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[HEAD_R + 0.0015, HEAD_R + 0.0015, FACE_HALF * 2, 32, 1, true, -FACE_ARC / 2, FACE_ARC]} />
        <meshStandardMaterial map={face} roughness={0.55} emissive={spec.skin} emissiveIntensity={0.04} />
      </mesh>
      {spec.glasses ? (
        <group position={[0, 0.012, HEAD_R + 0.012]}>
          {[1, -1].map((sd) => (
            <mesh key={sd} position={[sd * 0.036, 0, 0]}>
              <torusGeometry args={[0.03, 0.0045, 6, 20]} />
              <meshStandardMaterial color="#2a2018" metalness={0.4} roughness={0.3} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.014, 0.004, 0.004]} />
            <meshStandardMaterial color="#2a2018" />
          </mesh>
        </group>
      ) : null}
      {spec.earbuds
        ? [1, -1].map((sd) => (
            <mesh key={sd} position={[sd * (HEAD_R + 0.004), -0.01, 0.0]}>
              <sphereGeometry args={[0.016, 10, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
          ))
        : null}
      <RHair spec={spec} />
      <HatMesh spec={spec} />
    </group>
  );
};

const HatMesh: React.FC<{ spec: Spec }> = ({ spec }) => {
  const c = spec.hatColor ?? "#d8b36a";
  const map = fabric(c, spec.hatPattern ?? (spec.hat === "salakot" || spec.hat === "straw" ? { kind: "weave", colors: [c, "#b98b45"] } : undefined), spec.hatPattern ? [1.5, 1] : [2.5, 2.5]);
  switch (spec.hat) {
    case "salakot":
      return (
        <group position={[0, 0.115, -0.005]} rotation={[-0.12, 0, 0]}>
          <mesh position={[0, 0.03, 0]} castShadow>
            <coneGeometry args={[0.31, 0.17, 24, 1, true]} />
            <M c={c} map={map} r={0.9} side />
          </mesh>
          <mesh position={[0, 0.125, 0]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <M c="#c9a14a" m={0.6} r={0.3} />
          </mesh>
        </group>
      );
    case "straw":
      return (
        <group position={[0, 0.1, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.01, 24]} />
            <M c={c} map={map} r={0.9} />
          </mesh>
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.15, 0.1, 18]} />
            <M c={c} map={map} r={0.9} />
          </mesh>
        </group>
      );
    case "bucket":
      return (
        <group position={[0, 0.125, -0.005]} rotation={[-0.16, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.153, 0.1, 28]} />
            <M c={c} map={map} r={0.85} />
          </mesh>
          <mesh position={[0, -0.05, 0]} castShadow>
            <cylinderGeometry args={[0.153, 0.21, 0.035, 28, 1, true]} />
            <M c={c} map={map} r={0.85} side />
          </mesh>
        </group>
      );
    case "kepi":
      return (
        <group position={[0, 0.12, 0]} rotation={[-0.08, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.135, 0.15, 0.14, 24]} />
            <M c={c} r={0.6} />
          </mesh>
          <mesh position={[0, -0.045, 0]}>
            <cylinderGeometry args={[0.152, 0.152, 0.035, 24]} />
            <M c="#c8202e" r={0.6} />
          </mesh>
          <mesh position={[0, -0.065, 0.12]} rotation={[-0.25, 0, 0]} scale={[1, 1, 0.6]}>
            <cylinderGeometry args={[0.13, 0.13, 0.012, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <M c="#111" r={0.3} />
          </mesh>
        </group>
      );
    case "tophat":
      return (
        <group position={[0, 0.2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.145, 0.22, 24]} />
            <M c={c} r={0.4} />
          </mesh>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.012, 22]} />
            <M c={c} r={0.4} />
          </mesh>
        </group>
      );
    case "cap":
      return (
        <group position={[0, 0.095, 0]} rotation={[-0.12, 0, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <M c={c} r={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.15]} rotation={[0.15, 0, 0]} scale={[1, 1, 0.7]}>
            <cylinderGeometry args={[0.12, 0.12, 0.012, 20, 1, false, -Math.PI / 2, Math.PI]} />
            <M c={c} r={0.7} />
          </mesh>
        </group>
      );
    case "skullcap":
      return (
        <mesh position={[0, 0.075, 0]} rotation={[-0.1, 0, 0]} castShadow>
          <sphereGeometry args={[0.152, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <M c={c} r={0.6} />
        </mesh>
      );
    case "veil":
      return (
        <mesh position={[0, 0.02, -0.02]} rotation={[-0.3, 0, 0]} castShadow>
          <sphereGeometry args={[0.175, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <M c={c} r={0.8} side o={0.85} />
        </mesh>
      );
    default:
      return null;
  }
};

/* ---------------------------------------------------------------- props */
const PropMesh: React.FC<{ prop: Prop; t: number }> = ({ prop, t }) => {
  switch (prop) {
    case "phone":
    case "phoneLit":
      return (
        <group position={[0, -0.03, 0.05]} rotation={[0.2, Math.PI, 0]}>
          <mesh>
            <boxGeometry args={[0.075, 0.15, 0.009]} />
            <meshStandardMaterial color="#1b1b22" metalness={0.5} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, -0.0052]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.068, 0.142]} />
            <meshBasicMaterial color={prop === "phoneLit" ? "#9fe8ff" : "#0b0b10"} />
          </mesh>
        </group>
      );
    case "cup":
      return (
        <group position={[0, -0.05, 0.04]}>
          <mesh>
            <cylinderGeometry args={[0.045, 0.036, 0.15, 16, 1, true]} />
            <meshPhysicalMaterial color="#ffffff" transparent opacity={0.35} roughness={0.1} side={DoubleSide} />
          </mesh>
          <mesh position={[0, -0.015, 0]}>
            <cylinderGeometry args={[0.041, 0.035, 0.11, 16]} />
            <meshStandardMaterial color="#c79a6b" roughness={0.4} />
          </mesh>
          <mesh position={[0.02, 0.1, 0]} rotation={[0, 0, 0.2]}>
            <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
            <meshStandardMaterial color="#ff4fa3" />
          </mesh>
        </group>
      );
    case "fan":
      return (
        <mesh position={[0, -0.02, 0.05]} rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.16, 0.16, 0.004, 20, 1, false, -Math.PI / 2.6, Math.PI / 1.3]} />
          <meshStandardMaterial color="#e2445c" roughness={0.6} side={DoubleSide} />
        </mesh>
      );
    case "lance":
      return (
        <group position={[0, -0.06, 0.02]} rotation={[Math.PI / 2 - 0.15, 0, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.014, 0.016, 2.0, 8]} />
            <meshStandardMaterial color="#c8a35c" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <coneGeometry args={[0.03, 0.14, 8]} />
            <meshStandardMaterial color="#b9c2c9" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      );
    case "cane":
      return (
        <mesh position={[0, -0.4, 0.02]}>
          <cylinderGeometry args={[0.012, 0.012, 0.9, 8]} />
          <meshStandardMaterial color="#2b1a10" roughness={0.4} />
        </mesh>
      );
    case "parasol":
      return (
        <group position={[0, -0.05, 0]}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.95, 6]} />
            <meshStandardMaterial color="#5a3b22" />
          </mesh>
          <mesh position={[0, 0.88, 0]} castShadow>
            <coneGeometry args={[0.42, 0.18, 16, 1, true]} />
            <meshStandardMaterial color="#ff8fb1" roughness={0.7} side={DoubleSide} />
          </mesh>
        </group>
      );
    case "batirol":
      return (
        <group position={[0.06, -0.02, 0.06]} rotation={[0, t * 12, 0]}>
          <mesh position={[0, 0.0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.35, 8]} />
            <meshStandardMaterial color="#8a5a2b" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.17, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
            <meshStandardMaterial color="#8a5a2b" roughness={0.6} />
          </mesh>
        </group>
      );
    case "stone":
      return (
        <mesh position={[0.02, 0.06, 0.0]} rotation={[0.2, 0.3, 0.1]} castShadow>
          <boxGeometry args={[0.32, 0.2, 0.22]} />
          <meshStandardMaterial color="#b8ab92" roughness={0.95} />
        </mesh>
      );
    case "coin":
      return (
        <mesh position={[0, -0.03, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.004, 16]} />
          <meshStandardMaterial color="#e6e8ea" metalness={0.9} roughness={0.2} />
        </mesh>
      );
    default:
      return null;
  }
};

/* ---------------------------------------------------------------- person */
export const Person: React.FC<{
  spec: Spec;
  pose?: Pose;
  expr?: Expr;
  t: number;
  mouth?: number;
  look?: [number, number];
  headTurn?: number;
  position?: V3;
  rotation?: number;
  detail?: boolean;
}> = ({ spec, pose = "idle", expr = "neutral", t, mouth = 0, look = [0, 0], headTurn = 0, position = [0, 0, 0], rotation = 0, detail = true }) => {
  const ph = random(`${spec.seed}-ph`) * 6.28;
  const j = joints(pose, t, ph);
  if (spec.outfit === "baro" || spec.outfit === "dress" || spec.outfit === "friar") {
    // small steps under long skirts so legs never poke through the fabric
    j.legs = j.legs.map((l) => ({ lift: l.lift * 0.28, spread: Math.min(l.spread, 0.04), knee: l.knee * 0.3 })) as J["legs"];
  }
  const kid = !!spec.kid;
  const s = spec.height / (kid ? 1.25 : 1.7);
  const head = kid ? 1.12 : 1;
  const b = spec.build;
  const o = spec.outfit;
  const skin = <M c={spec.skin} r={0.55} e={0.04} />;
  const top = fabric(spec.top, spec.topPattern, [2, 2]);
  const bottom = fabric(spec.bottom, spec.bottomPattern, [1, 2]);
  const accentMap = spec.accent ? fabric(spec.accent, spec.accentPattern, [2, 2]) : null;
  const topMat = <M c={spec.top} map={top} r={o === "barong" ? 0.5 : 0.8} />;
  const botMat = <M c={spec.bottom} map={bottom} r={0.85} />;
  const shortSleeve = o === "tee" || o === "barista";
  const skirt = o === "baro" || o === "dress" || o === "friar";
  const tunic = o === "changshan";
  const barefoot = spec.shoes === null;
  const torsoR = 0.165 * b;

  // hip height for kids is a bit lower relative to head
  const hipY = kid ? 0.62 : 0.86;
  const shY = kid ? 1.0 : 1.38;
  const headY = kid ? 1.15 : 1.6;
  const thigh = kid ? 0.28 : 0.39;
  const shin = kid ? 0.28 : 0.39;
  const upper = kid ? 0.2 : 0.28;
  const fore = kid ? 0.19 : 0.26;

  const legMesh = (i: 0 | 1) => {
    const leg = j.legs[i];
    const side = i === 0 ? 1 : -1;
    const rolled = o === "camisa" || o === "cuadrillero";
    return (
      <group key={i} position={[side * 0.09 * b, hipY, 0]} rotation={[-leg.lift, 0, side * leg.spread]}>
        <Cap r={0.072 * Math.max(0.9, b * 0.9)} len={thigh - 0.1} y={-thigh / 2}>
          {botMat}
        </Cap>
        <group position={[0, -thigh, 0]} rotation={[leg.knee, 0, 0]}>
          <Cap r={0.058} len={shin - 0.1} y={-shin / 2}>
            {rolled ? skin : o === "officer" ? <M c="#14110f" r={0.3} /> : botMat}
          </Cap>
          {rolled ? (
            <mesh position={[0, -0.08, 0]}>
              <cylinderGeometry args={[0.068, 0.068, 0.07, 12]} />
              {botMat}
            </mesh>
          ) : null}
          <mesh position={[0, -shin + 0.0, 0.045]} castShadow>
            <boxGeometry args={[barefoot ? 0.085 : 0.1, barefoot ? 0.05 : 0.075, barefoot ? 0.2 : 0.24]} />
            {barefoot ? skin : <M c={spec.shoes!} r={0.5} />}
          </mesh>
          {o === "hoodie" || o === "tee" || o === "barista" ? (
            <mesh position={[0, -shin - 0.03, 0.05]}>
              <boxGeometry args={[0.11, 0.035, 0.26]} />
              <M c="#f4f1ea" r={0.6} />
            </mesh>
          ) : null}
        </group>
      </group>
    );
  };

  const armMesh = (i: 0 | 1) => {
    const arm = j.arms[i];
    const side = i === 0 ? 1 : -1;
    const sleeveC = o === "friar" ? "#f4f1ea" : spec.top;
    const sleeve = <M c={sleeveC} map={o === "friar" ? null : top} r={0.8} />;
    const holdsProp = i === 1 && spec.prop;
    return (
      <group key={i} position={[side * (torsoR + 0.035), shY, 0]} rotation={[-arm.raise, 0, side * arm.out]}>
        <Cap r={0.052} len={upper - 0.06} y={-upper / 2}>
          {sleeve}
        </Cap>
        {o === "baro" ? (
          <mesh position={[0, -upper * 0.8, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.13, upper * 0.9, 14, 1, true]} />
            <M c={spec.top} map={top} r={0.6} side o={0.92} />
          </mesh>
        ) : null}
        <group position={[0, -upper, 0]} rotation={[-arm.elbow, 0, 0]}>
          <Cap r={0.044} len={fore - 0.06} y={-fore / 2}>
            {shortSleeve ? skin : sleeve}
          </Cap>
          <mesh position={[0, -fore - 0.02, 0.005]} scale={[0.85, 1.1, 0.7]} castShadow>
            <sphereGeometry args={[0.05, 12, 10]} />
            {skin}
          </mesh>
          {holdsProp ? (
            <group position={[0, -fore - 0.04, 0]} rotation={[arm.elbow * 0.6, 0, 0]}>
              <PropMesh prop={spec.prop!} t={t} />
            </group>
          ) : null}
        </group>
      </group>
    );
  };

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={s}>
      <group position={[0, j.y, 0]}>
        {legMesh(0)}
        {legMesh(1)}
        <group position={[0, hipY, 0]} rotation={[j.lean, j.twist, j.side]}>
          <group position={[0, -hipY, 0]}>
            {/* torso */}
            <mesh position={[0, (hipY + shY) / 2 + 0.01, 0]} scale={[1, 1, 0.74]} castShadow>
              <capsuleGeometry args={[torsoR, shY - hipY - torsoR * 0.6, 4, 16]} />
              {o === "friar" ? <M c="#f4f1ea" r={0.85} /> : topMat}
            </mesh>
            {spec.belly ? (
              <mesh position={[0, hipY + 0.17, 0.03]} scale={[1.15, 0.95, 0.8]} castShadow>
                <sphereGeometry args={[0.1 * spec.belly + 0.08, 16, 12]} />
                {topMat}
              </mesh>
            ) : null}
            {/* waist / lower garments */}
            {skirt ? (
              <mesh position={[0, (hipY + 0.12) / 2, 0]} castShadow>
                <cylinderGeometry args={[torsoR * 1.05, o === "dress" ? 0.42 : 0.33, hipY + 0.1, 24, 1, true]} />
                {o === "friar" ? <M c="#f4f1ea" r={0.85} side /> : <M c={spec.bottom} map={bottom} r={0.8} side />}
              </mesh>
            ) : null}
            {o === "baro" && spec.accent ? (
              <mesh position={[0, hipY - 0.2, 0.0]} castShadow>
                <cylinderGeometry args={[torsoR * 1.12, 0.3, 0.46, 24, 1, true]} />
                <M c={spec.accent} map={accentMap} r={0.8} side />
              </mesh>
            ) : null}
            {tunic || o === "barong" || o === "european" || o === "officer" || o === "hoodie" ? (
              <mesh position={[0, tunic ? hipY - 0.22 : hipY - 0.03, 0]} castShadow>
                <cylinderGeometry args={[torsoR * 1.02, torsoR * (tunic ? 1.5 : 1.15), tunic ? 0.62 : 0.2, 20, 1, true]} />
                {o === "european" ? <M c={spec.top} r={0.6} side /> : <M c={spec.top} map={top} r={0.7} side />}
              </mesh>
            ) : null}
            {o === "european" ? (
              <mesh position={[0, hipY - 0.25, -0.05]} castShadow>
                <cylinderGeometry args={[torsoR * 1.05, torsoR * 1.3, 0.5, 20, 1, true, Math.PI * 0.6, Math.PI * 0.8]} />
                <M c={spec.top} r={0.6} side />
              </mesh>
            ) : null}
            {/* sash / belt */}
            {o === "officer" || o === "cuadrillero" || o === "friar" ? (
              <mesh position={[0, hipY + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.74, 1]}>
                <torusGeometry args={[torsoR * 1.02, 0.03, 8, 24]} />
                <M c={o === "friar" ? "#1b1512" : "#c8202e"} r={0.7} />
              </mesh>
            ) : null}
            {/* officer buttons + epaulettes */}
            {o === "officer" ? (
              <group>
                {[0, 1, 2, 3, 4].map((k) => (
                  <mesh key={k} position={[0, hipY + 0.14 + k * 0.08, torsoR * 0.76]}>
                    <sphereGeometry args={[0.012, 8, 6]} />
                    <M c="#f2c84b" m={0.9} r={0.25} />
                  </mesh>
                ))}
                {[1, -1].map((sd) => (
                  <mesh key={sd} position={[sd * (torsoR + 0.01), shY + 0.02, 0]}>
                    <boxGeometry args={[0.1, 0.025, 0.12]} />
                    <M c="#f2c84b" m={0.8} r={0.3} />
                  </mesh>
                ))}
              </group>
            ) : null}
            {/* pañuelo (shawl) */}
            {o === "baro" ? (
              <mesh position={[0, shY - 0.06, 0]} castShadow>
                <cylinderGeometry args={[0.09, torsoR * 1.45, 0.2, 20, 1, true]} />
                <M c={spec.accent ?? "#fff"} map={accentMap} r={0.7} side />
              </mesh>
            ) : null}
            {/* friar cape + hood */}
            {o === "friar" ? (
              <group>
                <mesh position={[0, shY - 0.42, 0]} castShadow>
                  <cylinderGeometry args={[torsoR * 1.15, 0.36, 0.86, 22, 1, true, Math.PI * 0.18, Math.PI * 1.64]} />
                  <M c="#16110e" r={0.8} side />
                </mesh>
                <mesh position={[0, shY + 0.03, -0.06]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
                  <torusGeometry args={[0.12, 0.045, 8, 20, Math.PI]} />
                  <M c="#16110e" r={0.8} />
                </mesh>
              </group>
            ) : null}
            {/* hoodie hood + pocket + print */}
            {o === "hoodie" ? (
              <group>
                <mesh position={[0, shY + 0.02, -0.07]} rotation={[Math.PI / 2 - 0.4, 0, 0]}>
                  <torusGeometry args={[0.12, 0.05, 10, 22, Math.PI]} />
                  {topMat}
                </mesh>
                <mesh position={[0, hipY + 0.12, torsoR * 0.72]} scale={[1, 0.6, 0.3]}>
                  <sphereGeometry args={[0.11, 14, 8]} />
                  {topMat}
                </mesh>
                {[1, -1].map((sd) => (
                  <mesh key={sd} position={[sd * 0.04, shY - 0.12, torsoR * 0.78]}>
                    <cylinderGeometry args={[0.005, 0.005, 0.16, 6]} />
                    <M c="#ffffff" />
                  </mesh>
                ))}
                {spec.print ? (
                  <mesh position={[0, shY - 0.2, torsoR * 0.745 + 0.004]}>
                    <planeGeometry args={[0.2, 0.1]} />
                    <meshStandardMaterial map={fabric("#00000000", { kind: "print", colors: ["#d7ff3a"], text: spec.print })} transparent roughness={0.8} />
                  </mesh>
                ) : null}
              </group>
            ) : null}
            {o === "barista" ? (
              <mesh position={[0, hipY + 0.05, torsoR * 0.72]} castShadow>
                <boxGeometry args={[0.26, 0.6, 0.02]} />
                <M c={spec.accent ?? "#3d2b1f"} r={0.8} />
              </mesh>
            ) : null}
            {o === "barong" || o === "camisa" || o === "european" ? (
              <mesh position={[0, shY + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.06, 0.018, 6, 16]} />
                <M c={o === "european" ? "#ffffff" : spec.top} map={o === "european" ? null : top} r={0.6} />
              </mesh>
            ) : null}
            {/* neck */}
            <mesh position={[0, shY + 0.05, 0]}>
              <cylinderGeometry args={[0.048, 0.055, 0.12, 12]} />
              {skin}
            </mesh>
            {armMesh(0)}
            {armMesh(1)}
            {/* head */}
            <group position={[0, headY, 0]} rotation={[j.pitch, j.yaw + headTurn, j.roll]} scale={head}>
              <RobloxHead spec={spec} expr={expr} t={t} mouth={mouth} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
