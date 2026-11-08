import { random } from "remotion";
import type { Hair, Spec } from "./three/Person";

export const MIGO: Spec = {
  seed: "migo",
  height: 1.72,
  build: 0.95,
  skin: "#b67b52",
  hair: "fluffy",
  hairColor: "#1d140e",
  hairTips: "#e8c26a",
  eyes: "#2b1a10",
  outfit: "hoodie",
  top: "#8e5cff",
  bottom: "#8fb7e8",
  bottomPattern: { kind: "denim", colors: [], rips: true },
  shoes: "#fbfbf8",
  hat: "bucket",
  hatColor: "#f3ead2",
  hatPattern: { kind: "checks", colors: ["#d7ff3a", "#ff4fa3"] },
  earbuds: true,
  print: "MAIN\nCHARACTER",
  prop: "phone",
};

export const LOLA: Spec = {
  seed: "lola",
  height: 1.5,
  build: 1.05,
  belly: 0.4,
  skin: "#9a6440",
  hair: "bun",
  hairColor: "#d8d4cc",
  eyes: "#2b1a10",
  outfit: "baro",
  top: "#f6efe0",
  topPattern: { kind: "embroidery", colors: ["#d9c9a6"] },
  bottom: "#d62839",
  bottomPattern: { kind: "stripes", colors: ["#7b1e2b", "#ffd166"], width: 26 },
  accent: "#2a9d8f",
  accentPattern: { kind: "floral", colors: ["#ffd166", "#ff6b9a", "#ffffff"] },
  shoes: "#6b3f24",
  glasses: true,
  prop: "fan",
};

export const VENDOR: Spec = {
  seed: "tomas",
  height: 1.66,
  build: 1.2,
  belly: 0.8,
  skin: "#8d5a3b",
  hair: "short",
  hairColor: "#15100c",
  beard: "mustache",
  outfit: "camisa",
  top: "#ffd166",
  topPattern: { kind: "stripes", colors: ["#f08a24"], width: 20, vertical: true },
  bottom: "#264653",
  shoes: null,
  hat: "salakot",
  hatColor: "#d8b36a",
};

export const TINDERA: Spec = {
  seed: "rosa",
  height: 1.55,
  build: 1.15,
  belly: 0.5,
  skin: "#a8693f",
  hair: "bun",
  hairColor: "#15100c",
  outfit: "baro",
  top: "#fff6ea",
  bottom: "#7b2cbf",
  bottomPattern: { kind: "checks", colors: ["#ff006e", "#3a0ca3"] },
  accent: "#ffbe0b",
  accentPattern: { kind: "stripes", colors: ["#fb5607"], width: 18 },
  shoes: null,
  prop: "batirol",
};

export const OFFICER: Spec = {
  seed: "teniente",
  height: 1.78,
  build: 1.1,
  belly: 0.5,
  skin: "#e3b48f",
  hair: "short",
  hairColor: "#3a2414",
  beard: "full",
  eyes: "#3d5a2a",
  outfit: "officer",
  top: "#1f3a7a",
  bottom: "#f4f1ea",
  shoes: "#14110f",
  hat: "kepi",
  hatColor: "#1f3a7a",
  prop: "book",
};

export const cuadrillero = (i: number): Spec => ({
  seed: `cuad${i}`,
  height: 1.62 + i * 0.06,
  build: 1.0 + i * 0.1,
  skin: ["#8d5a3b", "#a8693f"][i % 2],
  hair: "short",
  hairColor: "#15100c",
  beard: i % 2 ? "mustache" : undefined,
  outfit: "cuadrillero",
  top: "#f6f1e6",
  bottom: "#23395b",
  shoes: null,
  hat: "salakot",
  hatColor: "#c9a35f",
  prop: "lance",
});

export const FRIAR: Spec = {
  seed: "anselmo",
  height: 1.8,
  build: 1.15,
  belly: 0.7,
  skin: "#efc9a8",
  hair: "tonsure",
  hairColor: "#6b4a30",
  eyes: "#4a6a8a",
  outfit: "friar",
  top: "#f4f1ea",
  bottom: "#f4f1ea",
  shoes: "#2a1a10",
};

export const KID: Spec = {
  seed: "buboy",
  height: 1.18,
  build: 0.95,
  kid: true,
  skin: "#9a6440",
  hair: "curly",
  hairColor: "#15100c",
  outfit: "camisa",
  top: "#2ec4b6",
  bottom: "#3a2c24",
  shoes: null,
};

