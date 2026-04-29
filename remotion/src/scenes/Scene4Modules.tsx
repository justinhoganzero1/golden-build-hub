import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

const modules = [
  "Oracle", "Companion", "Crisis Hub", "Mind Hub",
  "Movie Studio", "Photography", "AI Tutor", "Live Vision",
  "Voice Studio", "Wallet", "Family Hub", "App Builder",
];

export const Scene4Modules: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div
        style={{
          fontFamily: "Inter",
          fontSize: 22,
          color: "#f5c97a",
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }),
          marginBottom: 28,
        }}
      >
        Chapter 03 — The Super-App
      </div>
      <div
        style={{
          fontFamily: "Playfair Display",
          fontSize: 76,
          color: "#fff",
          letterSpacing: -1.5,
          marginBottom: 48,
          opacity: interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        One app. <span style={{ color: "#f5c97a" }}>Forty-plus worlds.</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 28,
          width: "100%",
          maxWidth: 1500,
        }}
      >
        {modules.map((m, i) => {
          const start = 40 + i * 8;
          const sp = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 140 } });
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {
            extrapolateRight: "clamp",
          });
          const hue = (i * 35 + frame * 0.4) % 360;
          return (
            <div
              key={m}
              style={{
                aspectRatio: "1.4",
                borderRadius: 28,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: `linear-gradient(135deg, hsla(${hue},70%,55%,0.18), hsla(${
                  hue + 60
                },70%,40%,0.10))`,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.18), 0 20px 50px -15px rgba(0,0,0,0.6)",
                opacity,
                transform: `translateY(${interpolate(sp, [0, 1], [40, 0])}px) scale(${interpolate(sp, [0, 1], [0.9, 1])})`,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, hsla(${hue},90%,75%,1) 0%, hsla(${
                    hue + 40
                  },80%,40%,1) 60%, hsla(${hue + 80},70%,20%,1) 100%)`,
                  boxShadow: `0 0 30px hsla(${hue},90%,60%,0.5)`,
                }}
              />
              <div
                style={{
                  fontFamily: "Playfair Display",
                  fontSize: 28,
                  color: "#fff",
                  letterSpacing: -0.5,
                }}
              >
                {m}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
