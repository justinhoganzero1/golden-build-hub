import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

export const Scene1Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heroScale = interpolate(frame, [0, 180], [1.05, 1.18]);
  const heroOpacity = interpolate(frame, [0, 25, 160, 180], [0, 1, 1, 0.85], {
    extrapolateRight: "clamp",
  });

  const titleY = spring({ frame: frame - 25, fps, config: { damping: 18 } });
  const titleOpacity = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [55, 85], [0, 1], { extrapolateRight: "clamp" });
  const subY = spring({ frame: frame - 55, fps, config: { damping: 22 } });

  const bylineOpacity = interpolate(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Img
        src={staticFile("images/hero.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${heroScale})`,
          opacity: heroOpacity,
          filter: "saturate(1.1)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(5,8,20,0.2) 0%, rgba(5,8,20,0.55) 60%, rgba(5,8,20,0.92) 100%)",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 140px 120px" }}>
        <div
          style={{
            fontFamily: "Playfair Display",
            fontSize: 132,
            color: "#fff",
            lineHeight: 1.0,
            letterSpacing: -2,
            transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
            opacity: titleOpacity,
            textShadow: "0 4px 40px rgba(0,0,0,0.6)",
            maxWidth: 1300,
          }}
        >
          The Making of
          <br />
          <span style={{ color: "#f5c97a" }}>Oracle Lunar</span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            color: "rgba(255,255,255,0.78)",
            letterSpacing: 4,
            textTransform: "uppercase",
            transform: `translateY(${interpolate(subY, [0, 1], [20, 0])}px)`,
            opacity: subOpacity,
          }}
        >
          From a single spark to a super-app
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 20,
            color: "rgba(245,201,122,0.85)",
            letterSpacing: 2,
            opacity: bylineOpacity,
          }}
        >
          ✦ A behind-the-scenes story
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
