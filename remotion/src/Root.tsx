import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { AdVideo } from "./AdVideo";
import { Ad60 } from "./Ad60";
import { StoryCut, STORYCUT_FRAMES } from "./StoryCut";
import { HostedPreview, PREVIEW3_FRAMES } from "./HostedPreview";


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
    {/* 60s Oracle Lunar ad built from real in-app screens */}
    <Composition
      id="ad60"
      component={Ad60}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* 3-minute condensed movie cut of a Story Writer story */}
    <Composition
      id="storycut"
      component={StoryCut}
      durationInFrames={STORYCUT_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
    {/* 3-minute hosted preview with Olivia Vance + live interview */}
    <Composition
      id="preview3"
      component={HostedPreview}
      durationInFrames={PREVIEW3_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);