export const BARISTA: Spec = {
  seed: "barista",
  height: 1.6,
  build: 0.95,
  skin: "#c38a5c",
  hair: "ponytail",
  hairColor: "#5a2d1a",
  outfit: "barista",
  top: "#ff8fb1",
  bottom: "#2b2d42",
  accent: "#3d2b1f",
  shoes: "#ffffff",
  hat: "cap",
  hatColor: "#2ec4b6",
};

export const modern = (i: number): Spec => {
  const r = (k: string) => random(`modern-${i}-${k}`);
  const hairs: Hair[] = ["curly", "long", "short", "ponytail", "afro", "bun", "fluffy"];
  return {
    seed: `modern${i}`,
    height: 1.55 + r("h") * 0.3,
    build: 0.85 + r("b") * 0.4,
    skin: ["#8d5a3b", "#c38a5c", "#e8c09a", "#6b4129", "#b67b52"][i % 5],
    hair: hairs[i % hairs.length],
    hairColor: ["#15100c", "#5a2d1a", "#d28f3a", "#ff6b9a", "#2b1b12"][i % 5],
    glasses: r("g") > 0.6,
    outfit: "tee",
    top: ["#ffd23f", "#2ec4b6", "#ff6b4a", "#3d7bff", "#f4f1ea", "#06d6a0"][i % 6],
    topPattern: r("p") > 0.6 ? { kind: "stripes", colors: ["#ffffff"], width: 18 } : undefined,
    bottom: ["#2b2d42", "#8fb7e8", "#f4a261", "#3a2c24"][i % 4],
    bottomPattern: i % 4 === 1 ? { kind: "denim", colors: [] } : undefined,
    shoes: ["#ffffff", "#ff4fa3", "#111111"][i % 3],
    earbuds: r("e") > 0.5,
    prop: i % 2 ? "cup" : "phoneLit",
  };
};

/* ------------------------------------------------------------------ 1850 crowd generator */
const SKINS = ["#7a4a2f", "#8d5a3b", "#9a6440", "#a8693f", "#b07a4f", "#c38a5c", "#d9a77b", "#e8c09a"];
const SAYAS = ["#d62839", "#7b2cbf", "#2a9d8f", "#f4a261", "#e9c46a", "#3a86ff", "#ff006e", "#06d6a0", "#118ab2", "#ef476f"];
const PANUELOS = ["#ffd166", "#ff6b9a", "#06d6a0", "#ffffff", "#8ecae6", "#ffbe0b", "#cdb4db"];
const CAMISAS = ["#f6f1e6", "#cfe8ff", "#fff1b8", "#ffd6e0", "#d8f3dc", "#f6f1e6"];
const PANTS = ["#f6f1e6", "#23395b", "#3a2c24", "#6d597a", "#264653"];

