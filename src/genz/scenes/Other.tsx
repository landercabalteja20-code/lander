import { RoundedBox } from "@react-three/drei";
import { random } from "remotion";
import { BackSide, DoubleSide } from "three";
import { BARISTA, cuadrillero, crowd1850, KID, LOLA, MIGO, modern, OFFICER } from "../cast";
import { lineLocal, mix, mouthAt, path, pingPong, prog, wordLocal, type Scene, type V3 } from "../lib";
import { Cam, Clouds, Sky, Stage, drawGrass, drawStone, drawWood, speckle, useTex } from "../three/kit";
import { Person } from "../three/Person";
import { Banana, Banca, Fire, NipaHut, Palayok, Palm } from "../three/props1850";
import { useScene } from "./Plaza";

const shotT = (s: Scene, local: number, i: number) => {
  const a = lineLocal(s, i) - 4;
  const b = i + 1 < s.lines.length ? lineLocal(s, i + 1) - 4 : s.dur;
  return prog(local, a, b, (x) => x);
};

/* ------------------------------------------------------------------ SHOP (2026) */
const NeonSign: React.FC<{ position: V3; t: number }> = ({ position, t }) => {
  const tx = useTex("neon", (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = "bold 150px sans-serif";
    g.textAlign = "center";
    g.lineWidth = 14;
    g.strokeStyle = "#ff4fa3";
    g.shadowColor = "#ff4fa3";
    g.shadowBlur = 30;
    g.strokeText("MILK TEA", w / 2, 190);
    g.fillStyle = "#fff0f8";
    g.shadowBlur = 0;
    g.fillText("MILK TEA", w / 2, 190);
    g.font = "bold 70px sans-serif";
    g.fillStyle = "#d7ff3a";
    g.fillText("· open til 2am ·", w / 2, 300);
  }, 1024, [1, 1], 1024, 360);
  const flick = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7);
  return (
    <mesh position={position}>
      <planeGeometry args={[3.2, 1.12]} />
      <meshBasicMaterial map={tx} transparent toneMapped={false} opacity={flick} />
    </mesh>
  );
};

