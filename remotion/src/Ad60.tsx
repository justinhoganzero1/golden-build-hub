import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/PlayfairDisplay";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";

loadDisplay();
loadBody();

const GOLD = "#f5c97a";
const GOLD_HOT = "#ffdf9e";
const SERIF = "Playfair Display, serif";
const SANS = "Inter, sans-serif";

const S = (n: number) => Math.round(n * 30); // seconds -> frames

/* ------------------------------------------------------------------ */
/* Shared furniture                                                     */
/* ------------------------------------------------------------------ */

const Grain: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at 50% 40%, rgba(245,201,122,0.07) 0%, rgba(0,0,0,0) 60%)",
      mixBlendMode: "screen",
    }}
  />
);

/** Full-bleed, heavily blurred + darkened version of the same screenshot. */
const ScreenBackdrop: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 200], [1.15, 1.3], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#05040a" }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          filter: "blur(34px) brightness(0.42) saturate(1.35)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.15) 20%, rgba(3,2,6,0.93) 100%)",
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};

/** Persistent gold call-to-action pill pinned to the base of every frame. */
const UrlBar: React.FC<{ globalFrame: number }> = ({ globalFrame }) => {
  const pulse = 1 + Math.sin(globalFrame / 7) * 0.018;
  const glow = 0.3 + (Math.sin(globalFrame / 7) + 1) * 0.18;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 44,
        display: "flex",
        justifyContent: "center",
        zIndex: 80,
      }}
    >
      <div
        style={{
          transform: `scale(${pulse})`,
          padding: "15px 48px",
          borderRadius: 999,
          border: `2px solid ${GOLD}`,
          background: "rgba(5,4,10,0.8)",
          boxShadow: `0 0 ${40 + glow * 90}px rgba(245,201,122,${glow})`,
          fontFamily: SANS,
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: 2,
          color: GOLD_HOT,
        }}
      >
        oracle-lunar.online
      </div>
    </div>
  );
};

/** Persistent proof-of-product badge: this ad was made inside the app. */
const MadeWithBadge: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 46,
      right: 60,
      zIndex: 70,
      padding: "10px 22px",
      borderRadius: 999,
      border: `1px solid rgba(245,201,122,0.5)`,
      background: "rgba(5,4,10,0.72)",
      fontFamily: SANS,
      fontSize: 19,
      fontWeight: 700,
      letterSpacing: 2,
      color: "rgba(245,201,122,0.92)",
    }}
  >
    THIS AD WAS MADE IN ORACLE LUNAR
  </div>
);

/** Small persistent brand lockup, top-left. */
const BrandMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 46,
      left: 60,
      zIndex: 70,
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        background: `radial-gradient(circle at 32% 30%, ${GOLD_HOT}, #8a5f16)`,
        boxShadow: `0 0 22px ${GOLD}`,
      }}
    />
    <div
      style={{
        fontFamily: SANS,
        fontSize: 20,
        letterSpacing: 6,
        fontWeight: 700,
        color: "rgba(245,201,122,0.85)",
      }}
    >
      ORACLE LUNAR
    </div>
  </div>
);