export const crowd1850 = (i: number): Spec => {
  const r = (k: string) => random(`c1850-${i}-${k}`);
  const role = r("role");
  const age = r("age");
  const elder = age > 0.82;
  const kid = age < 0.14;
  const skin = SKINS[Math.floor(r("skin") * SKINS.length)];
  const hairColor = elder ? (r("g") > 0.5 ? "#d8d4cc" : "#9d978f") : r("hc") > 0.85 ? "#2b1b12" : "#15100c";
  const pick = <T,>(arr: T[], k: string) => arr[Math.floor(r(k) * arr.length)];
  const base = { seed: `c1850-${i}`, skin, hairColor, build: 0.85 + r("b") * 0.45, belly: r("bl") > 0.7 ? r("bl2") : 0 };

  if (kid) {
    return {
      ...base,
      height: 1.0 + r("h") * 0.3,
      build: 0.9,
      kid: true,
      hair: r("kh") > 0.5 ? "curly" : "short",
      outfit: "camisa",
      top: pick(SAYAS, "kt"),
      bottom: pick(PANTS, "kb"),
      shoes: null,
    };
  }
  if (role < 0.42) {
    // Tagalog woman in baro't saya
    return {
      ...base,
      height: 1.45 + r("h") * 0.15,
      hair: elder ? "bun" : pick(["bun", "long", "braid", "bun"] as Hair[], "wh"),
      outfit: "baro",
      top: r("bt") > 0.3 ? "#fbf6ec" : "#fff1d6",
      topPattern: r("emb") > 0.5 ? { kind: "embroidery", colors: ["#e3d3b0"] } : undefined,
      bottom: pick(SAYAS, "saya"),
      bottomPattern: r("sp") > 0.35 ? (r("sp2") > 0.5 ? { kind: "stripes", colors: [pick(SAYAS, "s2"), "#fff3dc"], width: 22 } : { kind: "checks", colors: [pick(SAYAS, "c2"), "#14110f"] }) : undefined,
      accent: pick(PANUELOS, "pan"),
      accentPattern: r("pp") > 0.4 ? { kind: "floral", colors: [pick(SAYAS, "f1"), pick(SAYAS, "f2"), "#ffffff"] } : undefined,
      shoes: r("sh") > 0.5 ? "#6b3f24" : null,
      hat: r("veil") > 0.85 ? "veil" : null,
      hatColor: "#ffffff",
      prop: r("prop") > 0.7 ? "fan" : r("prop") > 0.55 ? "parasol" : null,
    };
  }
  if (role < 0.78) {
    // Tagalog man: barong or camisa chino, maybe salakot
    const barong = r("bar") > 0.55;
    return {
      ...base,
      height: 1.58 + r("h") * 0.16,
      hair: elder ? "bald" : pick(["short", "curly", "short"] as Hair[], "mh"),
      beard: r("bd") > 0.75 ? "mustache" : undefined,
      outfit: barong ? "barong" : "camisa",
      top: barong ? "#f3ead2" : pick(CAMISAS, "cm"),
      topPattern: barong ? { kind: "embroidery", colors: ["#d9c9a6"] } : r("cp") > 0.6 ? { kind: "stripes", colors: [pick(SAYAS, "cs")], width: 14, vertical: true } : undefined,
      bottom: pick(PANTS, "mp"),
      bottomPattern: !barong && r("mpp") > 0.7 ? { kind: "checks", colors: ["#d62839", "#14110f"] } : undefined,
      shoes: barong ? "#2a1a10" : null,
      hat: r("hat") > 0.45 ? "salakot" : r("hat") > 0.25 ? "straw" : null,
      hatColor: "#d8b36a",
      prop: r("pr") > 0.85 ? "cane" : null,
    };
  }
  if (role < 0.9) {
    // Chinese merchant of Binondo
    return {
      ...base,
      skin: pick(["#d9a77b", "#e8c09a", "#c9956a"], "cs"),
      height: 1.6 + r("h") * 0.12,
      hair: "queue",
      beard: r("cb") > 0.7 ? "mustache" : undefined,
      outfit: "changshan",
      top: pick(["#1d3557", "#264653", "#3a0ca3", "#14213d", "#6a040f"], "ct"),
      bottom: "#14110f",
      shoes: "#14110f",
      hat: "skullcap",
      hatColor: "#14110f",
    };
  }
  // mestiza / Spanish lady with parasol, or a gentleman
  if (r("sex") > 0.5) {
    return {
      ...base,
      skin: pick(["#e8c09a", "#f1d1b5", "#d9a77b"], "ls"),
      height: 1.55 + r("h") * 0.1,
      hair: "bun",
      hairColor: pick(["#3a2414", "#15100c", "#6b3f24"], "lh"),
      outfit: "dress",
      top: pick(["#ffd6e0", "#cdb4db", "#bde0fe", "#ffe5b4"], "dt"),
      bottom: pick(["#ff8fb1", "#a2d2ff", "#ffc8dd", "#ffe066"], "db"),
      bottomPattern: { kind: "stripes", colors: ["#ffffff"], width: 12, vertical: true },
      shoes: "#3a2414",
      prop: "parasol",
    };
  }
  return {
    ...base,
    skin: pick(["#e8c09a", "#f1d1b5"], "gs"),
    height: 1.7 + r("h") * 0.1,
    hair: "short",
    hairColor: pick(["#3a2414", "#6b3f24", "#15100c"], "gh"),
    beard: r("gb") > 0.4 ? "full" : "mustache",
    outfit: "european",
    top: pick(["#1b1b1f", "#2d4a3e", "#3b2a1e"], "gt"),
    bottom: pick(["#e9e2d0", "#8a8378"], "gp"),
    shoes: "#14110f",
    hat: "tophat",
    hatColor: "#1b1b1f",
    prop: "cane",
  };
};
