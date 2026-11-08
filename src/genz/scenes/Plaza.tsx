import { useCurrentFrame } from "remotion";
import { crowd1850, cuadrillero, FRIAR, KID, LOLA, MIGO, OFFICER, TINDERA, VENDOR } from "../cast";
import { FPS, PING_FRAME, lineLocal, mix, mouthAt, path, pingPong, prog, sceneById, shotIndex, wordLocal, type Scene, type V3 } from "../lib";
import { Cam, Clouds, Sky, Stage, drawPlaza, useTex } from "../three/kit";
import { Person, type Expr, type Pose, type Spec } from "../three/Person";
import { BahayNaBato, Banana, Banderitas, Banga, Calesa, Carabao, Church, Dog, Farol, Fire, Palayok, Palm, Rooster, Stall } from "../three/props1850";

export type TOD = "day" | "morning" | "night";

export const useScene = (id: string) => {
  const local = useCurrentFrame();
  const s = sceneById(id);
  const abs = s.from + local;
  return { s, local, abs, t: abs / FPS, shot: shotIndex(s, local) };
};

const faceTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
const clampTurn = (a: number) => Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(a), Math.cos(a))));

/* ------------------------------------------------------------------ the plaza */
const HOUSES: { p: V3; r: number; wall: string; wood: string }[] = [
  { p: [-16, 0, -20], r: Math.PI / 2, wall: "#f2e2c4", wood: "#6b3f24" },
  { p: [-16, 0, -9], r: Math.PI / 2, wall: "#f6d6c8", wood: "#5a3320" },
  { p: [-16, 0, 2], r: Math.PI / 2, wall: "#e8e1cf", wood: "#7a4a2b" },
  { p: [-16, 0, 13], r: Math.PI / 2, wall: "#f3dca0", wood: "#5a3320" },
  { p: [16, 0, -20], r: -Math.PI / 2, wall: "#dfe8d9", wood: "#6b3f24" },
  { p: [16, 0, -9], r: -Math.PI / 2, wall: "#f2e2c4", wood: "#7a4a2b" },
  { p: [16, 0, 2], r: -Math.PI / 2, wall: "#f7cfa8", wood: "#5a3320" },
  { p: [16, 0, 13], r: -Math.PI / 2, wall: "#e6d9f0", wood: "#6b3f24" },
  { p: [-9, 0, 26], r: Math.PI, wall: "#f2e2c4", wood: "#5a3320" },
  { p: [1, 0, 26], r: Math.PI, wall: "#f8dcc0", wood: "#6b3f24" },
  { p: [11, 0, 26], r: Math.PI, wall: "#e8e1cf", wood: "#7a4a2b" },
];

/** Crowd placements around the plaza centre (Migo stands at the origin). */
const CROWD: { p: V3; pose: Pose }[] = [
  { p: [-3.2, 0, -3.5], pose: "talk" },
  { p: [-4.1, 0, -2.6], pose: "fan" },
  { p: [3.6, 0, -4.2], pose: "idle" },
  { p: [4.6, 0, -3.1], pose: "talk" },
  { p: [-5.5, 0, 1.5], pose: "idle" },
  { p: [5.2, 0, 1.8], pose: "carryHead" },
  { p: [-2.4, 0, -7.5], pose: "walk" },
  { p: [2.0, 0, -9.0], pose: "idle" },
  { p: [-6.5, 0, -6.0], pose: "talk" },
  { p: [6.8, 0, -7.0], pose: "idle" },
  { p: [0.6, 0, -12.5], pose: "walk" },
  { p: [-8.5, 0, -13.0], pose: "idle" },
  { p: [9.0, 0, -12.5], pose: "talk" },
  { p: [-1.5, 0, -16.0], pose: "idle" },
  { p: [3.8, 0, 6.0], pose: "idle" },
  { p: [-3.9, 0, 6.5], pose: "talk" },
  { p: [-10.5, 0, -2.0], pose: "idle" },
  { p: [10.3, 0, -0.5], pose: "idle" },
];

