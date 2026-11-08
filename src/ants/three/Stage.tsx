import { useLayoutEffect } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { HEIGHT, WIDTH, type V3 } from "../lib";

/** Frame-driven camera: sets position / look-at on every render (deterministic). */
export const Cam: React.FC<{ position: V3; target: V3; fov?: number; roll?: number }> = ({
  position,
  target,
  fov = 40,
  roll = 0,
}) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(...target);
    camera.fov = fov;
    camera.near = 0.05;
    camera.far = 30000;
    camera.updateProjectionMatrix();
  });
  return null;
};

type StageProps = {
  bg: string;
  fog?: [string, number, number];
  sun?: { position: V3; intensity?: number; color?: string; shadow?: number };
  hemi?: [string, string, number];
  ambient?: number;
  children: React.ReactNode;
};

export const Stage: React.FC<StageProps> = ({ bg, fog, sun, hemi = ["#fff4e0", "#5b4636", 0.9], ambient = 0.15, children }) => {
  const s = sun?.shadow ?? 0;
  return (
    <ThreeCanvas width={WIDTH} height={HEIGHT} shadows={s > 0} gl={{ antialias: true }} dpr={1}>
      <color attach="background" args={[bg]} />
      {fog ? <fog attach="fog" args={fog} /> : null}
      <hemisphereLight args={hemi} />
      <ambientLight intensity={ambient} />
      {sun ? (
        <directionalLight
          position={sun.position}
          intensity={sun.intensity ?? 2.2}
          color={sun.color ?? "#ffe3b8"}
          castShadow={s > 0}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-s}
          shadow-camera-right={s}
          shadow-camera-top={s}
          shadow-camera-bottom={-s}
          shadow-camera-near={0.5}
          shadow-camera-far={Math.hypot(...sun.position) * 2.5}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
      ) : null}
      {children}
    </ThreeCanvas>
  );
};
