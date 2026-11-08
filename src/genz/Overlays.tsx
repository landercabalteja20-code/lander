import { useMemo } from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, NAMES, lines, msToFrame, prog, sceneById, scenes, type Line, type Word } from "./lib";

const SPEAKER_COLOR: Record<string, string> = {
  lola: "#2ec4b6",
  vendor: "#ff7b2e",
  officer: "#3d7bff",
  friar: "#f4f1ea",
  kid: "#06d6a0",
};
const LANG: Record<string, string> = { lola: "TAGALOG", vendor: "TAGALOG", kid: "TAGALOG", officer: "ESPAÑOL", friar: "ESPAÑOL" };

const activeLine = (frame: number) => lines.find((l) => frame >= l.from - 3 && frame <= l.to + 8);

/* ------------------------------------------------------------------ narrator captions */
type Page = { words: Word[]; startMs: number; endMs: number };
const pagesFor = (l: Line): Page[] => {
  const out: Page[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) out.push({ words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs });
    cur = [];
  };
  for (const w of l.words) {
    const chars = cur.map((x) => x.text).join(" ").length + w.text.length;
    if (cur.length >= 3 || (cur.length && chars > 16)) flush();
    cur.push(w);
    if (/[.,?!:]$/.test(w.text)) flush();
  }
  flush();
  return out.map((p, i) => ({ ...p, endMs: Math.min(out[i + 1]?.startMs ?? Infinity, p.endMs + 350) }));
};