export const Crowd: React.FC<{ t: number; stare?: number; focus?: V3; skip?: number[]; shock?: boolean }> = ({ t, stare = 0, focus = [0, 0, 0], skip = [], shock }) => (
  <group>
    {CROWD.map((c, i) => {
      if (skip.includes(i)) return null;
      const spec = crowd1850(i);
      const walker = c.pose === "walk" && stare < 0.5;
      const pp = pingPong([c.p[0] - 3.5, 0, c.p[2]], [c.p[0] + 3.5, 0, c.p[2]], t + i * 1.7, 0.9);
      const base = walker ? pp.rot : faceTo(c.p, [0, 0, 0]) + (i % 2 ? 0.5 : -0.5);
      const look = faceTo(c.p, focus);
      const rot = mix(base, look, stare * 0.6);
      const pose: Pose = stare > 0.5 && (c.pose === "walk" || c.pose === "talk") ? (shock && i % 3 === 0 ? "shock" : "idle") : walker && !pp.moving ? "idle" : c.pose;
      const pos: V3 = walker ? pp.p : c.p;
      const expr: Expr = stare > 0.5 ? (shock ? (i % 2 ? "shock" : "worried") : i % 3 === 0 ? "shock" : i % 3 === 1 ? "smug" : "worried") : i % 2 ? "happy" : "neutral";
      return (
        <Person
          key={i}
          spec={spec}
          pose={pose}
          expr={expr}
          t={t + i * 0.37}
          mouth={pose === "talk" ? Math.abs(Math.sin(t * 7 + i)) * 0.7 : 0}
          position={pos}
          rotation={rot}
          headTurn={stare > 0.5 ? clampTurn(look - rot) : 0}
        />
      );
    })}
  </group>
);