const MenuBoard: React.FC<{ position: V3 }> = ({ position }) => {
  const tx = useTex("menu", (g, w, h) => {
    g.fillStyle = "#1f2a2e";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#d7ff3a";
    g.font = "bold 64px sans-serif";
    g.fillText("MENU", 40, 90);
    const items = [["Brown Sugar Boba", "₱160"], ["Taro Cloud", "₱150"], ["Ube Cheesecake", "₱175"], ["Mango Pomelo", "₱145"], ["Matcha Oat", "₱180"]];
    g.font = "bold 40px sans-serif";
    items.forEach(([n, p], i) => {
      g.fillStyle = ["#ff9ec4", "#c9b6ff", "#b48cff", "#ffd23f", "#9ff0b5"][i];
      g.beginPath();
      g.arc(60, 170 + i * 80, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.fillText(n, 100, 184 + i * 80);
      g.fillText(p, w - 170, 184 + i * 80);
    });
  }, 1024, [1, 1], 1024, 600);
  return (
    <mesh position={position}>
      <planeGeometry args={[3.0, 1.75]} />
      <meshStandardMaterial map={tx} emissive="#ffffff" emissiveMap={tx} emissiveIntensity={0.5} />
    </mesh>
  );
};

const Cup: React.FC<{ position: V3; color: string }> = ({ position, color }) => (
  <group position={position}>
    <mesh>
      <cylinderGeometry args={[0.05, 0.04, 0.17, 16, 1, true]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.35} roughness={0.1} side={DoubleSide} />
    </mesh>
    <mesh position={[0, -0.015, 0]}>
      <cylinderGeometry args={[0.046, 0.039, 0.13, 16]} />
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
    {[0, 1, 2, 3, 4].map((i) => (
      <mesh key={i} position={[Math.cos(i * 1.3) * 0.022, -0.065, Math.sin(i * 1.3) * 0.022]}>
        <sphereGeometry args={[0.012, 8, 6]} />
        <meshStandardMaterial color="#1a0f0a" roughness={0.2} />
      </mesh>
    ))}
    <mesh position={[0.015, 0.11, 0]} rotation={[0, 0, 0.15]}>
      <cylinderGeometry args={[0.007, 0.007, 0.12, 8]} />
      <meshStandardMaterial color="#d7ff3a" />
    </mesh>
  </group>
);

export const ShopScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("shop");
  const k = shotT(s, local, shot);
  const terrazzo = useTex("terrazzo", (g, w, h, r) => {
    g.fillStyle = "#f5ece4";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 900, ["#ff9ec4", "#8fd3c8", "#ffd23f", "#b48cff"], 5, 0.9);
  }, 512, [6, 6]);
  const cams = [
    { position: path([[2.6, 1.7, 6.2], [1.8, 1.6, 4.4]], k), target: [0, 1.3, -0.5] as V3, fov: 50 },
    { position: path([[1.2, 1.55, 1.6], [0.9, 1.6, 1.25]], k), target: [0.0, 1.55, 0.2] as V3, fov: 40 },
    { position: path([[0.95, 1.62, -1.45], [0.85, 1.62, -1.3]], k), target: [0.3, 1.55, 0.1] as V3, fov: 42 },
  ];
  return (
    <Stage bg="#ffd6e6" sun={{ position: [4, 8, 6], intensity: 1.6, color: "#fff2f8", shadow: 6 }} hemi={["#fff0f8", "#c7a3ff", 1.2]} rim={{ position: [-4, 3, -4], color: "#9ff7ff", intensity: 1.0 }} ambient={0.3}>
      <Cam {...cams[Math.min(shot, 2)]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial map={terrazzo} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2, -2.6]} receiveShadow>
        <planeGeometry args={[14, 4]} />
        <meshStandardMaterial color="#ffb3c7" roughness={0.9} />
      </mesh>
      <mesh position={[-4.5, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 4]} />
        <meshStandardMaterial color="#9fe3d0" roughness={0.9} />
      </mesh>
      <mesh position={[4.5, 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[10, 4]} />
        <meshStandardMaterial color="#c9b6ff" roughness={0.9} />
      </mesh>
      <NeonSign position={[-0.6, 2.9, -2.55]} t={t} />
      <MenuBoard position={[2.2, 2.55, -2.55]} />
      {/* counter */}
      <RoundedBox args={[4.2, 1.0, 0.8]} radius={0.08} position={[0.4, 0.5, -1.0]} castShadow receiveShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0.4, 1.03, -1.0]}>
        <boxGeometry args={[4.3, 0.06, 0.9]} />
        <meshStandardMaterial color="#c98b55" roughness={0.5} />
      </mesh>
      {["#c79a6b", "#b48cff", "#ffd23f", "#9ff0b5", "#ff9ec4"].map((c, i) => (
        <Cup key={i} position={[-1.2 + i * 0.35, 1.15, -0.85]} color={c} />
      ))}
      {[-1.4, 0.4, 2.2].map((x, i) => (
        <group key={i} position={[x, 3.3, -0.6]}>
          <mesh>
            <cylinderGeometry args={[0.005, 0.005, 1.2, 4]} />
            <meshBasicMaterial color="#333" />
          </mesh>
          <mesh position={[0, -0.65, 0]}>
            <sphereGeometry args={[0.16, 16, 12]} />
            <meshStandardMaterial color="#fff3c4" emissive="#ffd27a" emissiveIntensity={2} toneMapped={false} />
          </mesh>
          <pointLight position={[0, -0.8, 0]} color="#ffd9a8" intensity={3} distance={4} />
        </group>
      ))}
      {/* monstera plants */}
      {[[-3.8, -2], [3.8, -1.8]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.28, 0.22, 0.5, 16]} />
            <meshStandardMaterial color="#ffd23f" roughness={0.5} />
          </mesh>
          {Array.from({ length: 7 }).map((_, j) => (
            <mesh key={j} position={[Math.cos(j) * 0.3, 0.8 + (j % 3) * 0.25, Math.sin(j) * 0.3]} rotation={[0.6, j, 0.4]} scale={[0.35, 0.02, 0.28]}>
              <sphereGeometry args={[1, 12, 8]} />
              <meshStandardMaterial color={j % 2 ? "#2f8f4e" : "#3fa85e"} side={DoubleSide} />
            </mesh>
          ))}
        </group>
      ))}
      <Person spec={BARISTA} t={t} pose={shot === 2 ? "talk" : "idle"} expr="happy" position={[0.3, 0, -1.8]} rotation={0} />
      <Person spec={{ ...MIGO, prop: shot === 2 ? "cup" : "phone" }} t={t} pose={shot === 2 ? "talk" : "phone"} expr={shot === 1 ? "smug" : "happy"} mouth={mouthAt("migo", abs)} position={[0.3, 0, 0.1]} rotation={shot === 2 ? Math.PI : 0.35} />
      <Person spec={modern(0)} t={t} pose="phone" expr="neutral" position={[-2.4, 0, 0.8]} rotation={0.6} />
      <Person spec={modern(1)} t={t} pose="talk" expr="laugh" position={[2.6, 0, 1.0]} rotation={-0.9} mouth={Math.abs(Math.sin(t * 8)) * 0.6} />
      <Person spec={modern(2)} t={t} pose="idle" expr="happy" position={[3.2, 0, 0.2]} rotation={-1.6} />
      <Person spec={modern(3)} t={t} pose="phone" expr="smug" position={[-3.0, 0, 1.8]} rotation={1.2} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ WARP */