export const NarratorCaptions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(() => lines.filter((l) => l.speaker === "narrator" && l.i !== 0 && l.scene !== "outro").flatMap(pagesFor), []);
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;
  const pop = spring({ frame: frame - msToFrame(page.startMs), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ top: 1180, height: 320, alignItems: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 16px", maxWidth: 880, transform: `translateY(${(1 - pop) * 22}px) scale(${0.93 + 0.07 * pop})`, opacity: pop }}>
        {page.words.map((w, i) => {
          const next = page.words[i + 1];
          const active = ms >= w.startMs && (next ? ms < next.startMs : true);
          return (
            <span
              key={i}
              style={{
                fontFamily: C.display,
                fontWeight: 800,
                fontSize: 86,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                padding: "2px 16px 8px",
                borderRadius: 16,
                color: active ? C.ink : C.cream,
                background: active ? C.lime : "transparent",
                transform: active ? "rotate(-2deg) scale(1.05)" : "none",
                opacity: ms >= w.startMs ? 1 : 0.55,
                textShadow: active ? "none" : "0 4px 0 rgba(0,0,0,0.55), 0 0 26px rgba(0,0,0,0.65)",
                WebkitTextStroke: active ? "0" : "2px rgba(20,17,15,0.55)",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ dialogue bubbles */
export const Dialogue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = activeLine(frame);
  if (!l || l.speaker === "narrator") return null;
  const ms = (frame / fps) * 1000;
  const inn = spring({ frame: frame - l.from + 3, fps, config: { damping: 13, stiffness: 200 } });
  const out = prog(frame, l.to + 2, l.to + 8);
  const shown = l.words.filter((w) => ms >= w.startMs - 60);
  const isMigo = l.speaker === "migo";
  const transIn = prog(frame, l.from + 6, l.from + 14);

  if (isMigo) {
    return (
      <AbsoluteFill style={{ top: 1150, alignItems: "flex-end", paddingRight: 70, opacity: 1 - out }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * inn}) translateY(${(1 - inn) * 40}px)`, transformOrigin: "bottom right", display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: 820 }}>
          <div style={{ fontFamily: C.mono, fontSize: 24, letterSpacing: "0.16em", color: C.lime, fontWeight: 700, marginBottom: 10, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>{NAMES.migo} · GEN Z</div>
          <div
            style={{
              background: "linear-gradient(135deg, #8e5cff 0%, #ff4fa3 100%)",
              color: "#fff",
              fontFamily: C.display,
              fontWeight: 800,
              fontSize: 60,
              lineHeight: 1.12,
              padding: "26px 36px 30px",
              borderRadius: "44px 44px 10px 44px",
              boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
            }}
          >
            {shown.map((w, i) => (
              <span key={i} style={{ opacity: i === shown.length - 1 ? prog(ms, w.startMs - 60, w.startMs + 60, (x) => x) : 1 }}>
                {w.text}{" "}
              </span>
            ))}
            {shown.length < l.words.length ? <span style={{ opacity: 0.6 }}>▍</span> : null}
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  const col = SPEAKER_COLOR[l.speaker] ?? C.gold;
  return (
    <AbsoluteFill style={{ top: 1120, alignItems: "flex-start", paddingLeft: 70, opacity: 1 - out }}>
      <div style={{ transform: `scale(${0.6 + 0.4 * inn}) translateY(${(1 - inn) * 40}px)`, transformOrigin: "bottom left", maxWidth: 860 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
          <div style={{ fontFamily: C.mono, fontSize: 25, fontWeight: 700, letterSpacing: "0.12em", color: C.ink, background: col, padding: "6px 14px", borderRadius: 10 }}>{NAMES[l.speaker]}</div>
          <div style={{ fontFamily: C.mono, fontSize: 21, fontWeight: 700, letterSpacing: "0.14em", color: C.cream, border: `2px solid ${C.cream}`, padding: "4px 10px", borderRadius: 10, textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
            {LANG[l.speaker]}
          </div>
        </div>
        <div style={{ background: C.cream, color: C.ink, fontFamily: C.display, fontWeight: 800, fontSize: 60, lineHeight: 1.1, padding: "24px 34px 28px", borderRadius: "44px 44px 44px 10px", boxShadow: "0 18px 40px rgba(0,0,0,0.35)", borderLeft: `14px solid ${col}` }}>
          {shown.map((w, i) => (
            <span key={i}>{w.text} </span>
          ))}
          {l.translation ? (
            <div style={{ marginTop: 12, fontFamily: C.display, fontWeight: 700, fontStyle: "italic", fontSize: 36, color: "#5b524a", opacity: transIn }}>“{l.translation}”</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ HUD */
const sceneAt = (frame: number) => scenes.find((s) => frame >= s.from && frame < s.from + s.dur) ?? scenes[scenes.length - 1];

const Battery: React.FC<{ pct: number; frame: number }> = ({ pct, frame }) => {
  const low = pct <= 5;
  const blink = low && pct > 0 ? (Math.floor(frame / 8) % 2 ? 0.4 : 1) : 1;
  const col = pct === 0 ? "#ff3b3b" : low ? "#ff3b3b" : pct < 20 ? "#ffb347" : C.lime;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: blink }}>
      <div style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 34, color: col }}>{pct}%</div>
      <div style={{ width: 70, height: 34, border: `4px solid ${C.cream}`, borderRadius: 9, position: "relative", padding: 3 }}>
        <div style={{ width: `${Math.max(pct, pct === 0 ? 0 : 6)}%`, height: "100%", background: col, borderRadius: 3 }} />
        <div style={{ position: "absolute", right: -10, top: 8, width: 6, height: 12, background: C.cream, borderRadius: 2 }} />
        {pct === 0 ? <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.mono, fontWeight: 700, fontSize: 22, color: "#ff3b3b" }}>✕</div> : null}
      </div>
    </div>
  );
};

export const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const s = sceneAt(frame);
  if (s.id === "outro") return null;
  const idx = scenes.indexOf(s);
  const prev = scenes[Math.max(0, idx - 1)];
  const local = frame - s.from;
  const k = prog(local, 0, 24);
  const odds = Math.round(interpolate(k, [0, 1], [prev.odds, s.odds]));
  // battery: drains inside the phone scene, revives at the ping
  let battery = s.battery;
  if (s.id === "phone") {
    const ph = sceneById("phone");
    const die = ph.lines[1].from - ph.from - 25;
    battery = Math.round(interpolate(local, [10, die], [9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  }
  if (s.id === "ending") {
    const ping = lines.find((l) => l.scene === "ending")!;
    battery = frame < ping.from + Math.round((ping.to - ping.from) * 0.62) ? 0 : 1;
  }
  const oddsCol = odds > 65 ? C.lime : odds > 35 ? C.gold : "#ff4f5e";
  const label: React.CSSProperties = { fontFamily: C.mono, fontSize: 23, letterSpacing: "0.18em", color: C.cream, fontWeight: 700, opacity: 0.85 };
  const fadeIn = prog(frame, 6, 22);
  return (
    <AbsoluteFill style={{ opacity: fadeIn, textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
      <div style={{ position: "absolute", left: 66, top: 140 }}>
        <div style={label}>{s.place || " "}</div>
        <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 96, color: s.year === "2026" ? C.lime : C.gold, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.id === "warp" ? <WarpYear /> : s.year}</div>
      </div>
      <div style={{ position: "absolute", right: 66, top: 146, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 18 }}>
        <Battery pct={battery} frame={frame} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={label}>SURVIVAL ODDS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
            <div style={{ width: 170, height: 14, borderRadius: 7, background: "rgba(255,243,223,0.25)", overflow: "hidden" }}>
              <div style={{ width: `${odds}%`, height: "100%", background: oddsCol }} />
            </div>
            <div style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 38, color: oddsCol }}>{odds}%</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const WarpYear: React.FC = () => {
  const frame = useCurrentFrame();
  const w = sceneById("warp");
  const k = prog(frame, w.from + 4, w.from + w.dur - 4, (x) => x * x);
  return <span>{Math.round(interpolate(k, [0, 1], [2026, 1850]))}</span>;
};

/* ------------------------------------------------------------------ big warp counter */
export const WarpOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const w = sceneById("warp");
  const local = frame - w.from;
  if (local < 0 || local > w.dur + 6) return null;
  const k = prog(local, 4, w.dur - 4, (x) => x * x);
  const year = Math.round(interpolate(k, [0, 1], [2026, 1850]));
  const jitter = (random(`wj${frame}`) - 0.5) * 18;
  const fade = 1 - prog(local, w.dur - 2, w.dur + 6);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fade }}>
      <div
        style={{
          fontFamily: C.display,
          fontWeight: 800,
          fontSize: 300,
          letterSpacing: "-0.05em",
          color: C.cream,
          transform: `translateX(${jitter}px) skewX(${jitter * 0.4}deg)`,
          textShadow: `${-8 + jitter * 0.3}px 0 0 #ff4fa3, ${8 - jitter * 0.3}px 0 0 #2ec4ff, 0 0 60px rgba(215,255,58,0.6)`,
        }}
      >
        {year}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ fact chips */
const FACTS: Record<string, { text: string; at: string }> = {
  plaza: { text: "Spanish rule began in 1565", at: "colony" },
  phone: { text: "Manila's first electric street lights: 1895", at: "electricity" },
  market: { text: "The Americans arrive in 1898", at: "Americans" },
  catalog: { text: "Clavería surname decree: Nov. 21, 1849", at: "Clavería" },
  polo: { text: "Polo y servicio: 40 days of forced labor a year", at: "forty" },
  night: { text: "A cholera epidemic hit Manila in 1820", at: "Cholera" },
  river: { text: "José Rizal is born on June 19, 1861", at: "José" },
};

export const FactChip: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = sceneAt(frame);
  const f = FACTS[s.id];
  if (!f) return null;
  const w = s.lines.flatMap((l) => l.words).find((x) => x.text.toLowerCase().includes(f.at.toLowerCase()));
  const start = w ? msToFrame(w.startMs) : s.from + 20;
  const local = frame - start;
  if (local < 0 || local > 120) return null;
  const inn = spring({ frame: local, fps, config: { damping: 14 } });
  const out = prog(local, 105, 120);
  return (
    <AbsoluteFill style={{ top: 360, alignItems: "center", opacity: 1 - out }}>
      <div style={{ transform: `translateY(${(1 - inn) * -30}px) scale(${0.8 + inn * 0.2})`, display: "flex", alignItems: "center", gap: 14, background: "rgba(20,17,15,0.82)", border: `3px solid ${C.gold}`, borderRadius: 999, padding: "12px 26px" }}>
        <div style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 24, color: C.ink, background: C.gold, padding: "4px 12px", borderRadius: 999, letterSpacing: "0.12em" }}>REAL FACT</div>
        <div style={{ fontFamily: C.display, fontWeight: 700, fontSize: 34, color: C.cream }}>{f.text}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ title + outro */
export const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = lines[0];
  const end = l.to + 10;
  if (frame > end + 10) return null;
  const rows: { t: string; size: number; tag?: string; mono?: boolean }[] = [
    { t: "WHAT IF A", size: 70, mono: true },
    { t: "GEN Z", size: 190, tag: C.pink },
    { t: "TIME-TRAVELED TO", size: 92 },
    { t: "THE PHILIPPINES", size: 104 },
    { t: "IN 1850?", size: 150, tag: C.lime },
  ];
  const out = prog(frame, end - 6, end + 8);
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 420, opacity: 1 - out, transform: `scale(${1 + out * 0.15})` }}>
      {rows.map((r, i) => {
        const s = spring({ frame: frame - 3 - i * 5, fps, config: { damping: 12, stiffness: 170 } });
        return (
          <div
            key={i}
            style={{
              fontFamily: r.mono ? C.mono : C.display,
              fontWeight: 800,
              fontSize: r.size,
              lineHeight: 1,
              letterSpacing: r.mono ? "0.3em" : "-0.035em",
              color: r.tag ? C.ink : C.cream,
              background: r.tag ?? "transparent",
              padding: r.tag ? "4px 30px 14px" : 0,
              margin: r.tag ? "12px 0" : 0,
              borderRadius: 24,
              transform: `translateY(${(1 - s) * 60}px) rotate(${r.tag ? (i % 2 ? 2.5 : -2.5) : 0}deg)`,
              opacity: s,
              textShadow: r.tag ? "none" : "0 6px 0 rgba(0,0,0,0.45), 0 0 40px rgba(0,0,0,0.55)",
            }}
          >
            {r.t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = sceneById("outro");
  const local = frame - o.from;
  if (local < 0) return null;
  const inn = spring({ frame: local, fps, config: { damping: 16 } });
  const b1 = spring({ frame: local - 18, fps, config: { damping: 11, stiffness: 160 } });
  const b2 = spring({ frame: local - 26, fps, config: { damping: 11, stiffness: 160 } });
  const cta = spring({ frame: local - 45, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #2b1a4a 0%, #6a2c70 45%, #f08a5d 100%)", alignItems: "center", justifyContent: "center", clipPath: `circle(${inn * 130}% at 50% 55%)` }}>
      <div style={{ position: "absolute", top: 250, fontFamily: C.mono, fontSize: 28, letterSpacing: "0.3em", color: C.cream, opacity: 0.75 }}>WHAT IF · GEN Z IN 1850</div>
      <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 124, lineHeight: 0.98, letterSpacing: "-0.04em", color: C.cream, textAlign: "center", padding: "0 60px", textShadow: "0 8px 0 rgba(0,0,0,0.25)" }}>
        WOULD YOU GO BACK?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 70, width: 820 }}>
        <div style={{ transform: `scale(${b1})`, background: C.lime, color: C.ink, borderRadius: 30, padding: "30px 40px", fontFamily: C.display, fontWeight: 800, fontSize: 54, display: "flex", justifyContent: "space-between" }}>
          <span>A · GO BACK TO 2026</span>
          <span>📱</span>
        </div>
        <div style={{ transform: `scale(${b2})`, background: C.cream, color: C.ink, borderRadius: 30, padding: "30px 40px", fontFamily: C.display, fontWeight: 800, fontSize: 54, display: "flex", justifyContent: "space-between" }}>
          <span>B · STAY FOR BIBINGKA</span>
          <span>🍰</span>
        </div>
      </div>
      <div style={{ marginTop: 60, transform: `scale(${cta})`, fontFamily: C.mono, fontWeight: 700, fontSize: 34, letterSpacing: "0.14em", color: C.ink, background: C.gold, padding: "20px 36px", borderRadius: 999 }}>
        COMMENT A OR B ↓
      </div>
      <div style={{ position: "absolute", bottom: 380, left: 90, right: 90, textAlign: "center", fontFamily: C.mono, fontSize: 21, lineHeight: 1.5, color: C.cream, opacity: 0.7 * cta }}>
        Real history: polo y servicio · Clavería surname decree (1849) · Manila street lights (1895) · Rizal born 1861 · American period from 1898
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ finishing */
export const Grade: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 62% at 50% 46%, transparent 58%, rgba(15,8,4,0.5) 100%)" }} />
    </AbsoluteFill>
  );
};

export const CutFlash: React.FC<{ color?: string; len?: number }> = ({ color = "#ffffff", len = 8 }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: color, opacity: Math.max(0, 1 - frame / len) }} />;
};
