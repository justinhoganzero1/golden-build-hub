import React from "react";
import { AbsoluteFill, Sequence, Series, useCurrentFrame, interpolate } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { VideoScene } from "./components/VideoScene";

loadDisplay();
loadBody();

// Total timeline: 31s = 930 frames @ 30fps
// Audio (music + narrator + oracle) is muxed post-render via ffmpeg
const SCENES = [
  { src: "video/clip1-office.mp4",    dur: 120, cap: "It's late.",                sub: "Floor 42" },                   // 0-4s
  { src: "video/clip2-developer.mp4", dur: 240, cap: "But one builder is awake.", sub: "Line by line" },               // 4-12s
  { src: "video/clip3-screen.mp4",    dur: 150, cap: "An AI best friend.",        sub: "Always here" },                // 12-17s
  { src: "video/clip4-secretary.mp4", dur: 210, cap: "Then... she walks in.",     sub: undefined },                    // 17-24s
  { src: "video/clip5-call.mp4",      dur: 210, cap: "The Oracle is on the line.", sub: "She wants to talk to him" },  // 24-31s
];

const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = 0.05 + 0.02 * Math.abs(Math.sin(frame * 0.4));
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='1'/></svg>\")",
        opacity,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

const Letterbox: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60, background: "#000", zIndex: 100 }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "#000", zIndex: 100 }} />
  </>
);

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 25, 90, 120], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 140, opacity, zIndex: 50 }}>
      <div
        style={{
          fontFamily: "Inter",
          fontSize: 22,
          color: "#f5c97a",
          letterSpacing: 8,
          textTransform: "uppercase",
          textShadow: "0 2px 8px rgba(0,0,0,0.9)",
        }}
      >
        Oracle Lunar — A True Story
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "Inter" }}>
      <Series>
        {SCENES.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.dur}>
            <VideoScene
              src={s.src}
              caption={s.cap}
              subCaption={s.sub}
              vignette={0.6}
              captionPos={i % 2 === 0 ? "bottom" : "top"}
            />
          </Series.Sequence>
        ))}
      </Series>

      <Sequence from={0} durationInFrames={120}>
        <TitleCard />
      </Sequence>

      <FilmGrain />
      <Letterbox />
    </AbsoluteFill>
  );
};