/** Browser chrome card holding a crisp, real app screenshot. */
const DeviceCard: React.FC<{
  src: string;
  side: "left" | "right";
  route: string;
}> = ({ src, side, route }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 22, stiffness: 150, mass: 0.9 } });
  const drift = interpolate(frame, [0, 220], [0, -26], { extrapolateRight: "clamp" });
  const push = interpolate(frame, [0, 220], [1, 1.05], { extrapolateRight: "clamp" });
  const enterX = side === "left" ? -140 : 140;
  const tilt = side === "left" ? 5 : -5;

  return (
    <div
      style={{
        position: "absolute",
        top: 168,
        [side]: 86,
        width: 1010,
        opacity: s,
        transform: `perspective(1800px) translateX(${interpolate(
          s,
          [0, 1],
          [enterX, 0],
        )}px) translateY(${drift}px) rotateY(${interpolate(s, [0, 1], [tilt * 3, tilt])}deg) scale(${
          push * interpolate(s, [0, 1], [0.94, 1])
        })`,
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(245,201,122,0.42)",
        boxShadow:
          "0 50px 120px rgba(0,0,0,0.85), 0 0 70px rgba(245,201,122,0.22)",
        background: "#0b0910",
      } as React.CSSProperties}
    >
      {/* browser bar */}
      <div
        style={{
          height: 46,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 18px",
          background: "linear-gradient(180deg,#16121f,#0c0a13)",
          borderBottom: "1px solid rgba(245,201,122,0.2)",
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 16,
            flex: 1,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(245,201,122,0.18)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            fontFamily: SANS,
            fontSize: 15,
            color: "rgba(245,201,122,0.8)",
            letterSpacing: 0.6,
          }}
        >
          oracle-lunar.online{route}
        </div>
      </div>
      <Img
        src={staticFile(src)}
        style={{ width: "100%", display: "block", objectFit: "cover" }}
      />
    </div>
  );
};

const SceneTitle: React.FC<{
  kicker: string;
  title: string;
  sub?: string;
  side: "left" | "right";
}> = ({ kicker, title, sub, side }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - 4, fps, config: { damping: 20, stiffness: 170 } });
  const words = title.split(" ");
  return (
    <div
      style={{
        position: "absolute",
        top: 320,
        [side]: 96,
        width: 700,
        textAlign: side === "left" ? "left" : "right",
      } as React.CSSProperties}
    >
      <div
        style={{
          fontFamily: SANS,
          fontSize: 24,
          letterSpacing: 7,
          fontWeight: 800,
          color: GOLD,
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px)`,
          marginBottom: 18,
        }}
      >
        {kicker}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 92, lineHeight: 1.02, color: "#fff" }}>
        {words.map((w, i) => {
          const ws = spring({
            frame: frame - 5 - i * 3,
            fps,
            config: { damping: 18, stiffness: 190 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: 18,
                opacity: ws,
                transform: `translateY(${interpolate(ws, [0, 1], [50, 0])}px)`,
                filter: `blur(${interpolate(ws, [0, 1], [12, 0])}px)`,
                textShadow: "0 6px 40px rgba(0,0,0,0.9)",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {sub ? (
        <div
          style={{
            marginTop: 24,
            fontFamily: SANS,
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.82)",
            opacity: spring({ frame: frame - 14, fps, config: { damping: 200 } }),
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/** One feature beat: real screenshot + headline. */
const FeatureScene: React.FC<{
  src: string;
  route: string;
  kicker: string;
  title: string;
  sub?: string;
  side?: "left" | "right";
}> = ({ src, route, kicker, title, sub, side = "right" }) => {
  const textSide = side === "right" ? "left" : "right";
  return (
    <AbsoluteFill>
      <ScreenBackdrop src={src} />
      <DeviceCard src={src} side={side} route={route} />
      <SceneTitle kicker={kicker} title={title} sub={sub} side={textSide} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Special scenes                                                       */
/* ------------------------------------------------------------------ */

const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 24, stiffness: 120 } });
  const zoom = interpolate(frame, [0, 180], [1.16, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const flash = interpolate(frame, [0, 8, 22], [1, 0.55, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#05040a" }}>
      <Img
        src={staticFile("screens/dashboard.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom})`,
          filter: "blur(9px) brightness(0.42) saturate(1.4)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 25%, rgba(3,2,6,0.92) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 26,
            letterSpacing: 12,
            fontWeight: 800,
            color: GOLD,
            opacity: s,
            marginBottom: 22,
          }}
        >
          40+ AI STUDIOS · ONE APP
        </div>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 168,
            letterSpacing: 6,
            color: "#fff",
            textShadow: `0 0 90px rgba(245,201,122,0.55), 0 10px 50px rgba(0,0,0,0.9)`,
            opacity: s,
            transform: `scale(${interpolate(s, [0, 1], [1.1, 1])})`,
          }}
        >
          ORACLE LUNAR
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 500,
            letterSpacing: 3,
            color: "rgba(255,255,255,0.9)",
            opacity: spring({ frame: frame - 18, fps, config: { damping: 200 } }),
          }}
        >
          Your AI best friend.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

