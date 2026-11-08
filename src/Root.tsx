import { Composition } from "remotion";
import { Main, mainSchemaDefaults, type MainProps } from "./Main";
import { AntsVideo } from "./ants/AntsVideo";
import { FPS as ANTS_FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./ants/lib";
import { Lineup } from "./genz/Lineup";
import { GenZVideo } from "./genz/GenZVideo";
import { TOTAL_FRAMES as GENZ_FRAMES } from "./genz/lib";

export const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={mainSchemaDefaults satisfies MainProps}
      />
      {/* "What if humans shrank to the size of ants overnight?" — 9:16 short */}
      <Composition
        id="WhatIfAnts"
        component={AntsVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={ANTS_FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      {/* "What if a Gen Z time-traveled to the Philippines in 1850?" — 9:16, ~3.4 min */}
      <Composition id="WhatIfGenZ1850" component={GenZVideo} durationInFrames={GENZ_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ withAudio: true }} />
      {/* dev: character lineup for the Gen Z episode */}
      <Composition id="GenZLineup" component={Lineup} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={{ close: false }} />
    </>
  );
};
