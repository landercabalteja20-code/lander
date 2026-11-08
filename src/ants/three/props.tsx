import { useLayoutEffect, useMemo, useRef } from "react";
import { random } from "remotion";
import { BufferGeometry, Color, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { V3 } from "../lib";

type Placement = { p: V3; r?: V3; s?: V3; color?: string } | null;

/** Instanced scatter of one geometry; `place` decides transform per instance (seeded rng). */
export const Scatter: React.FC<{
  count: number;
  seed: string;
  place: (i: number, rnd: (k: string) => number) => Placement;
  children: React.ReactNode;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** re-run placement every frame (for animated instances) */
  frame?: number;
}> = ({ count, seed, place, children, castShadow, receiveShadow, frame }) => {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current!;
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Euler();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const o = place(i, (k) => random(`${seed}-${i}-${k}`));
      if (!o) {
        m.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, m);
        continue;
      }
      e.set(...(o.r ?? [0, 0, 0]));
      q.setFromEuler(e);
      m.compose(new Vector3(...o.p), q, new Vector3(...(o.s ?? [1, 1, 1])));
      mesh.setMatrixAt(i, m);
      if (o.color) mesh.setColorAt(i, c.set(o.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow={castShadow} receiveShadow={receiveShadow} frustumCulled={false}>
      {children}
    </instancedMesh>
  );
};

/** A raindrop: slightly flattened sphere (real drops aren't tear-shaped). */
export const WaterMaterial: React.FC<{ opacity?: number }> = ({ opacity = 0.72 }) => (
  <meshPhysicalMaterial color="#cfe8ff" roughness={0.04} metalness={0} clearcoat={1} clearcoatRoughness={0.05} transparent opacity={opacity} emissive="#5d7fa3" emissiveIntensity={0.25} />
);

/** Splash at a point; `age` = frames since impact. */
export const Splash: React.FC<{ at: V3; age: number; size?: number; seed: string }> = ({ at, age, size = 1, seed }) => {
  if (age < 0 || age > 26) return null;
  const k = age / 26;
  const n = 12;
  return (
    <group position={at} scale={size}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={1 + k * 7}>
        <torusGeometry args={[1, 0.12 * (1 - k) + 0.02, 6, 32]} />
        <WaterMaterial opacity={0.8 * (1 - k)} />
      </mesh>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`${seed}${i}`) * 0.4;
        const v = 0.25 + random(`${seed}v${i}`) * 0.2;
        const up = 0.45 + random(`${seed}u${i}`) * 0.3;
        const x = Math.cos(a) * v * age;
        const z = Math.sin(a) * v * age;
        const y = up * age - 0.03 * age * age;
        if (y < -0.2) return null;
        return (
          <mesh key={i} position={[x, y, z]} scale={0.32 * (1 - k * 0.6)}>
            <sphereGeometry args={[1, 10, 8]} />
            <WaterMaterial />
          </mesh>
        );
      })}
    </group>
  );
};

/** Leaf surface: length along x, width along z, drooping edges. */
export const useLeafGeometry = (length = 70, width = 30, droop = 5) =>
  useMemo(() => {
    const nu = 48;
    const nv = 16;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const half = (width / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), 0.75) * (1 - 0.15 * u);
      for (let j = 0; j <= nv; j++) {
        const v = (j / nv) * 2 - 1;
        const x = (u - 0.5) * length;
        const z = v * half;
        const y = -droop * v * v - 3 * Math.pow(u - 0.45, 2) * 4 + Math.abs(v) * 0.6 * Math.sin(u * 30) * 0.15;
        pos.push(x, y, z);
        uv.push(u, (v + 1) / 2);
      }
    }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j;
        const b = a + nv + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [length, width, droop]);
