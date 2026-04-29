import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  TransitionSeries,
  springTiming,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { slide } from "@remotion/transitions/slide";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { Scene1Hero } from "./scenes/Scene1Hero";
import { Scene2Vision } from "./scenes/Scene2Vision";
import { Scene3Build } from "./scenes/Scene3Build";
import { Scene4Modules } from "./scenes/Scene4Modules";
import { Scene5Outro } from "./scenes/Scene5Outro";

loadDisplay();
loadBody();

const StarField: React.FC = () => {
  const frame = useCurrentFrame();
  const stars = React.useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        x: (i * 137.5) % 1920,
        y: (i * 91.7) % 1080,
        r: ((i * 13) % 3) + 1,
        speed: 0.3 + ((i % 5) * 0.1),
        phase: (i * 0.7) % 6.28,
      })),
    []
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {stars.map((s, i) => {
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame * s.speed * 0.05 + s.phase));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.r,
              height: s.r,
              borderRadius: "50%",
              background: "#ffd27a",
              opacity: tw * 0.8,
              boxShadow: `0 0 ${s.r * 4}px rgba(255,210,122,${tw * 0.6})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const IridescentGradient: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const hue = interpolate(t, [0, 1], [220, 320]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 20%, hsla(${hue},60%,18%,1) 0%, hsla(${
          hue + 40
        },50%,8%,1) 50%, #050814 100%)`,
      }}
    />
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#050814", fontFamily: "Inter" }}>
      <IridescentGradient />
      <StarField />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={180}>
          <Scene1Hero />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={170}>
          <Scene2Vision />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 25 })}
        />
        <TransitionSeries.Sequence durationInFrames={200}>
          <Scene3Build />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-bottom-right" })}
          timing={linearTiming({ durationInFrames: 25 })}
        />
        <TransitionSeries.Sequence durationInFrames={210}>
          <Scene4Modules />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />
        <TransitionSeries.Sequence durationInFrames={180}>
          <Scene5Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