export const WarpScene: React.FC = () => {
  const { local, t, s } = useScene("warp");
  const k = prog(local, 0, s.dur, (x) => x);
  const rings = 26;
  return (
    <Stage bg="#0a0420" hemi={["#ffffff", "#333366", 1.2]}>
      <Cam position={[0, 0, 6]} target={[0, 0, -10]} fov={60} roll={t * 1.5} />
      {Array.from({ length: rings }).map((_, i) => {
        const z = (((i * 4 + local * 1.6) % (rings * 4)) - rings * 4) + 6;
        const hue = ["#d7ff3a", "#ff4fa3", "#2ec4ff", "#8e5cff", "#ffc94a"][i % 5];
        const sepia = k;
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[0, 0, i * 0.4 + t]}>
            <torusGeometry args={[2.4 + Math.sin(i) * 0.3, 0.05, 6, 48]} />
            <meshBasicMaterial color={sepia > 0.6 ? "#e8c27a" : hue} toneMapped={false} />
          </mesh>
        );
      })}
      {Array.from({ length: 80 }).map((_, i) => {
        const a = random(`ws${i}`) * Math.PI * 2;
        const r = 0.6 + random(`wr${i}`) * 2;
        const z = ((random(`wz${i}`) * 60 + local * 3) % 60) - 54;
        return (
          <mesh key={i} position={[Math.cos(a) * r, Math.sin(a) * r, z]}>
            <boxGeometry args={[0.02, 0.02, 1.4]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        );
      })}
      <Person spec={MIGO} t={t} pose="shock" expr="shock" position={[0, -1.0, 0]} rotation={t * 3} />
      <mesh>
        <sphereGeometry args={[60, 16, 8]} />
        <meshBasicMaterial color={k > 0.6 ? "#2a1a0a" : "#120830"} side={BackSide} />
      </mesh>
    </Stage>
  );
};

/* ------------------------------------------------------------------ CATALOG: the surname book */
const SURNAMES = ["Abad", "Abaya", "Bacani", "Bagatsing", "Balagtas", "Baltazar", "Bautista", "Belmonte", "Bernal", "Buenaventura", "Cabrera", "Calderón", "Castillo", "Concepción", "Cruz", "Dagohoy", "Dela Cruz", "De los Santos", "Domingo", "Escobar", "Espiritu", "Flores", "Galang", "Garcia", "Lacson", "Malabanan", "Mendoza", "Natividad", "Pascual", "Reyes", "Salonga", "Santiago", "Santos", "Tolentino", "Villanueva"];