const GridScene: React.FC<{ items: { src: string; label: string }[] }> = ({ items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <ScreenBackdrop src={items[0].src} />
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SERIF,
          fontSize: 86,
          color: "#fff",
          opacity: spring({ frame, fps, config: { damping: 200 } }),
          textShadow: "0 6px 40px rgba(0,0,0,0.9)",
        }}
      >
        And <span style={{ color: GOLD }}>every hub</span> you need
      </div>
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 70,
          right: 70,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 26,
        }}
      >
        {items.map((it, i) => {
          const s = spring({
            frame: frame - i * 6,
            fps,
            config: { damping: 17, stiffness: 200 },
          });
          return (
            <div
              key={it.src}
              style={{
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [70, 0])}px) scale(${interpolate(
                  s,
                  [0, 1],
                  [0.9, 1],
                )})`,
                borderRadius: 14,
                overflow: "hidden",
                border: "1px solid rgba(245,201,122,0.4)",
                boxShadow: "0 26px 70px rgba(0,0,0,0.8)",
                background: "#0b0910",
              }}
            >
              <Img
                src={staticFile(it.src)}
                style={{ width: "100%", height: 232, objectFit: "cover", display: "block" }}
              />
              <div
                style={{
                  padding: "12px 16px",
                  fontFamily: SANS,
                  fontSize: 25,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: GOLD,
                  background: "rgba(5,4,10,0.92)",
                }}
              >
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const FinaleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 26, stiffness: 110 } });
  const zoom = interpolate(frame, [0, 140], [1.0, 1.12], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#05040a" }}>
      <Img
        src={staticFile("screens/dashboard.jpg")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom})`,
          filter: "blur(11px) brightness(0.36) saturate(1.45)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.2) 20%, rgba(3,2,6,0.95) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: SANS,
            fontSize: 34,
            letterSpacing: 10,
            fontWeight: 800,
            color: GOLD,
            opacity: s,
          }}
        >
          40+ STUDIOS · ONE APP · ONE FRIEND
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: SERIF,
            fontSize: 150,
            color: "#fff",
            opacity: s,
            transform: `scale(${interpolate(s, [0, 1], [0.9, 1])})`,
            textShadow: "0 0 90px rgba(245,201,122,0.5)",
          }}
        >
          ORACLE LUNAR
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: SANS,
            fontSize: 44,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            opacity: spring({ frame: frame - 22, fps, config: { damping: 200 } }),
          }}
        >
          Start free. Go get it.
        </div>
        <div
          style={{
            marginTop: 28,
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 2,
            color: GOLD,
            textAlign: "center",
            opacity: spring({ frame: frame - 40, fps, config: { damping: 200 } }),
          }}
        >
          Every second of this ad was made inside Oracle Lunar's Movie Maker.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Timeline                                                             */
/* ------------------------------------------------------------------ */

type Beat = { from: number; to: number; el: React.ReactNode };

