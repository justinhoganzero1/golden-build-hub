import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";

// 31s @ 30fps = 930 frames
export const RemotionRoot = () => (
  <Composition
    id="main"
    component={MainVideo}
    durationInFrames={930}
    fps={30}
    width={1920}
    height={1080}
  />
);
