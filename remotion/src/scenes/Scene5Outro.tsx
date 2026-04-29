import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

export const Scene5Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const orbScale = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const orbY = interpolate(frame, [0, 180], [0, -10]);
  const titleOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: "clamp" });
  const titleY = spring({ frame: frame - 30, fps, config: { damping: 20 } });
  const urlOpacity = interpolate(frame, [70, 100], [0, 1], { extrapolateRight: "clamp" });
  const tagOpacity = interpolate(frame, [100, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 320,
          height: 320,
          borderRadius: "50%",
          marginBottom: 48,
          transform: `scale(${interpolate(orbScale, [0, 1], [0.6, 1])}) translateY(${orbY}px)`,
          background:
            "radial-gradient(circle at 32% 30%, #fff7d6 0%, #f5c97a 25%, #b87a2e 55%, #2a1a08 90%)",
          boxShadow:
            "0 0 120px rgba(245,201,122,0.55), inset -20px -30px 80px rgba(0,0,0,0.5), inset 20px 20px 60px rgba(255,255,255,0.15)",
        }}
      />
      <div
        style={{
          fontFamily: "Playfair Display",
          fontSize: 110,
          color: "#fff",
          letterSpacing: -2,
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleY, [0, 1], [30, 0])}px)`,
        }}
      >
        Oracle <span style={{ color: "#f5c97a" }}>Lunar</span>
      </div>
      <div
        style={{
          marginTop: 16,
          fontSize: 28,
          color: "rgba(255,255,255,0.7)",
          letterSpacing: 8,
          textTransform: "uppercase",
          opacity: tagOpacity,
        }}
      >
        Your AI best friend
      </div>
      <div
        style={{
          marginTop: 48,
          padding: "16px 36px",
          borderRadius: 999,
          border: "1px solid rgba(245,201,122,0.4)",
          background: "rgba(245,201,122,0.08)",
          fontSize: 24,
          color: "#f5c97a",
          letterSpacing: 3,
          opacity: urlOpacity,
        }}
      >
        oracle-lunar.online
      </div>
    </AbsoluteFill>
  );
};