const BEATS: Beat[] = [
  { from: 0, to: 6.0, el: <HeroScene /> },
  {
    from: 6.0,
    to: 12.8,
    el: (
      <FeatureScene
        src="screens/oracle.jpg"
        route="/oracle"
        kicker="TALK TO ORACLE"
        title="She never sleeps."
        sub="Chat, voice and vision — your AI best friend, always here."
        side="right"
      />
    ),
  },
  {
    from: 12.8,
    to: 16.8,
    el: (
      <FeatureScene
        src="screens/photography-hub.jpg"
        route="/photography-hub"
        kicker="PHOTOGRAPHY HUB"
        title="4K from one selfie."
        side="left"
      />
    ),
  },
  {
    from: 16.8,
    to: 19.9,
    el: (
      <FeatureScene
        src="screens/teleport.jpg"
        route="/teleport"
        kicker="TELEPORT"
        title="Anywhere on Earth."
        side="right"
      />
    ),
  },
  {
    from: 19.9,
    to: 22.6,
    el: (
      <FeatureScene
        src="screens/avatar-generator.jpg"
        route="/avatar-generator"
        kicker="AVATAR GENERATOR"
        title="Build your face."
        side="left"
      />
    ),
  },
  {
    from: 22.6,
    to: 25.3,
    el: (
      <FeatureScene
        src="screens/live-vision.jpg"
        route="/live-vision"
        kicker="LIVE VISION"
        title="She sees it too."
        side="right"
      />
    ),
  },
  {
    from: 25.3,
    to: 29.9,
    el: (
      <FeatureScene
        src="screens/voice-studio.jpg"
        route="/voice-studio"
        kicker="VOICE STUDIO"
        title="100+ voices. Clone yours."
        side="left"
      />
    ),
  },
  {
    from: 29.9,
    to: 33.0,
    el: (
      <FeatureScene
        src="screens/story-writer.jpg"
        route="/story-writer"
        kicker="STORY WRITER"
        title="Whole novels. Illustrated."
        side="right"
      />
    ),
  },
  {
    from: 33.0,
    to: 36.0,
    el: (
      <FeatureScene
        src="screens/ebook.jpg"
        route="/ebook-cover-studio"
        kicker="COVER STUDIO"
        title="Kindle & Audible ready."
        side="left"
      />
    ),
  },
  {
    from: 36.0,
    to: 43.0,
    el: (
      <FeatureScene
        src="screens/movie-studio.jpg"
        route="/movie-studio-pro"
        kicker="MOVIE STUDIO PRO"
        title="One tap. Full movie."
        sub="Your story auto-builds the entire storyboard — even a YouTube show with its own AI host."
        side="right"
      />
    ),
  },
  {
    from: 43.0,
    to: 45.4,
    el: (
      <FeatureScene
        src="screens/app-builder.jpg"
        route="/app-builder"
        kicker="APP BUILDER"
        title="Ship real apps."
        side="left"
      />
    ),
  },
  {
    from: 45.4,
    to: 49.2,
    el: (
      <GridScene
        items={[
          { src: "screens/mind-hub.jpg", label: "Mind Hub" },
          { src: "screens/ai-tutor.jpg", label: "AI Tutor" },
          { src: "screens/family-hub.jpg", label: "Family Hub" },
          { src: "screens/marketing-hub.jpg", label: "Marketing Hub" },
          { src: "screens/agents.jpg", label: "Agents Hub" },
          { src: "screens/creator-studio.jpg", label: "Creator Studio" },
        ]}
      />
    ),
  },
  {
    from: 49.2,
    to: 52.2,
    el: (
      <FeatureScene
        src="screens/media-library.jpg"
        route="/media-library"
        kicker="YOUR PRIVATE VAULT"
        title="Everything auto-saves."
        side="right"
      />
    ),
  },
  {
    from: 52.2,
    to: 55.7,
    el: (
      <FeatureScene
        src="screens/wallet.jpg"
        route="/wallet"
        kicker="COIN WALLET"
        title="Top up. Pay per use."
        side="left"
      />
    ),
  },
  { from: 55.7, to: 60.0, el: <FinaleScene /> },
];

/** Hard cut flash on every scene change — keeps the edit punchy. */
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const nearest = BEATS.map((b) => S(b.from)).reduce(
    (best, f) => (frame >= f && frame - f < frame - best ? f : best),
    -999,
  );
  const d = frame - nearest;
  if (d < 0 || d > 6) return null;
  const o = interpolate(d, [0, 6], [0.32, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: GOLD_HOT, opacity: o, mixBlendMode: "screen" }} />;
};

export const Ad60: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#05040a" }}>
      {BEATS.map((b) => (
        <Sequence key={b.from} from={S(b.from)} durationInFrames={S(b.to - b.from)}>
          {b.el}
        </Sequence>
      ))}
      <CutFlash />
      <BrandMark />
      <MadeWithBadge />
      <UrlBar globalFrame={frame} />
    </AbsoluteFill>
  );
};

export default Ad60;
