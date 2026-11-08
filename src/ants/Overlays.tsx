import { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FPS, beats, msToFrame, prog, timeline, wordFrame, type Word } from "./lib";

/* ------------------------------------------------------------------ Lens: tilt-shift blur + vignette + grain */
export const Lens: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backdropFilter: "blur(7px)",
          WebkitBackdropFilter: "blur(7px)",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 22%, transparent 74%, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 22%, transparent 74%, black 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 60% at 50% 48%, transparent 55%, rgba(10,6,3,0.55) 100%)" }} />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.09, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 24} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Captions: 1-3 word pages, active word on a lime tag */
type Page = { words: Word[]; startMs: number; endMs: number };

const buildPages = (): Page[] => {
  const pages: Page[] = [];
  for (const b of beats) {
    if (b.id === "hook") continue;
    const ws = timeline.words.filter((w) => w.startMs >= b.voiceStartMs - 20 && w.startMs <= b.voiceEndMs + 50);
    let cur: Word[] = [];
    const flush = () => {
      if (cur.length) pages.push({ words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs });
      cur = [];
    };
    for (const w of ws) {
      const chars = cur.map((x) => x.text.trim()).join(" ").length + w.text.trim().length;
      if (cur.length >= 3 || (cur.length && chars > 15)) flush();
      cur.push(w);
      if (/[.,?!]$/.test(w.text.trim())) flush();
    }
    flush();
  }
  // each page stays until the next page starts (max +400ms after last word)
  return pages.map((p, i) => ({ ...p, endMs: Math.min(pages[i + 1]?.startMs ?? Infinity, p.endMs + 400) }));
};

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(buildPages, []);
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.endMs);
  if (!page) return null;
  const local = frame - msToFrame(page.startMs);
  const pop = spring({ frame: local, fps, config: { damping: 14, stiffness: 220 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", top: 1090, height: 360, justifyContent: "flex-start" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 18px",
          maxWidth: 860,
          transform: `translateY(${(1 - pop) * 24}px) scale(${0.92 + pop * 0.08})`,
          opacity: pop,
        }}
      >
        {page.words.map((w, i) => {
          const next = page.words[i + 1];
          const active = ms >= w.startMs && (next ? ms < next.startMs : true);
          const said = ms >= w.startMs;
          return (
            <span
              key={i}
              style={{
                fontFamily: C.display,
                fontWeight: 800,
                fontSize: 92,
                lineHeight: 1.08,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                padding: "2px 18px 8px",
                borderRadius: 18,
                color: active ? C.ink : C.cream,
                background: active ? C.lime : "transparent",
                transform: active ? "rotate(-2deg) scale(1.06)" : "none",
                opacity: said ? 1 : 0.55,
                textShadow: active ? "none" : "0 4px 0 rgba(0,0,0,0.55), 0 0 28px rgba(0,0,0,0.6)",
                WebkitTextStroke: active ? "0" : "2px rgba(21,17,13,0.6)",
              }}
            >
              {w.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ HUD: day clock + live stat + scale ruler */
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

export const Hud: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = beats.findIndex((b) => frame >= b.from && frame < b.from + b.dur);
  const b = beats[Math.max(0, idx)];
  if (!b || b.id === "outro") return null;
  const local = frame - b.from;
  const prev = beats[Math.max(0, idx - 1)];
  const roll = prog(local, 0, 22);
  const minutes = idx > 0 ? interpolate(roll, [0, 1], [toMin(prev.clock), toMin(b.clock)]) : toMin(b.clock);
  const fadeIn = prog(frame, 8, 26);
  const statIn = prog(local, 4, 16);

  let value = b.stat[1];
  if (b.id === "ants") {
    const end = wordFrame("ants", "million");
    const n = Math.round(interpolate(local, [6, end + 6], [0, 2_500_000], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) }));
    value = n.toLocaleString("en-US");
  }

  const label: React.CSSProperties = { fontFamily: C.mono, fontSize: 24, letterSpacing: "0.18em", color: C.lime, fontWeight: 700 };
  const shadow = "0 2px 12px rgba(0,0,0,0.65)";
  return (
    <AbsoluteFill style={{ opacity: fadeIn, textShadow: shadow }}>
      <div style={{ position: "absolute", left: 70, top: 150 }}>
        <div style={label}>DAY 1 · LOCAL TIME</div>
        <div style={{ fontFamily: C.mono, fontWeight: 700, fontSize: 76, color: C.cream, letterSpacing: "-0.02em", lineHeight: 1.05 }}>{fmt(minutes)}</div>
        <div style={{ marginTop: 22, overflow: "hidden" }}>
          <div style={{ transform: `translateX(${(1 - statIn) * -110}%)` }}>
            <div style={label}>{b.stat[0]}</div>
            <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 54, color: C.cream, lineHeight: 1.05 }}>{value}</div>
          </div>
        </div>
      </div>
      {/* scale ruler */}
      <div style={{ position: "absolute", right: 70, top: 162, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <div style={{ ...label, color: C.cream }}>SCALE 1 : 1000</div>
        <svg width="210" height="46" style={{ marginTop: 10, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}>
          <rect x="0" y="16" width="210" height="6" fill={C.cream} />
          {Array.from({ length: 11 }).map((_, i) => (
            <rect key={i} x={i * 20.4} y={i % 5 === 0 ? 2 : 8} width="3" height={i % 5 === 0 ? 20 : 12} fill={C.cream} />
          ))}
          <rect x="0" y="30" width={20.4 * 1.7} height="10" rx="3" fill={C.lime} />
        </svg>
        <div style={{ ...label, fontSize: 20, marginTop: 4 }}>YOU = 1.7 mm</div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Hook title */
export const HookTitle: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = [
    { t: "WHAT IF", size: 60, mono: true },
    { t: "HUMANS SHRANK", size: 112 },
    { t: "TO THE SIZE OF", size: 112 },
    { t: "ANTS", size: 210, hl: true },
    { t: "OVERNIGHT?", size: 112 },
  ];
  const out = prog(frame, dur - 10, dur);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 430, opacity: 1 - out, transform: `translateY(${-out * 80}px)` }}>
      {lines.map((l, i) => {
        const s = spring({ frame: frame - 4 - i * 5, fps, config: { damping: 13, stiffness: 180 } });
        return (
          <div
            key={i}
            style={{
              fontFamily: l.mono ? C.mono : C.display,
              fontWeight: 800,
              fontSize: l.size,
              lineHeight: 0.98,
              letterSpacing: l.mono ? "0.3em" : "-0.03em",
              color: l.hl ? C.ink : C.cream,
              background: l.hl ? C.lime : "transparent",
              padding: l.hl ? "0 34px 14px" : 0,
              borderRadius: 26,
              margin: l.hl ? "14px 0" : 0,
              transform: `translateY(${(1 - s) * 60}px) rotate(${l.hl ? -3 : 0}deg) scale(${l.hl ? 0.6 + s * 0.4 : 1})`,
              opacity: s,
              textShadow: l.hl ? "none" : "0 6px 0 rgba(0,0,0,0.45), 0 0 40px rgba(0,0,0,0.5)",
            }}
          >
            {l.t}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Outro card */
const WalkingAnt: React.FC<{ x: number; t: number }> = ({ x, t }) => {
  const s = Math.sin(t * 18);
  return (
    <svg width="150" height="80" viewBox="0 0 150 80" style={{ position: "absolute", left: x, bottom: 0 }}>
      {[0, 1, 2].map((i) => (
        <g key={i} stroke={C.ink} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d={`M ${62 + i * 14} 44 L ${56 + i * 14 + (i % 2 ? s : -s) * 8} 72`} />
          <path d={`M ${62 + i * 14} 44 L ${70 + i * 14 + (i % 2 ? -s : s) * 8} 72`} />
        </g>
      ))}
      <ellipse cx="38" cy="40" rx="28" ry="20" fill={C.ink} />
      <ellipse cx="78" cy="40" rx="16" ry="11" fill={C.ink} />
      <circle cx="108" cy="36" r="15" fill={C.ink} />
      <path d={`M 115 24 Q 128 ${4 + s * 3} 142 10`} stroke={C.ink} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
};

export const OutroCard: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / FPS;
  const inn = spring({ frame, fps, config: { damping: 16 } });
  const cta = spring({ frame: frame - 40, fps, config: { damping: 11, stiffness: 160 } });
  const pulse = 1 + 0.03 * Math.sin(t * 6);
  return (
    <AbsoluteFill style={{ background: C.cream, alignItems: "center", justifyContent: "center", clipPath: `circle(${inn * 120}% at 50% 60%)` }}>
      <div style={{ position: "absolute", top: 260, fontFamily: C.mono, fontSize: 30, letterSpacing: "0.3em", color: C.ink, opacity: 0.6 }}>
        WHAT IF · EP. ANTS
      </div>
      <div style={{ fontFamily: C.display, fontWeight: 800, fontSize: 128, lineHeight: 0.98, letterSpacing: "-0.04em", textAlign: "center", color: C.ink, padding: "0 70px" }}>
        WOULD YOU SURVIVE <span style={{ background: C.lime, borderRadius: 24, padding: "0 22px 8px", display: "inline-block", transform: "rotate(-2deg)" }}>DAY ONE?</span>
      </div>
      <div style={{ marginTop: 50, fontFamily: C.display, fontWeight: 700, fontSize: 40, color: C.ink, opacity: 0.75, textAlign: "center", padding: "0 120px", lineHeight: 1.25 }}>
        Ants have lived at this size for over 100 million years.
      </div>
      <div style={{ marginTop: 70, transform: `scale(${cta * pulse})`, background: C.ink, color: C.lime, fontFamily: C.mono, fontWeight: 700, fontSize: 36, letterSpacing: "0.12em", padding: "26px 44px", borderRadius: 999 }}>
        ANSWER IN THE COMMENTS ↓
      </div>
      <div style={{ position: "absolute", bottom: 470, left: 0, right: 0, height: 80 }}>
        <WalkingAnt x={-160 + frame * 9} t={t} />
        <WalkingAnt x={-420 + frame * 9} t={t + 0.3} />
      </div>
      <div style={{ position: "absolute", bottom: 466, left: 70, right: 70, height: 4, background: C.ink, opacity: 0.15 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ Lightning flash for the storm */
export const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const a = Math.max(0, 1 - Math.abs(frame - 3) / 3) * 0.85 + Math.max(0, 1 - Math.abs(frame - 10) / 2) * 0.6;
  return <AbsoluteFill style={{ background: "#eef4ff", opacity: a, mixBlendMode: "screen" }} />;
};