const Book: React.FC<{ open: number; page: number; highlight: number }> = ({ open, page, highlight }) => {
  const cover = useTex("cover", (g, w, h) => {
    g.fillStyle = "#6b1f1f";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#e3b65a";
    g.lineWidth = 10;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.fillStyle = "#f2d27a";
    g.textAlign = "center";
    g.font = "bold 50px Georgia, serif";
    g.fillText("CATÁLOGO", w / 2, h * 0.36);
    g.fillText("ALFABÉTICO", w / 2, h * 0.46);
    g.font = "bold 40px Georgia, serif";
    g.fillText("DE APELLIDOS", w / 2, h * 0.56);
    g.font = "30px Georgia, serif";
    g.fillText("Manila · 1849", w / 2, h * 0.72);
  }, 512, [1, 1], 512, 700);
  const pageTex = useTex(`page-${highlight > 0}`, (g, w, h) => {
    g.fillStyle = "#f3e6c8";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#3a2414";
    g.font = "bold 34px Georgia, serif";
    g.fillText("— B —", w / 2 - 50, 60);
    g.font = "30px Georgia, serif";
    SURNAMES.slice(3, 21).forEach((n, i) => {
      if (n === "Bautista" && highlight > 0) {
        g.fillStyle = "rgba(215,255,58,0.9)";
        g.fillRect(40, 92 + i * 34, 230, 34);
      }
      g.fillStyle = "#3a2414";
      g.fillText(n, 50, 120 + i * 34);
      g.fillText(SURNAMES[(i * 7 + 3) % SURNAMES.length], w / 2 + 30, 120 + i * 34);
    });
  }, 512, [1, 1], 512, 720);
  return (
    <group>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.06, 0.85]} />
        <meshStandardMaterial color="#6b1f1f" roughness={0.6} />
      </mesh>
      {/* static pages + the cover swinging open to the left */}
      <mesh position={[-0.29, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={open > 0.5}>
        <planeGeometry args={[0.56, 0.8]} />
        <meshStandardMaterial map={pageTex} roughness={0.9} />
      </mesh>
      <mesh position={[0.29, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.56, 0.8]} />
        <meshStandardMaterial map={pageTex} roughness={0.9} />
      </mesh>
      <group position={[0, 0.062, 0]} rotation={[0, 0, Math.PI * open]} visible={open < 0.995}>
        <mesh position={[0.3, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.6, 0.84]} />
          {open < 0.5 ? <meshStandardMaterial map={cover} roughness={0.7} /> : <meshStandardMaterial color="#6b1f1f" roughness={0.7} side={DoubleSide} />}
        </mesh>
      </group>
      {[0, 1, 2].map((i) => {
        const a = Math.max(0, Math.min(1, page * 3 - i));
        return (
          <group key={i} position={[0, 0.06 + i * 0.002, 0]} rotation={[0, 0, Math.PI * a]}>
            <mesh position={[0.28, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={a > 0 && a < 1}>
              <planeGeometry args={[0.54, 0.78]} />
              <meshStandardMaterial color="#f6ecd2" side={DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

export const CatalogScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("catalog");
  const k = shotT(s, local, shot);
  const stone = useTex("trib-stone", drawStone, 256, [6, 2]);
  const wood = useTex("trib-floor", drawWood, 512, [4, 4]);
  const flag = useTex("flag-es", (g, w, h) => {
    g.fillStyle = "#c60b1e";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffc400";
    g.fillRect(0, h * 0.25, w, h * 0.5);
  }, 256, [1, 1], 300, 200);
  const open = prog(local, 20, 45);
  const page = prog(local, 50, 110, (x) => x);
  const bautista = wordLocal(s, "Bautista");
  const stamp = prog(local, bautista + 6, bautista + 12);
  const cams = [
    { position: path([[0.35, 1.9, 1.0], [0.25, 1.6, 0.75]], k), target: [0, 0.95, 0] as V3, fov: 40 },
    { position: path([[1.2, 1.55, 1.3], [1.0, 1.6, 1.0]], k), target: [0, 1.5, -0.6] as V3, fov: 40 },
    { position: path([[0.35, 1.6, 0.35], [0.3, 1.6, 0.45]], k), target: [0.1, 1.55, 1.0] as V3, fov: 42 },
  ];
  return (
    <Stage bg="#3a2418" fog={["#3a2418", 6, 24]} sun={{ position: [-5, 6, 3], intensity: 2.8, color: "#ffd9a0", shadow: 4 }} hemi={["#ffe0b8", "#3a2418", 0.55]} rim={{ position: [3, 3, -4], color: "#ffb36b", intensity: 1.0 }}>
      <Cam {...cams[Math.min(shot, 2)]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial map={wood} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2, -1.9]} receiveShadow>
        <planeGeometry args={[12, 4]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      <mesh position={[-1.6, 2.3, -1.88]}>
        <planeGeometry args={[1.2, 0.8]} />
        <meshStandardMaterial map={flag} roughness={0.8} />
      </mesh>
      {/* window with light */}
      <mesh position={[1.8, 2.2, -1.88]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshBasicMaterial color="#ffe9b8" toneMapped={false} />
      </mesh>
      {/* desk */}
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.08, 1.1]} />
        <meshStandardMaterial color="#5a3320" roughness={0.6} />
      </mesh>
      {[[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.42, z]}>
          <boxGeometry args={[0.08, 0.84, 0.08]} />
          <meshStandardMaterial color="#4a2a18" />
        </mesh>
      ))}
      <group position={[0, 0.89, 0.05]}>
        <Book open={open} page={page} highlight={local > bautista ? 1 : 0} />
      </group>
      {/* candle + inkwell + stamp */}
      <group position={[-0.75, 0.89, -0.25]}>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 12]} />
          <meshStandardMaterial color="#fff3dc" />
        </mesh>
        <mesh position={[0, 0.23, 0]} scale={[1, 1 + 0.15 * Math.sin(t * 17), 1]}>
          <coneGeometry args={[0.015, 0.05, 8]} />
          <meshBasicMaterial color="#ffcf5a" toneMapped={false} />
        </mesh>
        <pointLight position={[0, 0.3, 0]} color="#ffb347" intensity={1.5} distance={3} />
      </group>
      <mesh position={[0.75, 0.93, -0.3]}>
        <cylinderGeometry args={[0.05, 0.06, 0.08, 12]} />
        <meshStandardMaterial color="#1b1b2a" metalness={0.3} roughness={0.2} />
      </mesh>
      <mesh position={[0.25, 0.9 + (1 - stamp) * 0.25 + (stamp >= 1 ? 0 : 0), 0.15]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
        <meshStandardMaterial color="#6b3f24" />
      </mesh>
      <Person spec={{ ...OFFICER, prop: null }} t={t} pose={shot === 1 ? "point" : "holdBook"} expr={shot === 2 ? "smug" : "angry"} mouth={mouthAt("officer", abs)} position={[0, 0, -0.85]} rotation={0} look={[0, 0.35]} />
      <Person spec={cuadrillero(1)} t={t} pose="idle" expr="neutral" position={[1.5, 0, 0.4]} rotation={-1.3} />
      <Person spec={{ ...MIGO, prop: null }} t={t} pose={shot === 2 ? "shrug" : "shrug"} expr={shot === 2 ? "shock" : "worried"} mouth={mouthAt("migo", abs)} position={[0.1, 0, 1.0]} rotation={Math.PI} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ POLO: forced labor */
export const PoloScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("polo");
  const k = shotT(s, local, shot);
  const stone = useTex("polo-stone", drawStone, 256, [5, 2]);
  const dirt = useTex("polo-dirt", (g, w, h, r) => {
    g.fillStyle = "#c79a62";
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 3000, ["#a77a45", "#dfba84", "#8f6538"], 5, 0.5);
  }, 512, [12, 12]);
  // workers shuttle stones from the pile (x≈6.5) to the wall (x≈-6) and walk back empty-handed
  const workers = Array.from({ length: 7 }).map((_, i) => {
    const z = -3.4 + (i % 3) * 0.9 - (i % 2) * 0.35;
    const w = pingPong([6.3, 0, z], [-6.0, 0, z - 0.4], t + i * 2.3, 0.85, 0.9);
    return { i, p: w.p, rot: w.rot, carrying: !w.back, moving: w.moving };
  });
  const migoX = mix(-3.0, 0.5, prog(local, 0, s.dur, (x) => x));
  const cams = [
    { position: path([[8, 4.5, 9], [5, 3, 7]], k), target: [0, 2.5, -4] as V3, fov: 50 },
    { position: path([[migoX + 1.4, 1.5, 0.6], [migoX + 1.1, 1.55, 0.4]], k), target: [migoX, 1.45, -0.6] as V3, fov: 40 },
    { position: path([[migoX + 3.2, 1.9, 2.6], [migoX + 2.4, 1.7, 2.0]], k), target: [migoX, 1.3, -0.6] as V3, fov: 46 },
  ];
  return (
    <Stage bg="#fff1cc" fog={["#ffe9c2", 25, 120]} sun={{ position: [10, 30, 8], intensity: 3.6, color: "#fff2c4", shadow: 16 }} hemi={["#fff6dc", "#a77a45", 1.0]} rim={{ position: [-10, 6, -10], color: "#ff9a5a", intensity: 1.0 }} exposure={1.05}>
      <Cam {...cams[Math.min(shot, 2)]} />
      <Sky top="#7fbaf0" mid="#cfe6ff" horizon="#fff1cc" sun={{ dir: [0.3, 0.6, -0.75], color: "#fffbe8", size: 45 }} />
      <Clouds seed="polo" t={t} n={5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={dirt} roughness={1} />
      </mesh>
      {/* unfinished stone wall with arches */}
      {[-6, -2, 2, 6].map((x, i) => (
        <group key={i} position={[x, 0, -7]}>
          <mesh position={[0, 2.2 + (i % 2) * 0.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 4.4 + (i % 2) * 1.2, 1.4]} />
            <meshStandardMaterial map={stone} roughness={0.95} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 4.9, -7]} castShadow>
        <boxGeometry args={[9, 0.8, 1.4]} />
        <meshStandardMaterial map={stone} roughness={0.95} />
      </mesh>
      {/* bamboo scaffolding */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={`v${i}`} position={[-7.5 + i * 3, 3.5, -5.9]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 7, 8]} />
          <meshStandardMaterial color="#c9a35f" roughness={0.6} />
        </mesh>
      ))}
      {[1.8, 3.6, 5.4].map((y) => (
        <mesh key={`h${y}`} position={[0, y, -5.9]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 16, 8]} />
          <meshStandardMaterial color="#b8935a" roughness={0.6} />
        </mesh>
      ))}
      {/* stone blocks */}
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={`b${i}`} position={[7 + (i % 4) * 0.7, 0.2 + Math.floor(i / 4) * 0.4, -2 - (i % 3) * 0.6]} castShadow receiveShadow>
          <boxGeometry args={[0.6, 0.38, 0.5]} />
          <meshStandardMaterial color={["#d6c4a0", "#c4b089", "#bfa985"][i % 3]} roughness={0.95} />
        </mesh>
      ))}
      <Palm position={[-12, 0, -12]} height={10} t={t} seed="pp1" rot={0.4} />
      <Palm position={[11, 0, -14]} height={11} t={t} seed="pp2" rot={2.4} />
      {workers.map((w) => (
        <Person key={w.i} spec={{ ...crowd1850(100 + w.i), outfit: "camisa", hat: w.i % 2 ? "salakot" : null, prop: w.carrying ? "stone" : null, shoes: null }} t={t + w.i} pose={!w.moving ? "idle" : w.carrying ? "carryShoulder" : "walk"} expr={w.i % 3 ? "worried" : "sad"} position={w.p} rotation={w.rot} />
      ))}
      <Person spec={{ ...MIGO, prop: "stone" }} t={t} pose={shot === 2 ? "shrug" : "carryShoulder"} expr={shot === 1 ? "worried" : "sad"} mouth={mouthAt("migo", abs)} position={[migoX, 0, -0.6]} rotation={Math.PI / 2 - 0.25} />
      <Person spec={{ ...OFFICER, seed: "overseer", prop: "cane", beard: "mustache" }} t={t} pose="hips" expr="angry" position={[3.0, 0, 1.2]} rotation={-2.4} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ NIGHT: boil your water */
export const NightScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("night");
  const k = shotT(s, local, shot);
  const grass = useTex("grass", drawGrass, 512, [16, 16]);
  const potP: V3 = [0.6, 0, 2.0];
  const cams = [
    { position: path([[7, 3.5, 11], [3.5, 1.8, 5.8]], k), target: path([[0, 2.2, 0], [0.6, 0.6, 2.0]], k), fov: 48 },
    { position: path([[0.95, 1.4, 3.1], [0.85, 1.38, 2.95]], k), target: [-0.25, 1.3, 2.15] as V3, fov: 36 },
    { position: path([[-0.1, 1.35, 4.3], [0.0, 1.32, 4.0]], k), target: [0.05, 1.15, 2.2] as V3, fov: 40 },
  ];
  const hug = shot === 2 && local > lineLocal(s, 2) + 25;
  return (
    <Stage bg="#0a1030" fog={["#121a44", 12, 70]} sun={{ position: [-20, 30, 10], intensity: 0.55, color: "#a9bcff", shadow: 10 }} hemi={["#4b5cb0", "#1a120c", 0.45]} rim={{ position: [6, 3, -6], color: "#7aa0ff", intensity: 0.6 }} exposure={1.2}>
      <Cam {...cams[Math.min(shot, 2)]} />
      <Sky top="#050820" mid="#16204e" horizon="#2c2f6a" stars />
      <mesh position={[-80, 140, -300]}>
        <sphereGeometry args={[14, 24, 16]} />
        <meshBasicMaterial color="#fff6d8" fog={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={grass} roughness={1} color="#7a8fa0" />
      </mesh>
      <NipaHut position={[-0.5, 0, -1.5]} lit />
      <Banana position={[-4.5, 0, 0.5]} t={t} seed="nb1" scale={1.1} />
      <Banana position={[4.2, 0, -0.5]} t={t} seed="nb2" />
      <Palm position={[6, 0, -6]} height={9} t={t} seed="np" rot={2.6} />
      {/* clay stove + pot of boiling water */}
      <mesh position={[potP[0], 0.15, potP[2]]} castShadow>
        <cylinderGeometry args={[0.3, 0.35, 0.3, 16]} />
        <meshStandardMaterial color="#8a3f22" roughness={0.9} />
      </mesh>
      <Fire position={[potP[0], 0.08, potP[2]]} t={t} scale={0.8} />
      <Palayok position={[potP[0], 0.3, potP[2]]} scale={1.05} />
      {[0, 1, 2, 3, 4].map((i) => {
        const u = (t * 0.35 + i * 0.2) % 1;
        return (
          <mesh key={i} position={[potP[0] + Math.sin(t * 2 + i) * 0.08, 0.75 + u * 0.9, potP[2]]} scale={0.12 + u * 0.18}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28 * (1 - u)} />
          </mesh>
        );
      })}
      {/* fireflies */}
      {Array.from({ length: 22 }).map((_, i) => {
        const on = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        return (
          <mesh key={i} position={[Math.sin(t * 0.4 + i) * 4 + (random(`ff${i}`) - 0.5) * 6, 0.6 + random(`fy${i}`) * 2.2 + Math.sin(t + i) * 0.2, Math.cos(t * 0.3 + i) * 2 + 1]}>
            <sphereGeometry args={[0.035, 6, 5]} />
            <meshBasicMaterial color="#e8ff7a" transparent opacity={on} toneMapped={false} />
          </mesh>
        );
      })}
      <Person spec={{ ...LOLA, prop: null }} t={t} pose={hug ? "hug" : shot === 1 ? "talk" : "point"} expr={hug ? "laugh" : "happy"} mouth={mouthAt("lola", abs)} position={[-0.25, 0, 2.15]} rotation={hug ? Math.PI / 2 - 0.35 : Math.PI / 2 + 0.2} look={[0, 0.2]} />
      <Person spec={{ ...MIGO, prop: null, hat: null }} t={t} pose={hug ? "hug" : shot === 2 ? "talk" : "idle"} expr={shot === 2 ? "laugh" : "happy"} mouth={mouthAt("migo", abs)} position={hug ? [0.3, 0, 2.25] : [1.4, 0, 2.2]} rotation={hug ? -Math.PI / 2 + 0.35 : -Math.PI / 2 - 0.1} />
    </Stage>
  );
};

