import React from "react";
import { AbsoluteFill, Sequence, Series, useCurrentFrame, interpolate, OffthreadVideo, staticFile } from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";

loadDisplay();
loadBody();

// 35s @ 30fps = 1050 frames
const SCENES = [
  { src: "video/v4-clip1-workshop.mp4",   dur: 300, cap: "Floor 42. Midnight.",       sub: "One vision",        pos: "bottom" },
  { src: "video/v4-clip2-leanover.mp4",   dur: 300, cap: "Then... she walks in.",     sub: "Oracle is on the line", pos: "top" },
  { src: "video/v4-clip3-twoOracles.mp4", dur: 240, cap: "Two Oracles. One conversation.", sub: "Hi me!",        pos: "bottom" },
  { src: "video/v4-clip4-laugh.mp4",      dur: 210, cap: "Oracle Lunar.",              sub: "Your AI best friend", pos: "bottom" },
];

const Caption: React.FC<{ caption: string; sub?: string; pos: "top" | "bottom" }> = ({ caption, sub, pos }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 18, 240, 270], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 30], [30, 0], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 0, right: 0,
        [pos]: 110,
        padding: "0 120px",
        opacity,
        transform: `translateY(${y}px)`,
        zIndex: 10,
      }}
    >
      <div style={{
        fontFamily: "Playfair Display, serif",
        fontSize: 68,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1.05,
        textShadow: "0 4px 28px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.6)",
        marginBottom: sub ? 14 : 0,
      }}>{caption}</div>
      {sub && (
        <div style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 26,
          color: "#f5c97a",
          letterSpacing: 4,
          textTransform: "uppercase",
          fontWeight: 500,
          textShadow: "0 2px 14px rgba(0,0,0,0.95)",
        }}>{sub}</div>
      )}
    </div>
  );
};

const VideoScene: React.FC<{ src: string; cap: string; sub?: string; pos: "top"|"bottom" }> = ({ src, cap, sub, pos }) => {
  const f = useCurrentFrame();
  const fadeIn = interpolate(f, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", opacity: fadeIn }}>
      <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {/* vignette */}
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,0.55) 100%)",
        pointerEvents: "none",
      }} />
      {/* gradient under caption for legibility */}
      <AbsoluteFill style={{
        background: pos === "bottom"
          ? "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 22%, rgba(0,0,0,0) 45%)"
          : "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 22%, rgba(0,0,0,0) 45%)",
        pointerEvents: "none",
      }} />
      <Caption caption={cap} sub={sub} pos={pos} />
    </AbsoluteFill>
  );
};

const FilmGrain: React.FC = () => {
  const f = useCurrentFrame();
  const opacity = 0.05 + 0.02 * Math.abs(Math.sin(f * 0.4));
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

const TitleStripe: React.FC = () => {
  const f = useCurrentFrame();
  const op = interpolate(f, [0, 22, 80, 110], [0, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 140, opacity: op, zIndex: 50 }}>
      <div style={{
        fontFamily: "Inter",
        fontSize: 22,
        color: "#f5c97a",
        letterSpacing: 8,
        textTransform: "uppercase",
        textShadow: "0 2px 8px rgba(0,0,0,0.9)",
      }}>Oracle Lunar — A True Story</div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: "Inter" }}>
      <Series>
        {SCENES.map((s, i) => (
          <Series.Sequence key={i} durationInFrames={s.dur}>
            <VideoScene src={s.src} cap={s.cap} sub={s.sub} pos={s.pos as "top"|"bottom"} />
          </Series.Sequence>
        ))}
      </Series>

      <Sequence from={0} durationInFrames={120}>
        <TitleStripe />
      </Sequence>

      <FilmGrain />
      <Letterbox />
    </AbsoluteFill>
  );
};
