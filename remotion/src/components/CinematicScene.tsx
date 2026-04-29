import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface CinematicSceneProps {
  image: string; // staticFile path
  caption?: string;
  subCaption?: string;
  /** Ken Burns: 'in' zooms in, 'out' zooms out, 'left'/'right' pan */
  motion?: "in" | "out" | "left" | "right";
  /** Vignette darkness 0-1 */
  vignette?: number;
  /** Caption position */
  captionPos?: "bottom" | "top" | "center";
}

export const CinematicScene: React.FC<CinematicSceneProps> = ({
  image,
  caption,
  subCaption,
  motion = "in",
  vignette = 0.55,
  captionPos = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1 within scene

  // Ken Burns transform
  let scale = 1;
  let tx = 0;
  let ty = 0;
  if (motion === "in") scale = interpolate(t, [0, 1], [1.05, 1.18]);
  else if (motion === "out") scale = interpolate(t, [0, 1], [1.2, 1.04]);
  else if (motion === "left") {
    scale = 1.15;
    tx = interpolate(t, [0, 1], [40, -40]);
  } else if (motion === "right") {
    scale = 1.15;
    tx = interpolate(t, [0, 1], [-40, 40]);
  }

  // Fade in / out at scene edges
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  // Caption animation
  const captionSpring = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 110 } });
  const captionY = interpolate(captionSpring, [0, 1], [40, 0]);
  const captionOpacity = interpolate(frame, [14, 30, durationInFrames - 18, durationInFrames - 4], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const captionStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    padding: "0 120px",
    textAlign: "left",
    opacity: captionOpacity,
    transform: `translateY(${captionY}px)`,
    zIndex: 10,
  };
  if (captionPos === "bottom") captionStyle.bottom = 110;
  if (captionPos === "top") captionStyle.top = 90;
  if (captionPos === "center") {
    captionStyle.top = "50%";
    captionStyle.transform = `translateY(calc(-50% + ${captionY}px))`;
    captionStyle.textAlign = "center";
  }

  return (
    <AbsoluteFill style={{ background: "#000", opacity }}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${tx}px, ${ty}px)`,
          transformOrigin: "center center",
        }}
      >
        <Img
          src={staticFile(image)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(0,0,0,${vignette}) 100%)`,
          pointerEvents: "none",
        }}
      />

      {/* Bottom gradient for caption legibility */}
      {caption && captionPos !== "top" && (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 25%, rgba(0,0,0,0) 50%)",
            pointerEvents: "none",
          }}
        />
      )}
      {caption && captionPos === "top" && (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0) 50%)",
            pointerEvents: "none",
          }}
        />
      )}

      {caption && (
        <div style={captionStyle}>
          <div
            style={{
              fontFamily: "Playfair Display, serif",
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: -0.5,
              lineHeight: 1.1,
              textShadow: "0 4px 24px rgba(0,0,0,0.8)",
              marginBottom: subCaption ? 16 : 0,
            }}
          >
            {caption}
          </div>
          {subCaption && (
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 28,
                color: "#f5c97a",
                letterSpacing: 3,
                textTransform: "uppercase",
                fontWeight: 500,
                textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              }}
            >
              {subCaption}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
