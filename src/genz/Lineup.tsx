import { useCurrentFrame } from "remotion";
import { BARISTA, cuadrillero, crowd1850, FRIAR, KID, LOLA, MIGO, modern, OFFICER, TINDERA, VENDOR } from "./cast";
import { Cam, Clouds, Sky, Stage, drawPlaza, useTex } from "./three/kit";
import { Person, type Expr, type Pose } from "./three/Person";

/** Dev composition: whole cast side by side (+ a face close-up variant). */
export const Lineup: React.FC<{ close?: boolean }> = ({ close }) => {
  const frame = useCurrentFrame();
  const t = frame / 30;
  const plaza = useTex("plaza", drawPlaza, 1024, [8, 8]);
  const cast: { spec: typeof MIGO; pose: Pose; expr: Expr }[] = [
    { spec: MIGO, pose: "phone", expr: "worried" },
    { spec: LOLA, pose: "fan", expr: "happy" },
    { spec: VENDOR, pose: "shrug", expr: "shock" },
    { spec: TINDERA, pose: "stir", expr: "laugh" },
    { spec: OFFICER, pose: "holdBook", expr: "angry" },
    { spec: cuadrillero(0), pose: "idle", expr: "neutral" },
    { spec: FRIAR, pose: "crossed", expr: "smug" },
    { spec: KID, pose: "wave", expr: "happy" },
    { spec: BARISTA, pose: "talk", expr: "happy" },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ spec: crowd1850(i + 3), pose: "talk" as Pose, expr: "happy" as Expr })),
    { spec: modern(1), pose: "idle", expr: "neutral" },
  ];
  const cols = 6;
  return (
    <Stage bg="#9fd3ff" fog={["#bfe3ff", 40, 140]} sun={{ position: [8, 14, 10], intensity: 2.8, shadow: 12 }} hemi={["#dff1ff", "#a07a50", 1.0]} rim={{ position: [-6, 5, -8], color: "#ffd0a0", intensity: 1.2 }}>
      {close ? (
        <Cam position={[0.3, 1.62, 1.1]} target={[0, 1.55, 0]} fov={30} />
      ) : (
        <Cam position={[0, 2.2, 11.5]} target={[0, 1.1, 0]} fov={42} />
      )}
      <Sky top="#3d8fe0" mid="#8cc8ff" horizon="#ffe6c4" />
      <Clouds seed="lu" t={t} n={6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={plaza} roughness={1} />
      </mesh>
      {cast.map((c, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = close ? 0 : (col - (cols - 1) / 2) * 1.05;
        const z = close ? 0 : -row * 1.6;
        if (close && i > 0) return null;
        return <Person key={i} spec={c.spec} pose={c.pose} expr={c.expr} t={t} mouth={c.pose === "talk" ? Math.abs(Math.sin(t * 9 + i)) : 0} position={[x, 0, z]} />;
      })}
    </Stage>
  );
};
