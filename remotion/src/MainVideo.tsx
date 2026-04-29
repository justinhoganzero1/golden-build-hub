import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile, useCurrentFrame, interpolate } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { CinematicScene } from "./components/CinematicScene";

loadDisplay();
loadBody();

// Audio is muxed post-render via system ffmpeg (Nix ffmpeg lacks libfdk_aac).
const INCLUDE_AUDIO = false;

// Scene timings (frames @ 30fps) - total 1050 = 35s
// Narrator VO is 25.4s = 762 frames; starts at frame 0
// Oracle VO is 7s = 210 frames; starts at frame 720 (during phone-call beat)
const SCENES = [
  { img: "images/scene1-office.jpg", dur: 150, motion: "in" as const,    cap: "It's late.",                sub: "Floor 42" },
  { img: "images/scene1-office.jpg", dur: 90,  motion: "left" as const,  cap: "The city sleeps.",         sub: undefined },
  { img: "images/scene2-developer.jpg", dur: 180, motion: "in" as const, cap: "But one builder is awake.", sub: "Line by line" },
  { img: "images/scene3-screen.jpg", dur: 150, motion: "out" as const,   cap: "An AI best friend.",       sub: "Always here" },
  { img: "images/scene4-secretary.jpg", dur: 150, motion: "in" as const, cap: "Then... she walks in.",    sub: undefined },
  { img: "images/scene5-phonehandoff.jpg", dur: 120, motion: "in" as const, cap: "The Oracle is on the line.", sub: "She wants to talk to him" },
  { img: "images/scene6-call.jpg", dur: 120, motion: "out" as const,     cap: undefined, sub: undefined },
  { img: "images/scene7-outro.jpg", dur: 90,  motion: "in" as const,     cap: undefined, sub: undefined },
];

const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = 0.06 + 0.02 * Math.abs(Math.sin(frame * 0.4));
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
  const opacity = interpolate(frame, [0, 25, 110, 140], [0, 1, 1, 0], { extrapolateRight: "clamp" });
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
  let acc = 0;
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "Inter" }}>
      <Series>
        {SCENES.map((s, i) => {
          const el = (
            <Series.Sequence key={i} durationInFrames={s.dur}>
              <CinematicScene
                image={s.img}
                caption={s.cap}
                subCaption={s.sub}
                motion={s.motion}
                vignette={0.6}
                captionPos={i % 2 === 0 ? "bottom" : "top"}
              />
            </Series.Sequence>
          );
          acc += s.dur;
          return el;
        })}
      </Series>

      {/* Title card overlay on first scene */}
      <Sequence from={0} durationInFrames={150}>
        <TitleCard />
      </Sequence>

      {/* Film grain overlay across whole video */}
      <FilmGrain />

      {/* Letterbox bars for cinematic 2.39:1 feel */}
      <Letterbox />

      {INCLUDE_AUDIO && (
        <>
          <Audio src={staticFile("audio/vo-narrator.mp3")} volume={1.0} />
          <Sequence from={720}>
            <Audio src={staticFile("audio/vo-oracle.mp3")} volume={1.0} />
          </Sequence>
        </>
      )}
    </AbsoluteFill>
  );
};