/* ------------------------------------------------------------------ RIVER: who's Rizal? */
export const RiverScene: React.FC = () => {
  const { s, local, abs, t, shot } = useScene("river");
  const k = shotT(s, local, shot);
  const water = useTex("water", (g, w, h, r) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#ff9a5a");
    gr.addColorStop(1, "#3a5f8a");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 900, ["#ffd6a0", "#ffe9c8", "#7aa0c8"], 3, 0.5);
  }, 512, [6, 6]);
  water.offset.set(t * 0.01, t * 0.02);
  const cams = [
    { position: path([[1.8, 1.0, 2.6], [1.4, 1.0, 2.2]], k), target: [0, 0.9, 0] as V3, fov: 40 },
    { position: path([[0.05, 0.78, 1.15], [0.1, 0.76, 1.0]], k), target: [0.65, 0.66, 0.1] as V3, fov: 36 },
    { position: path([[0.3, 1.2, 2.5], [0.6, 3.0, 7.5]], k), target: path([[0, 0.9, 0], [0, 1.5, -10]], k), fov: 44 },
  ];
  return (
    <Stage bg="#ffb07a" fog={["#ffb88a", 30, 160]} sun={{ position: [-30, 8, -40], intensity: 2.8, color: "#ffb06b", shadow: 8 }} hemi={["#ffcfa6", "#3a2a4a", 0.8]} rim={{ position: [-20, 6, -30], color: "#ff7a5a", intensity: 1.6 }}>
      <Cam {...cams[Math.min(shot, 2)]} />
      <Sky top="#4a3a8a" mid="#ff8a6a" horizon="#ffd08a" sun={{ dir: [-0.55, 0.06, -0.83], color: "#ffe3a0", size: 60 }} />
      <Clouds seed="river" t={t} n={7} y={70} color="#ffb8c8" />
      {/* bank */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 6]} receiveShadow>
        <planeGeometry args={[80, 14]} />
        <meshStandardMaterial color="#7a9a4a" roughness={1} />
      </mesh>
      {/* wooden pier where they sit */}
      <mesh position={[0, 0.3, -0.2]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.1, 2.4]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
      </mesh>
      {/* the Pasig */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, -40]}>
        <planeGeometry args={[300, 80]} />
        <meshStandardMaterial map={water} roughness={0.15} metalness={0.3} />
      </mesh>
      <Banca position={[-5, 0, -8]} rotation={0.3} t={t} seed="bk1" color="#e63946" />
      <Banca position={[7, 0, -14]} rotation={-0.4} t={t} seed="bk2" color="#2a9d8f" />
      <Banca position={[-14, 0, -22]} rotation={0.1} t={t} seed="bk3" color="#ffd23f" />
      {[-24, -16, 18, 28].map((x, i) => (
        <NipaHut key={i} position={[x, -0.5, -30 - (i % 2) * 6]} rotation={i * 0.4} />
      ))}
      {[-10, 12].map((x, i) => (
        <Palm key={i} position={[x, 0, 3]} height={8 + i} t={t} seed={`rp${i}`} rot={i * 2} />
      ))}
      {/* Intramuros walls on the far bank */}
      <mesh position={[30, 2.5, -70]}>
        <boxGeometry args={[60, 5, 3]} />
        <meshStandardMaterial color="#8f7a6a" roughness={1} />
      </mesh>
      <Person spec={{ ...MIGO, prop: null }} t={t} pose="sitFloor" expr={shot === 0 ? "happy" : shot === 1 ? "shock" : "worried"} mouth={mouthAt("migo", abs)} position={[-0.35, 0.2, 0.3]} rotation={0.25} />
      <Person spec={KID} t={t} pose="sitFloor" expr={shot === 1 ? "worried" : "happy"} mouth={mouthAt("kid", abs)} position={[0.65, 0.24, 0.1]} rotation={-0.35} headTurn={shot === 1 ? -0.5 : -0.3} />
    </Stage>
  );
};
