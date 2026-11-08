import { Composition } from "remotion";
import { Main, mainSchemaDefaults, type MainProps } from "./Main";
import { AntsVideo } from "./ants/AntsVideo";
import { FPS as ANTS_FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./ants/lib";

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
    </>
  );
};