export const PlazaSet: React.FC<{ t: number; tod?: TOD; calesa?: boolean; animals?: boolean }> = ({ t, tod = "day", calesa = true, animals = true }) => {
  const plaza = useTex("plaza", drawPlaza, 1024, [10, 10]);
  const night = tod === "night";
  return (
    <group>
      {tod === "day" ? <Sky top="#2f86e0" mid="#86c5ff" horizon="#ffe9c9" /> : tod === "morning" ? <Sky top="#4a8fd8" mid="#ffc58a" horizon="#ffe0b0" /> : <Sky top="#070b24" mid="#1c2457" horizon="#3b2c5e" stars />}
      {night ? (
        <mesh position={[-120, 220, -500]}>
          <sphereGeometry args={[22, 24, 16]} />
          <meshBasicMaterial color="#fff6d8" fog={false} />
        </mesh>
      ) : (
        <Clouds seed="plaza" t={t} n={9} y={110} color={tod === "morning" ? "#ffe2c8" : "#ffffff"} />
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={plaza} roughness={1} />
      </mesh>
      <Church position={[0, 0, -36]} />
      {HOUSES.map((h, i) => (
        <BahayNaBato key={i} position={h.p} rotation={h.r} wall={h.wall} wood={h.wood} seed={`h${i}`} w={9.5} d={7} lit={night} />
      ))}
      {[-14, -3, 8, 19].map((z, i) => (
        <Banderitas key={i} a={[-12, 6.6, z]} b={[12, 6.6, z + 1]} t={t + i} n={22} />
      ))}
      <Stall position={[8.2, 0, -4]} rotation={-Math.PI / 2} seed="s1" cloth="#ff5a5f" items={["mango", "rambutan", "calamansi"]} />
      <Stall position={[8.2, 0, 3.2]} rotation={-Math.PI / 2} seed="s2" cloth="#2ec4b6" cloth2="#fff3dc" items={["tomato", "eggplant", "fish"]} />
      <Stall position={[-8.2, 0, -9]} rotation={Math.PI / 2} seed="s3" cloth="#ffd23f" cloth2="#e63946" items={["lanzones", "mango", "puto"]} nipa />
      <Stall position={[-8.2, 0, 4]} rotation={Math.PI / 2} seed="s4" nipa items={[]} />
      <Palayok position={[-8.45, 0.89, 3.45]} scale={1.1} />
      <Fire position={[-8.45, 0.86, 3.45]} t={t} scale={0.45} />
      {[[-11.5, -27], [11.5, -27], [-12, 18], [12.5, 19]].map(([x, z], i) => (
        <Palm key={i} position={[x, 0, z]} height={9 + i} lean={0.18} rot={i * 1.7} t={t} seed={`p${i}`} />
      ))}
      <Banana position={[-12, 0, -14]} t={t} seed="b1" />
      <Banana position={[12, 0, 8]} t={t} seed="b2" />
      <Banga position={[-6.8, 0, -1.2]} scale={1.3} />
      <Banga position={[-6.4, 0, -0.6]} scale={1.0} />
      {animals ? (
        <group>
          <Carabao position={[11, 0, -16]} rotation={-2.2} t={t} />
          <Rooster position={[2.8, 0, 3.5]} rotation={2.4} t={t} seed="r1" />
          <Rooster position={[-3.4, 0, 8.5]} rotation={-0.8} t={t + 0.5} seed="r2" />
          <Dog position={[1.6, 0, 5.2]} rotation={-0.4} t={t} />
        </group>
      ) : null}
      {calesa ? <Calesa position={[-40 + ((t * 2.4) % 80), 0, -30]} rotation={Math.PI / 2} t={t} /> : null}
      {night
        ? [[-6, 3.2, -6], [6, 3.2, -6], [-6, 3.2, 6], [6, 3.2, 6], [0, 3.6, -12]].map((p, i) => <Farol key={i} position={p as V3} lit color={["#ffd27a", "#ff9ec4", "#a8e6ff", "#ffd27a", "#d7ff3a"][i]} />)
        : null}
    </group>
  );
};

const lightsFor = (tod: TOD) =>
  tod === "night"
    ? { bg: "#0b1030", fog: ["#151a40", 30, 160] as [string, number, number], sun: { position: [-30, 50, 20] as V3, intensity: 0.5, color: "#9fb4ff", shadow: 20 }, hemi: ["#5a6cc0", "#2a1a12", 0.45] as [string, string, number], rim: { position: [10, 6, -10] as V3, color: "#ffb347", intensity: 0.6 } }
    : tod === "morning"
      ? { bg: "#ffd4a8", fog: ["#ffe0bf", 45, 220] as [string, number, number], sun: { position: [-28, 22, 18] as V3, intensity: 3.0, color: "#ffc98a", shadow: 22 }, hemi: ["#ffe7c8", "#8a5a3a", 0.9] as [string, string, number], rim: { position: [20, 8, -25] as V3, color: "#ff9a6a", intensity: 1.3 } }
      : { bg: "#bfe3ff", fog: ["#d8eeff", 50, 240] as [string, number, number], sun: { position: [22, 34, 16] as V3, intensity: 3.0, color: "#fff0d6", shadow: 22 }, hemi: ["#dff1ff", "#a07a50", 1.0] as [string, string, number], rim: { position: [-20, 10, -25] as V3, color: "#ffcf9a", intensity: 1.1 } };

export const PlazaStage: React.FC<{ tod?: TOD; cam: { position: V3; target: V3; fov?: number; roll?: number }; children: React.ReactNode }> = ({ tod = "day", cam, children }) => {
  const L = lightsFor(tod);
  return (
    <Stage bg={L.bg} fog={L.fog} sun={L.sun} hemi={L.hemi} rim={L.rim} exposure={tod === "night" ? 1.15 : 1.0}>
      <Cam {...cam} />
      {children}
    </Stage>
  );
};

const shotT = (s: Scene, local: number, i: number) => {
  const a = lineLocal(s, i) - 4;
  const b = i + 1 < s.lines.length ? lineLocal(s, i + 1) - 4 : s.dur;
  return prog(local, a, b, (x) => x);
};

/* ------------------------------------------------------------------ PLAZA: arrival */
export const PlazaScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("plaza");
  const k = shotT(s, local, shot);
  const stare = shot === 2 ? prog(local, lineLocal(s, 2) + 20, lineLocal(s, 2) + 50) : 0;
  const cams = [
    { position: path([[0, 34, 30], [4, 9, 16], [2.2, 2.2, 6.5]], k), target: path([[0, 6, -30], [0, 3, -10], [0, 1.4, 0]], k), fov: 48 },
    { position: path([[1.6, 1.55, 3.4], [1.1, 1.6, 2.6]], k), target: [0, 1.5, 0] as V3, fov: 40 },
    { position: path([[-0.8, 1.7, 1.4], [-0.5, 1.75, 1.0]], k), target: path([[1.5, 1.5, -6], [0, 1.6, -6]], k), fov: 46 },
  ];
  const land = prog(local, 0, 18);
  return (
    <PlazaStage cam={cams[Math.min(shot, 2)]}>
      <PlazaSet t={t} />
      <Crowd t={t} stare={stare} focus={[0, 0, 0]} />
      <Person
        spec={MIGO}
        t={t}
        pose={shot === 1 ? "talk" : shot === 2 ? "phone" : "shock"}
        expr={shot === 1 ? "happy" : shot === 2 ? "worried" : "shock"}
        mouth={mouthAt("migo", abs)}
        position={[0, (1 - land) * 0.6, 0]}
        rotation={shot === 2 ? Math.PI : 0.25}
      />
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ JEANS: Lola worries about his pants */
export const JeansScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("jeans");
  const k = shotT(s, local, shot);
  const lola: V3 = [-0.9, 0, 0.75];
  const cams = [
    { position: path([[1.8, 1.4, 3.2], [1.4, 1.35, 2.7]], k), target: [-0.4, 1.25, 0.3] as V3, fov: 40 },
    { position: path([[0.9, 0.55, 1.6], [0.6, 0.6, 1.3]], k), target: [0, 0.5, 0] as V3, fov: 42 },
    { position: path([[-1.1, 1.55, 2.2], [-0.8, 1.6, 1.8]], k), target: [0.1, 1.55, 0] as V3, fov: 38 },
  ];
  return (
    <PlazaStage cam={cams[Math.min(shot, 2)]}>
      <PlazaSet t={t} calesa={false} />
      <Crowd t={t} stare={1} focus={[0, 0, 0]} skip={[0, 1]} />
      <Person spec={MIGO} t={t} pose={shot === 2 ? "shrug" : "idle"} expr={shot === 2 ? "shock" : "worried"} mouth={mouthAt("migo", abs)} position={[0, 0, 0]} rotation={-0.6} headTurn={shot === 0 ? -0.4 : 0} />
      <Person spec={LOLA} t={t} pose={shot === 1 ? "offer" : "talk"} expr={shot === 2 ? "sad" : "worried"} mouth={mouthAt("lola", abs)} position={lola} rotation={faceTo(lola, [0, 0, 0])} look={[0, 0.3]} />
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ PHONE: no signal, no electricity */
const PhoneScreen: React.FC<{ battery: number; dead: boolean; t: number }> = ({ battery, dead, t }) => {
  const scr = useTex(`screen-${dead}-${battery}`, (g, w, h) => {
    if (dead) {
      g.fillStyle = "#050507";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ff3b3b";
      g.lineWidth = 10;
      g.strokeRect(w * 0.3, h * 0.45, w * 0.36, h * 0.1);
      g.fillStyle = "#ff3b3b";
      g.fillRect(w * 0.66, h * 0.48, 12, h * 0.04);
      g.fillRect(w * 0.31, h * 0.455, w * 0.02, h * 0.09);
      return;
    }
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#8e5cff");
    gr.addColorStop(1, "#ff4fa3");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    g.font = "bold 28px sans-serif";
    g.fillText("No Service", 26, 50);
    g.textAlign = "right";
    g.fillStyle = battery <= 5 ? "#ff3b3b" : "#ffffff";
    g.fillText(`${battery}%`, w - 30, 50);
    g.textAlign = "center";
    g.fillStyle = "#fff";
    g.font = "bold 150px sans-serif";
    g.fillText("12:41", w / 2, h * 0.32);
    g.font = "bold 30px sans-serif";
    g.fillText("Friday, 1850 ???", w / 2, h * 0.38);
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(40, h * 0.55, w - 80, 110);
    g.fillStyle = "#fff";
    g.font = "bold 30px sans-serif";
    g.fillText("Wi-Fi: no networks found", w / 2, h * 0.55 + 48);
    g.font = "26px sans-serif";
    g.fillText("Low battery. Connect charger.", w / 2, h * 0.55 + 88);
  }, 512, [1, 1], 512, 1024);
  return (
    <group rotation={[0, 0, Math.sin(t * 2) * 0.03]}>
      <mesh>
        <boxGeometry args={[0.075, 0.155, 0.009]} />
        <meshStandardMaterial color="#1b1b22" metalness={0.6} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.0047]}>
        <planeGeometry args={[0.069, 0.147]} />
        <meshBasicMaterial map={scr} toneMapped={false} />
      </mesh>
    </group>
  );
};

export const PhoneScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("phone");
  const close = wordLocal(s, "electricity") - 6;
  const die = lineLocal(s, 1) - 25;
  const battery = Math.round(Math.max(0, mix(9, 0, prog(local, 10, die, (x) => x))));
  const dead = local >= die;
  const k = prog(local, 0, close, (x) => x);
  const phase = shot === 1 ? 2 : local < close ? 0 : 1;
  const kids: V3[] = [[-1.6, 0, 1.1], [1.7, 0, 1.3], [-0.6, 0, 2.3]];
  const cams = [
    { position: path([[4.5, 2.6, 6.5], [3.2, 1.9, 5.0]], k), target: [0, 1.5, 0] as V3, fov: 44 },
    { position: [0.05, 1.98, 0.62] as V3, target: [0.05, 1.98, 0.0] as V3, fov: 34 },
    { position: path([[0.6, 1.45, 1.6], [0.35, 1.5, 1.15]], prog(local, lineLocal(s, 1), s.dur, (x) => x)), target: [0, 1.55, 0] as V3, fov: 38 },
  ];
  return (
    <PlazaStage cam={cams[phase]}>
      <PlazaSet t={t} calesa={false} />
      <Crowd t={t} stare={0.3} skip={[0, 1, 4]} />
      <Person
        spec={{ ...MIGO, prop: phase === 1 ? null : "phone" }}
        t={t}
        pose={phase === 2 ? "facepalm" : "phoneUp"}
        expr={phase === 2 ? "shock" : dead ? "shock" : "worried"}
        mouth={mouthAt("migo", abs)}
        position={[0, 0, 0]}
        rotation={phase === 2 ? 0.3 : 0}
      />
      {phase === 1 ? (
        <group position={[0.05, 1.98, 0.2]} rotation={[0, 0, 0]} scale={1.4}>
          <PhoneScreen battery={battery} dead={dead} t={t} />
        </group>
      ) : null}
      {/* kids copying him, holding up stones */}
      {kids.map((p, i) => (
        <Person key={i} spec={{ ...crowd1850(40 + i), kid: true, height: 1.1, hair: i % 2 ? "curly" : "short", outfit: "camisa", top: ["#ff6b4a", "#ffd23f", "#06d6a0"][i], bottom: "#3a2c24", shoes: null, prop: "stone" }} t={t + i} pose="phoneUp" expr="laugh" position={p} rotation={Math.PI + (i - 1) * 0.3} />
      ))}
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ MARKET: Taglish */
export const MarketScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("market");
  const k = shotT(s, local, shot);
  const vendorP: V3 = [7.0, 0, -4];
  const migoWalk = shot === 0 ? mix(-2, 5.4, prog(local, 0, lineLocal(s, 1) - 10)) : 5.4;
  const migoP: V3 = [migoWalk, 0, shot === 0 ? -2.6 : -3.4];
  const cams = [
    { position: path([[migoWalk - 2.5, 1.7, 1.4], [migoWalk - 1.5, 1.8, 0.6]], k), target: [migoWalk + 1.5, 1.3, -3.6] as V3, fov: 46 },
    { position: path([[7.0, 1.6, -2.0], [6.8, 1.6, -2.3]], k), target: [5.4, 1.5, -3.4] as V3, fov: 42 },
    { position: path([[5.8, 1.6, -2.6], [6.0, 1.62, -3.0]], k), target: [7.0, 1.55, -4.0] as V3, fov: 38 },
  ];
  return (
    <PlazaStage cam={cams[Math.min(shot, 2)]}>
      <PlazaSet t={t} calesa={false} />
      <Crowd t={t} skip={[2, 3, 9]} />
      <Person spec={MIGO} t={t} pose={shot === 0 ? "walk" : shot === 1 ? "point" : "shrug"} expr={shot === 2 ? "worried" : "laugh"} mouth={mouthAt("migo", abs)} position={migoP} rotation={shot === 0 ? Math.PI / 2 : faceTo(migoP, vendorP)} />
      <Person spec={VENDOR} t={t} pose={shot === 2 ? "shrug" : "idle"} expr={shot === 2 ? "shock" : shot === 1 ? "worried" : "happy"} mouth={mouthAt("vendor", abs)} position={vendorP} rotation={faceTo(vendorP, migoP)} />
      <Person spec={crowd1850(81)} t={t} pose="crossed" expr="smug" position={[7.3, 0, -2.4]} rotation={-1.9} />
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ FOOD: tsokolate + bibingka */
const Bibingka: React.FC<{ position: V3; t: number }> = ({ position, t }) => (
  <group position={position}>
    <mesh>
      <cylinderGeometry args={[0.13, 0.13, 0.008, 20]} />
      <meshStandardMaterial color="#3f8f3a" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.025, 0]}>
      <cylinderGeometry args={[0.11, 0.115, 0.045, 24]} />
      <meshStandardMaterial color="#f2c46b" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.049, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.1, 24]} />
      <meshStandardMaterial color="#c97a2e" roughness={0.7} />
    </mesh>
    {[0, 1, 2, 3].map((i) => (
      <mesh key={i} position={[Math.cos(i * 1.6) * 0.05, 0.055, Math.sin(i * 1.6) * 0.05]} rotation={[-Math.PI / 2, 0, i]}>
        <planeGeometry args={[0.035, 0.02]} />
        <meshStandardMaterial color="#fff6dd" />
      </mesh>
    ))}
    {[0, 1, 2].map((i) => (
      <mesh key={`s${i}`} position={[Math.sin(t * 0.8 + i * 2) * 0.03, 0.12 + ((t * 0.15 + i * 0.12) % 0.35), Math.cos(t + i) * 0.02]}>
        <sphereGeometry args={[0.025 + i * 0.006, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25 - ((t * 0.15 + i * 0.12) % 0.35) * 0.6} />
      </mesh>
    ))}
  </group>
);

export const FoodScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("food");
  const k = shotT(s, local, shot);
  // stall at (-8.2,0,4) facing +x; tindera behind it, Migo on a bench in front
  const rosaP: V3 = [-9.0, 0, 4.2];
  const migoP: V3 = [-6.5, 0.0, 4.0];
  const lolaP: V3 = [-6.9, 0, 2.9];
  const payLine = shot === 2;
  const coin = payLine && local > lineLocal(s, 2) + 70;
  const cams = [
    { position: path([[-6.5, 1.55, 5.0], [-6.9, 1.4, 4.7]], k), target: [-8.4, 1.0, 3.9] as V3, fov: 42 },
    { position: path([[-7.3, 1.2, 4.4], [-7.2, 1.18, 4.25]], k), target: [-6.5, 1.05, 4.0] as V3, fov: 40 },
    { position: path([[-5.3, 1.65, 6.0], [-5.6, 1.6, 5.7]], k), target: [-7.9, 1.2, 3.7] as V3, fov: 46 },
  ];
  return (
    <PlazaStage cam={cams[Math.min(shot, 2)]}>
      <PlazaSet t={t} calesa={false} />
      <Crowd t={t} skip={[4, 15, 16]} />
      <Person spec={TINDERA} t={t} pose={payLine ? "talk" : "stir"} expr={payLine ? "laugh" : "happy"} position={rosaP} rotation={Math.PI / 2} />
      <Bibingka position={[-7.85, 0.93, 4.25]} t={t} />
      <Bibingka position={[-7.95, 0.93, 4.85]} t={t + 1} />
      {/* bench */}
      <mesh position={[-6.5, 0.42, 4.0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.06, 1.6]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
      </mesh>
      <Person
        spec={{ ...MIGO, prop: payLine ? "phone" : "cup" }}
        t={t}
        pose={payLine ? "offer" : "sit"}
        expr={payLine ? "smug" : "laugh"}
        mouth={mouthAt("migo", abs)}
        position={payLine ? [-6.8, 0, 4.0] : [migoP[0], migoP[1], migoP[2]]}
        rotation={-Math.PI / 2}
      />
      {payLine ? <Person spec={{ ...LOLA, prop: coin ? "coin" : "fan" }} t={t} pose={coin ? "offer" : "fan"} expr="laugh" position={lolaP} rotation={-Math.PI / 2 + 0.3} /> : null}
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ POLICE: cuadrilleros */
export const PoliceScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("police");
  const k = shotT(s, local, shot);
  const march = prog(local, 0, lineLocal(s, 1) - 4, (x) => x);
  const z = mix(-12, -2.4, march);
  const officerP: V3 = [0, 0, z];
  const cams = [
    { position: path([[0.6, 0.45, -0.6], [0.4, 0.5, -0.8]], k), target: [0, 1.6, z] as V3, fov: 50 },
    { position: path([[0.5, 1.55, -0.9], [0.4, 1.6, -1.1]], k), target: [0, 1.75, -2.4] as V3, fov: 36 },
    { position: path([[-0.4, 1.5, -1.6], [-0.3, 1.52, -1.3]], k), target: [0, 1.55, 0] as V3, fov: 38 },
  ];
  const walking = march < 1;
  return (
    <PlazaStage cam={cams[Math.min(shot, 2)]}>
      <PlazaSet t={t} calesa={false} />
      <Crowd t={t} stare={1} focus={officerP} shock skip={[0, 1, 2, 3, 6, 7, 10]} />
      <Person spec={MIGO} t={t} pose={shot === 2 ? "shrug" : "shock"} expr={shot === 2 ? "worried" : "shock"} mouth={mouthAt("migo", abs)} position={[0, 0, 0]} rotation={Math.PI} />
      <Person spec={{ ...OFFICER, prop: null }} t={t} pose={walking ? "walk" : shot === 1 ? "point" : "hips"} expr="angry" mouth={mouthAt("officer", abs)} position={officerP} rotation={0} />
      {[0, 1].map((i) => (
        <Person key={i} spec={cuadrillero(i)} t={t + i * 0.3} pose={walking ? "walk" : "idle"} expr="angry" position={[i ? 1.2 : -1.2, 0, z - 0.8]} rotation={0} />
      ))}
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ FRIAR: spoiler alert */
export const FriarScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("friar");
  const k = shotT(s, local, shot);
  const migoP: V3 = [0, 0.45, -24];
  const friarZ = mix(-31.5, -25.6, prog(local, lineLocal(s, 2), lineLocal(s, 3) - 4));
  const friarP: V3 = [1.6, 0, friarZ];
  const crowdP: V3[] = [[-1.4, 0, -21.6], [-0.3, 0, -21.2], [1.0, 0, -21.4], [2.0, 0, -22.0], [-2.3, 0, -22.2], [0.4, 0, -20.4], [-1.0, 0, -20.2]];
  const turned = shot >= 3;
  const cams = [
    { position: path([[5, 2.2, -16], [3.5, 1.8, -18]], k), target: [0, 1.6, -24] as V3, fov: 44 },
    { position: path([[0.5, 0.8, -21.5], [0.3, 0.9, -22.0]], k), target: [0, 2.1, -24] as V3, fov: 46 },
    { position: path([[2.6, 1.9, -20.2], [2.3, 2.0, -21.0]], k), target: [1.0, 1.8, -27] as V3, fov: 42 },
    { position: [0.2, 1.5, -24.4] as V3, target: [1.6, 1.85, friarZ] as V3, fov: 36 },
    { position: [0.5, 2.0, -25.0] as V3, target: [0, 2.0, -24] as V3, fov: 38 },
  ];
  return (
    <PlazaStage tod="morning" cam={cams[Math.min(shot, 4)]}>
      <PlazaSet t={t} tod="morning" calesa={false} animals={false} />
      {/* crate */}
      <mesh position={[0, 0.22, -24]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.45, 0.6]} />
        <meshStandardMaterial color="#9b6a3c" roughness={0.9} />
      </mesh>
      <Person spec={{ ...MIGO, prop: null }} t={t} pose={shot <= 1 ? "cheer" : shot === 2 ? "point" : turned && shot === 4 ? "shrug" : "shock"} expr={shot === 4 ? "laugh" : shot === 3 ? "shock" : "happy"} mouth={mouthAt("migo", abs)} position={migoP} rotation={turned ? Math.PI : 0} />
      {crowdP.map((p, i) => (
        <Person key={i} spec={i % 3 === 0 ? { ...KID, seed: `fk${i}`, top: ["#ffd23f", "#ff6b4a", "#2ec4b6"][i % 3] } : crowd1850(60 + i)} t={t + i * 0.4} pose={shot >= 2 ? "shock" : "idle"} expr={shot >= 2 ? "shock" : "happy"} position={p} rotation={Math.PI} headTurn={0} />
      ))}
      <Person spec={FRIAR} t={t} pose={shot >= 3 ? "crossed" : "walk"} expr={shot >= 3 ? "angry" : "smug"} mouth={mouthAt("friar", abs)} position={friarP} rotation={0} />
    </PlazaStage>
  );
};

/* ------------------------------------------------------------------ ENDING: night, the phone wakes up */
export const EndingScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("ending");
  const ping = PING_FRAME - s.from;
  const lit = local >= ping;
  const glow = prog(local, ping, ping + 25);
  const k = prog(local, 0, ping, (x) => x);
  const cams = [
    { position: path([[0.5, 3.2, 8.5], [0.2, 2.0, 5.2]], k), target: [-0.2, 0.8, 1.0] as V3, fov: 44 },
    { position: path([[0.6, 1.5, 2.6], [0.4, 1.55, 2.2]], prog(local, ping, lineLocal(s, 1), (x) => x)), target: [0, 1.45, 1.0] as V3, fov: 40 },
    { position: path([[0.2, 1.6, 2.1], [0.1, 1.8, 3.4]], prog(local, lineLocal(s, 1), s.dur, (x) => x)), target: [0, 1.55, 1.0] as V3, fov: 40 },
  ];
  const phase = shot === 1 ? 2 : lit ? 1 : 0;
  const seat = (p: V3, spec: Spec, rot: number, expr: Expr, pose: Pose = "sitFloor", speaker?: string) => (
    <Person spec={spec} t={t} pose={pose} expr={expr} mouth={speaker ? mouthAt(speaker, abs) : 0} position={p} rotation={rot} />
  );
  return (
    <PlazaStage tod="night" cam={cams[phase]}>
      <PlazaSet t={t} tod="night" calesa={false} animals={false} />
      {/* banig mat with food + fire */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.9} />
      </mesh>
      <Fire position={[0, 0.02, -1.6]} t={t} scale={1.2} />
      <Palayok position={[0, 0.05, -1.6]} scale={1.0} />
      <Bibingka position={[0.3, 0.03, 0.1]} t={t} />
      <Bibingka position={[-0.4, 0.03, -0.1]} t={t + 0.5} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.sin(t * 0.7 + i * 2.1) * 3 + (i - 2.5), 1.2 + Math.sin(t * 1.3 + i) * 0.6, Math.cos(t * 0.5 + i) * 2 - 1]}>
          <sphereGeometry args={[0.03, 6, 5]} />
          <meshBasicMaterial color="#d7ff3a" />
        </mesh>
      ))}
      {seat([0, 0, 1.0], { ...MIGO, prop: lit ? "phoneLit" : "phone" }, lit ? 0 : Math.PI, phase === 2 ? "worried" : lit ? "shock" : "laugh", lit ? "phone" : "sitFloor", "migo")}
      {seat([-1.1, 0, 0.6], LOLA, Math.PI - 0.6, lit ? "shock" : "laugh")}
      {seat([1.1, 0, 0.5], KID, Math.PI + 0.7, lit ? "shock" : "happy")}
      {seat([-1.2, 0, -0.7], TINDERA, Math.PI / 2 + 0.3, "happy")}
      {seat([1.2, 0, -0.8], VENDOR, -Math.PI / 2 - 0.3, "laugh")}
      {lit ? (
        <group position={[0, 1.55, 1.35]}>
          <pointLight position={[0, 0.2, 1.2]} color="#9ff7ff" intensity={1.6 * glow} distance={6} />
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 0.25 + i * 0.12, -0.05]} rotation={[Math.PI / 2, 0, t * (1.5 + i * 0.6) * (i % 2 ? -1 : 1)]} scale={glow * (0.25 + i * 0.12)}>
              <torusGeometry args={[1, 0.035, 8, 40, Math.PI * 1.6]} />
              <meshBasicMaterial color={["#d7ff3a", "#2ec4ff", "#ff4fa3", "#ffffff"][i]} transparent opacity={0.85} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : null}
    </PlazaStage>
  );
};
