import { AbsoluteFill, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { Scene3D } from "./Scene3D";
import { Captions } from "./Captions";

export type MainProps = {
  /** File in /public, e.g. "music.mp3". Set to null for no audio. */
  audioFile: string | null;
  /** JSON file in /public with an array of @remotion/captions `Caption` objects. */
  captionsFile: string;
};

export const mainSchemaDefaults: MainProps = {
  audioFile: null,
  captionsFile: "captions.json",
};

export const Main: React.FC<MainProps> = ({ audioFile, captionsFile }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0d17" }}>
      <Scene3D />
      <Captions file={captionsFile} />
      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
