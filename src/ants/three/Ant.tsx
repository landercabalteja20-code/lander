import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import type { V3 } from "../lib";

const BODY = { color: "#2a1309", roughness: 0.28, metalness: 0.15 };

/** Cylinder between two points. */
const Seg: React.FC<{ a: V3; b: V3; r: number }> = ({ a, b, r }) => {
  const { pos, quat, len } = useMemo(() => {
    const va = new Vector3(...a);
    const vb = new Vector3(...b);
    const dir = vb.clone().sub(va);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len: dir.length() };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} castShadow>
      <cylinderGeometry args={[r * 0.75, r, len, 6]} />
      <meshStandardMaterial {...BODY} />
    </mesh>
  );
};

const Leg: React.FC<{ side: 1 | -1; z: number; yaw: number; lift: number }> = ({ side, z, yaw, lift }) => {
  const knee: V3 = [side * 0.85, 0.6 + lift, 0];
  const foot: V3 = [side * 1.65, -0.82 + lift * 0.6, 0];
  return (
    <group position={[side * 0.25, 0.85, z]} rotation={[0, -yaw * side, 0]}>
      <Seg a={[0, 0, 0]} b={knee} r={0.09} />
      <Seg a={knee} b={foot} r={0.07} />
    </group>
  );
};

/**
 * Procedural ant (~4.5 units long, i.e. 4.5 mm — 2.5× the shrunk humans).
 * Head points to +z. `t` = seconds, `speed` = gait cycles per second (0 = standing).
 */
export const Ant: React.FC<{ position?: V3; rotation?: number; t: number; speed?: number; scale?: number }> = ({
  position = [0, 0, 0],
  rotation = 0,
  t,
  speed = 2.2,
  scale = 1,
}) => {
  const ph = Math.PI * 2 * speed * t;
  const legs: { side: 1 | -1; z: number; base: number; g: number }[] = [
    { side: 1, z: 0.55, base: 0.65, g: 0 },
    { side: -1, z: 0.15, base: 0, g: 0 },
    { side: 1, z: -0.25, base: -0.65, g: 0 },
    { side: -1, z: 0.55, base: 0.65, g: Math.PI },
    { side: 1, z: 0.15, base: 0, g: Math.PI },
    { side: -1, z: -0.25, base: -0.65, g: Math.PI },
  ];
  const ant = Math.sin(t * 5) * 0.25;
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <group position={[0, speed ? Math.abs(Math.sin(ph)) * 0.04 : 0, 0]}>
        {/* gaster */}
        <mesh position={[0, 1.0, -1.55]} scale={[0.85, 0.72, 1.15]} rotation={[0.25, 0, 0]} castShadow>
          <sphereGeometry args={[1, 24, 18]} />
          <meshStandardMaterial {...BODY} color="#381a0c" />
        </mesh>
        {/* petiole */}
        <mesh position={[0, 0.98, -0.5]} castShadow>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshStandardMaterial {...BODY} />
        </mesh>
        {/* mesosoma */}
        <mesh position={[0, 1.02, 0.2]} scale={[0.38, 0.36, 0.75]} rotation={[-0.2, 0, 0]} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial {...BODY} />
        </mesh>
        {/* head */}
        <group position={[0, 1.18, 1.2]} rotation={[0.15 + Math.sin(t * 1.7) * 0.05, Math.sin(t * 1.1) * 0.12, 0]}>
          <mesh scale={[0.58, 0.5, 0.56]} castShadow>
            <sphereGeometry args={[1, 22, 16]} />
            <meshStandardMaterial {...BODY} />
          </mesh>
          {[1, -1].map((s) => (
            <group key={s}>
              <mesh position={[s * 0.44, 0.08, 0.2]}>
                <sphereGeometry args={[0.15, 12, 10]} />
                <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.4} />
              </mesh>
              {/* mandible */}
              <mesh position={[s * 0.18, -0.22, 0.58]} rotation={[1.4, 0, s * (0.5 + 0.15 * Math.sin(t * 6))]}>
                <coneGeometry args={[0.08, 0.42, 6]} />
                <meshStandardMaterial {...BODY} color="#4a2410" />
              </mesh>
              {/* antenna (elbowed) */}
              <Seg a={[s * 0.2, 0.35, 0.35]} b={[s * 0.55, 1.05, 0.75 + ant * s]} r={0.045} />
              <Seg a={[s * 0.55, 1.05, 0.75 + ant * s]} b={[s * 0.75, 0.75 + ant, 1.85]} r={0.04} />
            </group>
          ))}
        </group>
        {legs.map((l, i) => {
          const sw = Math.sin(ph + l.g);
          return <Leg key={i} side={l.side} z={l.z} yaw={l.base + (speed ? sw * 0.35 : 0)} lift={speed ? Math.max(0, Math.cos(ph + l.g)) * 0.25 : 0} />;
        })}
      </group>
    </group>
  );
};
