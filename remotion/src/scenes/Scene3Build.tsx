import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

const stats = [
  { num: "40+", label: "Modules built" },
  { num: "300", label: "Edge functions" },
  { num: "120", label: "Voices integrated" },
  { num: "8K", label: "AI photo & video" },
];

export const Scene3Build: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const headerY = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 140px" }}>
      <div
        style={{
          fontFamily: "Inter",
          fontSize: 22,
          color: "#f5c97a",
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: headerOpacity,
          transform: `translateY(${interpolate(headerY, [0, 1], [20, 0])}px)`,
          marginBottom: 30,
        }}
      >
        Chapter 02 — The Build
      </div>
      <div
        style={{
          fontFamily: "Playfair Display",
          fontSize: 88,
          color: "#fff",
          lineHeight: 1.05,
          letterSpacing: -1.5,
          opacity: interpolate(frame, [15, 45], [0, 1], { extrapolateRight: "clamp" }),
          maxWidth: 1500,
          marginBottom: 70,
        }}
      >
        Thousands of iterations.
        <br />
        <span style={{ color: "#f5c97a" }}>One relentless promise.</span>
      </div>
      <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
        {stats.map((s, i) => {
          const start = 60 + i * 22;
          const sp = spring({ frame: frame - start, fps, config: { damping: 14, stiffness: 120 } });
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                flex: "1 1 320px",
                padding: "32px 36px",
                borderRadius: 28,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(245,201,122,0.04))",
                border: "1px solid rgba(245,201,122,0.25)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), 0 30px 60px -20px rgba(0,0,0,0.6)",
                opacity,
                transform: `translateY(${interpolate(sp, [0, 1], [50, 0])}px) scale(${interpolate(sp, [0, 1], [0.92, 1])})`,
                backdropFilter: "none",
              }}
            >
              <div
                style={{
                  fontFamily: "Playfair Display",
                  fontSize: 88,
                  color: "#f5c97a",
                  lineHeight: 1,
                  letterSpacing: -2,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 18,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
