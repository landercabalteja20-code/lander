import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/jetbrains-mono/700.css";
import { useEffect, useState } from "react";
import { AbsoluteFill, Sequence, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, beats, prog } from "./lib";
import { Captions, Flash, HookTitle, Hud, Lens, OutroCard } from "./Overlays";
import { BedScene, CatScene, FallScene, HookScene } from "./scenes/Bedroom";
import { CarpetScene, DoorScene, DropScene, RiceScene } from "./scenes/Floor";
import { AntsScene, LeafScene, RainScene } from "./scenes/Outside";

const SCENES: Record<string, React.FC<{ dur: number }>> = {
  hook: HookScene,
  bed: BedScene,
  fall: FallScene,
  cat: CatScene,
  carpet: CarpetScene,
  rice: RiceScene,
  drop: DropScene,
  door: DoorScene,
  ants: AntsScene,
  rain: RainScene,
  leaf: LeafScene,
};

/** Quick "lens punch" on every cut. */
const Cut: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const k = prog(frame, 0, 9);
  return <AbsoluteFill style={{ transform: `scale(${1.07 - 0.07 * k})`, filter: k < 1 ? `blur(${(1 - k) * 8}px)` : undefined }}>{children}</AbsoluteFill>;
};

const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'),
      document.fonts.load('700 80px "Bricolage Grotesque"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
    ]).then(() => continueRender(handle));
  }, [handle]);
};

export const AntsVideo: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {beats.map((b) => {
        const Scene = SCENES[b.id];
        if (!Scene) return null;
        return (
          <Sequence key={b.id} from={b.from} durationInFrames={b.dur} name={`scene:${b.id}`}>
            <Cut>
              <Scene dur={b.dur} />
            </Cut>
          </Sequence>
        );
      })}
      <Lens />
      {beats
        .filter((b) => b.id === "rain")
        .map((b) => (
          <Sequence key="flash" from={b.from} durationInFrames={20}>
            <Flash />
          </Sequence>
        ))}
      <Hud />
      <Sequence from={0} durationInFrames={beats[0].dur} name="title">
        <HookTitle dur={beats[0].dur} />
      </Sequence>
      <Captions />
      {beats
        .filter((b) => b.id === "outro")
        .map((b) => (
          <Sequence key="outro" from={b.from} durationInFrames={b.dur} name="outro">
            <OutroCard dur={b.dur} />
          </Sequence>
        ))}
      {withAudio ? <Audio src={staticFile("ants/mix.mp3")} /> : null}
    </AbsoluteFill>
  );
};
