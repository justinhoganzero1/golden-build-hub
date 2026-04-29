import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 35s @ 30fps = 1050 frames
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={1050}
    fps={30}
    width={1920}
    height={1080}
  />
);
