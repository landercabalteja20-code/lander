import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/jetbrains-mono/700.css";
import { useEffect, useState } from "react";
import { AbsoluteFill, Sequence, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { C, prog, scenes } from "./lib";
import { CutFlash, Dialogue, FactChip, Grade, Hud, NarratorCaptions, Outro, Title, WarpOverlay } from "./Overlays";
import { EndingScene, FoodScene, FriarScene, JeansScene, MarketScene, PhoneScene, PlazaScene, PoliceScene } from "./scenes/Plaza";
import { CatalogScene, NightScene, PoloScene, RiverScene, ShopScene, WarpScene } from "./scenes/Other";

const SCENES: Record<string, React.FC> = {
  shop: ShopScene,
  warp: WarpScene,
  plaza: PlazaScene,
  jeans: JeansScene,
  phone: PhoneScene,
  market: MarketScene,
  food: FoodScene,
  police: PoliceScene,
  catalog: CatalogScene,
  polo: PoloScene,
  night: NightScene,
  friar: FriarScene,
  river: RiverScene,
  ending: EndingScene,
};

const Punch: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const k = prog(f, 0, 8);
  return <AbsoluteFill style={{ transform: `scale(${1.06 - 0.06 * k})` }}>{children}</AbsoluteFill>;
};

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'),
      document.fonts.load('700 80px "Bricolage Grotesque"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
    ]).then(() => continueRender(h));
  }, [h]);
};

export const GenZVideo: React.FC<{ withAudio?: boolean; only?: string }> = ({ withAudio = true, only }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {scenes.map((s) => {
        const S = SCENES[s.id];
        if (!S || (only && only !== s.id)) return null;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur + 1} name={`scene:${s.id}`}>
            <Punch>
              <S />
            </Punch>
          </Sequence>
        );
      })}
      {/* white flash into the past, lime flash at the portal */}
      {scenes
        .filter((s) => s.id === "plaza" || s.id === "warp")
        .map((s) => (
          <Sequence key={`f${s.id}`} from={s.from} durationInFrames={12}>
            <CutFlash color={s.id === "warp" ? "#d7ff3a" : "#ffffff"} len={12} />
          </Sequence>
        ))}
      <Grade />
      <WarpOverlay />
      <Hud />
      <FactChip />
      <Title />
      <NarratorCaptions />
      <Dialogue />
      <Outro />
      {withAudio ? <Audio src={staticFile("genz/mix.mp3")} /> : null}
    </AbsoluteFill>
  );
};
