import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

const lines = [
  "An AI best friend.",
  "Always here. Never selling you out.",
  "Built for the moments that matter.",
];

export const Scene2Vision: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ justifyContent: "center", padding: "0 180px" }}>
      <div style={{ maxWidth: 1400 }}>
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 22,
            color: "#f5c97a",
            letterSpacing: 6,
            textTransform: "uppercase",
            opacity: interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" }),
            marginBottom: 40,
          }}
        >
          Chapter 01 — The Vision
        </div>
        {lines.map((line, i) => {
          const start = 20 + i * 35;
          const sp = spring({ frame: frame - start, fps, config: { damping: 20 } });
          const opacity = interpolate(frame, [start, start + 20], [0, 1], {
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                fontFamily: "Playfair Display",
                fontSize: i === 0 ? 96 : 64,
                color: i === 0 ? "#ffffff" : "rgba(255,255,255,0.78)",
                lineHeight: 1.15,
                letterSpacing: -1,
                opacity,
                transform: `translateX(${interpolate(sp, [0, 1], [-60, 0])}px)`,
                marginBottom: 20,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
