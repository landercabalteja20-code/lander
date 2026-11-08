import { ThreeCanvas } from "@remotion/three";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Three.js scene driven by Remotion's frame clock.
 * IMPORTANT: never use useFrame()/clock time from react-three-fiber —
 * derive all motion from useCurrentFrame() so renders are deterministic.
 */
const SpinningKnot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const intro = spring({ frame, fps, config: { damping: 12 } });
  const rotation = frame * 0.02;
  const hue = interpolate(frame, [0, 240], [200, 320]);

  return (
    <mesh rotation={[rotation * 0.6, rotation, 0]} scale={intro}>
      <torusKnotGeometry args={[1, 0.35, 256, 32]} />
      <meshStandardMaterial
        color={`hsl(${hue}, 80%, 60%)`}
        metalness={0.25}
        roughness={0.3}
      />
    </mesh>
  );
};

export const Scene3D: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      camera={{ position: [0, 0, 5], fov: 50 }}
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={2} />
      <pointLight position={[-5, -3, 2]} intensity={30} color="#ff4fd8" />
      <SpinningKnot />
    </ThreeCanvas>
  );
};
