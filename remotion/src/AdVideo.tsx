import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";

loadDisplay();
loadBody();

const GOLD = "#f5c97a";
const DEEP = "#07060b";
const SERIF = "Playfair Display, serif";
const SANS = "Inter, sans-serif";

/* ---------- shared bits ---------- */

const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.82 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

const Backdrop: React.FC<{ src: string; kind: "video" | "image"; zoom?: number }> = ({
  src,
  kind,
  zoom = 1.08,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 150], [1.02, zoom], { extrapolateRight: "clamp" });
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale})`,
    opacity: fade,
    filter: "saturate(1.05) contrast(1.05) brightness(0.72)",
  };
  return (
    <AbsoluteFill>
      {kind === "video" ? (
        <OffthreadVideo src={staticFile(src)} muted style={style} />
      ) : (
        <Img src={staticFile(src)} style={style} />
      )}
      <Vignette />
    </AbsoluteFill>
  );
};

/** Persistent gold call-to-action bar pinned to the base of every frame. */
const UrlBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 9) * 0.012;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 46,
        display: "flex",
        justifyContent: "center",
        transform: `translateY(${interpolate(rise, [0, 1], [70, 0])}px)`,
        opacity: rise,
        zIndex: 50,
      }}
    >
      <div
        style={{
          transform: `scale(${pulse})`,
          padding: "16px 46px",
          borderRadius: 999,
          border: `2px solid ${GOLD}`,
          background: "rgba(7,6,11,0.72)",
          boxShadow: `0 0 60px rgba(245,201,122,0.35)`,
          fontFamily: SANS,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 2,
          color: GOLD,
          textShadow: "0 2px 18px rgba(0,0,0,0.9)",
        }}
      >
        oracle-lunar.online
      </div>
    </div>
  );
};

const Headline: React.FC<{
  kicker?: string;
  title: string;
  sub?: string;
  align?: "left" | "center";
}> = ({ kicker, title, sub, align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const blur = interpolate(s, [0, 1], [14, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "center" ? 0 : 130,
        right: align === "center" ? 0 : 200,
        top: 300,
        textAlign: align,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [46, 0])}px)`,
        filter: `blur(${blur}px)`,
      }}
    >
      {kicker && (
        <div
          style={{
            fontFamily: SANS,
            fontSize: 24,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: GOLD,
            marginBottom: 18,
            fontWeight: 600,
          }}
        >
          {kicker}
        </div>
      )}
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 104,
          fontWeight: 700,
          color: "#fff",
          lineHeight: 1.02,
          textShadow: "0 6px 34px rgba(0,0,0,0.95)",
        }}
      >
        {title}
      </div>
      {sub && (
        <div
          style={{
            marginTop: 20,
            fontFamily: SANS,
            fontSize: 32,
            color: "rgba(255,255,255,0.86)",
            textShadow: "0 2px 16px rgba(0,0,0,0.9)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
};

/** Feature chips that snap in one after another. */
const Chips: React.FC<{ items: string[]; startDelay?: number }> = ({ items, startDelay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: 130,
        right: 130,
        top: 620,
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
      }}
    >
      {items.map((label, i) => {
        const s = spring({
          frame: frame - startDelay - i * 5,
          fps,
          config: { damping: 14, stiffness: 200 },
        });
        return (
          <div
            key={label}
            style={{
              opacity: s,
              transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px) scale(${interpolate(
                s,
                [0, 1],
                [0.86, 1],
              )})`,
              padding: "12px 24px",
              borderRadius: 12,
              border: "1px solid rgba(245,201,122,0.55)",
              background: "rgba(245,201,122,0.10)",
              fontFamily: SANS,
              fontSize: 26,
              fontWeight: 600,
              color: "#fff",
              letterSpacing: 0.5,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
};

/* ---------- scenes ---------- */

const SceneHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ backgroundColor: DEEP }}>
      <Backdrop src="video/v4-clip1-workshop.mp4" kind="video" zoom={1.14} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            opacity: s,
            transform: `scale(${interpolate(s, [0, 1], [0.88, 1])})`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 150,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: 4,
              textShadow: `0 0 90px rgba(245,201,122,0.55), 0 8px 40px rgba(0,0,0,0.95)`,
            }}
          >
            ORACLE LUNAR
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: SANS,
              fontSize: 34,
              letterSpacing: 12,
              textTransform: "uppercase",
              color: GOLD,
              opacity: interpolate(frame, [18, 40], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            Your AI best friend
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const SceneTalk: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: DEEP }}>
    <Backdrop src="video/v4-clip2-leanover.mp4" kind="video" />
    <Headline kicker="Talk. Learn. Grow." title={"Voice Oracle\n& AI Tutor"} />
    <Chips items={["Oracle Voice", "AI Companion", "AI Tutor", "Agents Hub", "Interpreter"]} startDelay={12} />
  </AbsoluteFill>
);

const SceneCare: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: DEEP }}>
    <Backdrop src="video/v4-clip3-twoOracles.mp4" kind="video" />
    <Headline kicker="Always here for you" title={"Mind Hub &\nCrisis Support"} />
    <Chips
      items={["Mind Hub", "Crisis Hub", "Life Diary", "Calendar", "Family Hub", "Elderly Care"]}
      startDelay={10}
    />
  </AbsoluteFill>
);

const SceneCreate: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: DEEP }}>
    <Backdrop src="images/hero.jpg" kind="image" zoom={1.16} />
    <Headline kicker="Create in 8K" title={"Photography Hub\n& Avatars"} />
    <Chips
      items={["8K Avatars", "Live Vision", "Teleport", "Living GIFs", "Brand & Logos", "Voice Studio"]}
      startDelay={10}
    />
  </AbsoluteFill>
);

const SceneStudio: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: DEEP }}>
    <Backdrop src="video/clip3-screen.mp4" kind="video" />
    <Headline kicker="Write it. Film it." title={"Story Writer &\nMovie Studio Pro"} />
    <Chips
      items={["Novels & eBooks", "Audiobooks", "AI Host Shows", "YouTube & Shorts", "Video Editor"]}
      startDelay={10}
    />
  </AbsoluteFill>
);

const SceneBusiness: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: DEEP }}>
    <Backdrop src="video/clip2-developer.mp4" kind="video" />
    <Headline kicker="Build it. Sell it." title={"App Builder\n& Creator Shop"} />
    <Chips
      items={["App Builder", "Marketing Hub", "Voice Receptionist", "Creator Shop", "Wallet & Payouts"]}
      startDelay={10}
    />
  </AbsoluteFill>
);

const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const glow = 0.4 + Math.sin(frame / 8) * 0.15;
  return (
    <AbsoluteFill style={{ backgroundColor: DEEP }}>
      <Backdrop src="video/v4-clip4-laugh.mp4" kind="video" zoom={1.12} />
      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center", paddingBottom: 120 }}
      >
        <div style={{ textAlign: "center", opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)` }}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 30,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: GOLD,
              marginBottom: 22,
            }}
          >
            40+ modules · free to start
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: 132,
              fontWeight: 700,
              color: "#fff",
              textShadow: `0 0 ${60 + glow * 90}px rgba(245,201,122,${glow}), 0 8px 40px rgba(0,0,0,0.95)`,
            }}
          >
            ORACLE LUNAR
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: SANS,
              fontSize: 36,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            One app. Every AI you need.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- timeline ---------- */

const SCENES: { c: React.FC; from: number; dur: number }[] = [
  { c: SceneHero, from: 0, dur: 108 },
  { c: SceneTalk, from: 108, dur: 132 },
  { c: SceneCare, from: 240, dur: 132 },
  { c: SceneCreate, from: 372, dur: 138 },
  { c: SceneStudio, from: 510, dur: 132 },
  { c: SceneBusiness, from: 642, dur: 138 },
  { c: SceneOutro, from: 780, dur: 120 },
];

export const AdVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame % 132, [0, 4, 12], [0.35, 0.12, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: DEEP }}>
      {SCENES.map(({ c: C, from, dur }, i) => (
        <Sequence key={i} from={from} durationInFrames={dur}>
          <C />
        </Sequence>
      ))}
      {/* subtle cut flash keeps the pace punchy */}
      <AbsoluteFill style={{ background: `rgba(245,201,122,${flash * 0.25})`, pointerEvents: "none" }} />
      <UrlBar />
    </AbsoluteFill>
  );
};
