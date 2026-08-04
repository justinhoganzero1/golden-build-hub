import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { AdVideo } from "./AdVideo";

// 35s @ 30fps = 1050 frames
export const RemotionRoot = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={1050}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* 30s Oracle Lunar ad */}
    <Composition
      id="ad30"
      component={AdVideo}
      durationInFrames={900}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
