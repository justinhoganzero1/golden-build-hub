import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import DATA from "./preview3-data.json";

const FPS = 30;
const GOLD = "#E8B44A";

type Seg = {
  i: number;
  speaker: "o" | "j";
  mode: "studio" | "corner" | "interview";
  img: number | null;
  plate: boolean;
  text: string;
  start: number;
  dur: number;
  env: number[];
};

const SEGS = DATA.segments as Seg[];
export const PREVIEW3_FRAMES = Math.round(DATA.total * FPS);

const OLIVIA = "preview3/olivia.jpg";
const JUZZY = "preview3/juzzy.jpg";

const envAt = (env: number[], f: number) => {
  const a = env[Math.max(0, Math.min(env.length - 1, f))] ?? 0;
  const b = env[Math.max(0, Math.min(env.length - 1, f + 1))] ?? 0;
  return a * 0.7 + b * 0.3;
};

/* ------------------------------------------------------------------ */
/* Talking head — procedural lip-sync driven by the exact VO envelope  */
/* ------------------------------------------------------------------ */
const TalkingHead: React.FC<{
  src: string;
  level: number;
  time: number;
  mouthY: number;
  flip?: boolean;
  speaking?: boolean;
  radius?: number;
}> = ({ src, level, time, mouthY, flip, speaking, radius = 26 }) => {
  const breathe = Math.sin(time * 1.7) * 0.005;
  const sway = Math.sin(time * 0.85) * 0.5;
  const jaw = 1 + level * 0.028 + breathe;
  return (
    <AbsoluteFill
      style={{
        borderRadius: radius,
        overflow: "hidden",
        background: "#05070c",
        boxShadow: speaking
          ? `0 0 0 3px ${GOLD}, 0 26px 60px rgba(0,0,0,0.65)`
          : "0 0 0 2px rgba(255,255,255,0.18), 0 26px 60px rgba(0,0,0,0.6)",
      }}
    >
      <AbsoluteFill
        style={{
          transform: `translateX(${sway}%) scaleY(${jaw}) ${flip ? "scaleX(-1)" : ""}`,
          transformOrigin: "center top",
        }}
      >
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>

      {/* mouth opening */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${mouthY * 100}%`,
          width: `${5 * (0.8 + level * 0.4)}%`,
          height: `${2.2 * Math.max(0.05, level)}%`,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "rgba(30,9,14,0.86)",
          opacity: level > 0.12 ? Math.min(0.6, 0.18 + level * 0.5) : 0,
          filter: "blur(2.5px)",
        }}
      />
      {/* teeth on wide vowels */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${mouthY * 100 - 0.7}%`,
          width: `${3.4 * (0.8 + level * 0.4)}%`,
          height: "0.75%",
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "rgba(255,250,240,0.7)",
          opacity: level > 0.62 ? (level - 0.62) * 1.1 : 0,
          filter: "blur(1px)",
        }}
      />
    </AbsoluteFill>
  );
};

const Plate: React.FC<{ name: string; title: string; w: number }> = ({ name, title, w }) => (
  <div
    style={{
      width: w,
      background: "rgba(4,6,12,0.86)",
      borderLeft: `6px solid ${GOLD}`,
      borderRadius: 10,
      padding: "12px 20px",
      backdropFilter: undefined,
    }}
  >
    <div style={{ color: "#fff", fontSize: 30, fontWeight: 800, letterSpacing: 0.4 }}>{name}</div>
    <div style={{ color: GOLD, fontSize: 20, fontWeight: 600, letterSpacing: 2 }}>{title}</div>
  </div>
);

const Grade: React.FC = () => (
  <>
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.75) 100%)" }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(to top, rgba(3,4,9,0.95) 0%, rgba(3,4,9,0.4) 24%, rgba(0,0,0,0) 55%)",
      }}
    />
  </>
);

/* ------------------------------- scenes ------------------------------- */

const StudioSeg: React.FC<{ seg: Seg; len: number; pre: number }> = ({ seg, len, pre }) => {
  const frame = useCurrentFrame();
  const level = envAt(seg.env, frame - pre);
  const t = frame / FPS;
  const fade = Math.min(
    interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [len - 10, len], [1, 0], { extrapolateLeft: "clamp" }),
  );
  const zoom = interpolate(frame, [0, len], [1.02, 1.07]);

  return (
    <AbsoluteFill style={{ background: "#04060c", opacity: fade }}>
      {/* newsroom backdrop */}
      <AbsoluteFill style={{ transform: `scale(${zoom * 1.25})`, filter: "blur(22px) saturate(1.1)", opacity: 0.55 }}>
        <Img src={staticFile(OLIVIA)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(120deg, rgba(6,10,26,0.9), rgba(2,3,8,0.75))" }} />

      {/* host */}
      <div style={{ position: "absolute", left: 118, top: 96, width: 700, height: 830, transform: `scale(${zoom})` }}>
        <TalkingHead src={OLIVIA} level={level} time={t} mouthY={0.385} speaking radius={30} />
      </div>

      {seg.plate && (
        <div style={{ position: "absolute", left: 118, top: 918 }}>
          <Plate name="OLIVIA VANCE" title="ORACLE LUNAR SCREENING ROOM" w={700} />
        </div>
      )}

      {/* right-hand title block */}
      <div style={{ position: "absolute", right: 110, top: 250, width: 830, textAlign: "right" }}>
        <div style={{ color: GOLD, fontSize: 26, letterSpacing: 8, fontWeight: 700 }}>PREVIEW · 3 MINUTES</div>
        <div style={{ color: "#fff", fontSize: 96, lineHeight: 1.02, fontWeight: 900, marginTop: 14 }}>
          SCAM THE
          <br />
          SCAMMER
        </div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 40, fontWeight: 700, marginTop: 8 }}>
          — OZZY STYLE —
        </div>
        <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 24, marginTop: 26, letterSpacing: 3 }}>
          MADE ENTIRELY IN ORACLE LUNAR
        </div>
      </div>

      {seg.i === 1 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "18px 0",
            background: "rgba(140,20,20,0.92)",
            color: "#fff",
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 4,
            textAlign: "center",
          }}
        >
          FICTION · FOR ENTERTAINMENT PURPOSES ONLY · AI-GENERATED · NO REAL PEOPLE OR EVENTS
        </div>
      )}
    </AbsoluteFill>
  );
};

const CornerSeg: React.FC<{ seg: Seg; len: number; pre: number }> = ({ seg, len, pre }) => {
  const frame = useCurrentFrame();
  const level = envAt(seg.env, frame - pre);
  const t = frame / FPS;
  const p = frame / len;
  const zoom = interpolate(p, [0, 1], [1.06, 1.18]);
  const tx = interpolate(p, [0, 1], [seg.i % 2 ? 2.5 : -2.5, seg.i % 2 ? -2.5 : 2.5]);
  const fade = Math.min(
    interpolate(frame, [0, 9], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [len - 9, len], [1, 0], { extrapolateLeft: "clamp" }),
  );
  const cardIn = interpolate(frame, [0, 14], [60, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#05060a", opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translateX(${tx}%)` }}>
        <Img
          src={staticFile(`storycut/${String(seg.img ?? 0).padStart(2, "0")}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <Grade />

      {/* host card, bottom right */}
      <div
        style={{
          position: "absolute",
          right: 78,
          bottom: 150,
          width: 360,
          height: 430,
          transform: `translateY(${cardIn}px)`,
        }}
      >
        <TalkingHead src={OLIVIA} level={level} time={t} mouthY={0.385} speaking radius={22} />
      </div>
      <div style={{ position: "absolute", right: 78, bottom: 82, width: 360 }}>
        <div
          style={{
            background: "rgba(4,6,12,0.88)",
            borderLeft: `5px solid ${GOLD}`,
            borderRadius: 8,
            padding: "8px 14px",
            color: "#fff",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 1,
          }}
        >
          OLIVIA VANCE
          <div style={{ color: GOLD, fontSize: 15, fontWeight: 600, letterSpacing: 2 }}>ORACLE LUNAR</div>
        </div>
      </div>

      {/* left lower third */}
      <div style={{ position: "absolute", left: 90, bottom: 96, maxWidth: 1080 }}>
        <div style={{ color: GOLD, fontSize: 20, letterSpacing: 6, fontWeight: 700, marginBottom: 8 }}>
          SCAM THE SCAMMER · OZZY STYLE
        </div>
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 26, letterSpacing: 3, fontWeight: 600 }}>
          FICTIONAL · AI-GENERATED PREVIEW
        </div>
      </div>
    </AbsoluteFill>
  );
};

const InterviewSeg: React.FC<{ seg: Seg; len: number; pre: number }> = ({ seg, len, pre }) => {
  const frame = useCurrentFrame();
  const level = envAt(seg.env, frame - pre);
  const t = frame / FPS;
  const oSpeaking = seg.speaker === "o";
  const fade = Math.min(
    interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [len - 6, len], [1, 0], { extrapolateLeft: "clamp" }),
  );
  const blink = Math.sin(t * 4) > 0 ? 1 : 0.25;

  return (
    <AbsoluteFill style={{ background: "#05070e", opacity: fade }}>
      <AbsoluteFill style={{ opacity: 0.32, filter: "blur(14px)" }}>
        <Img
          src={staticFile("storycut/23.png")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(3,5,12,0.7), rgba(3,5,12,0.95))" }} />

      <div style={{ position: "absolute", left: 108, top: 150, width: 700, height: 720 }}>
        <TalkingHead
          src={OLIVIA}
          level={oSpeaking ? level : level * 0.06}
          time={t}
          mouthY={0.385}
          speaking={oSpeaking}
          radius={26}
        />
      </div>
      <div style={{ position: "absolute", right: 108, top: 150, width: 700, height: 720 }}>
        <TalkingHead
          src={JUZZY}
          level={oSpeaking ? level * 0.06 : level}
          time={t + 1.3}
          mouthY={0.44}
          flip
          speaking={!oSpeaking}
          radius={26}
        />
      </div>

      <div style={{ position: "absolute", left: 108, top: 890 }}>
        <Plate name="OLIVIA VANCE" title="HOST" w={700} />
      </div>
      <div style={{ position: "absolute", right: 108, top: 890 }}>
        <Plate name="&quot;JUZZY&quot;" title="FICTIONAL CHARACTER" w={700} />
      </div>

      {/* LIVE badge */}
      <div
        style={{
          position: "absolute",
          left: 108,
          top: 76,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(150,18,18,0.95)",
          padding: "10px 22px",
          borderRadius: 8,
        }}
      >
        <div style={{ width: 16, height: 16, borderRadius: 999, background: "#fff", opacity: blink }} />
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, letterSpacing: 5 }}>LIVE</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 108,
          top: 80,
          color: "rgba(255,255,255,0.75)",
          fontSize: 24,
          letterSpacing: 4,
          fontWeight: 700,
        }}
      >
        SIMULATED INTERVIEW · NOT REAL
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------- root -------------------------------- */

export const HostedPreview: React.FC = () => (
  <AbsoluteFill style={{ background: "#03040a", fontFamily: "sans-serif" }}>
    {SEGS.map((seg, idx) => {
      const next = SEGS[idx + 1];
      const endSec = next ? next.start : seg.start + seg.dur + 1.0;
      const from = Math.round(seg.start * FPS) - (idx === 0 ? 0 : 6);
      const len = Math.round(endSec * FPS) - from + 6;
      const Comp = seg.mode === "studio" ? StudioSeg : seg.mode === "corner" ? CornerSeg : InterviewSeg;
      return (
        <Sequence key={seg.i} from={Math.max(0, from)} durationInFrames={len}>
          <Comp seg={seg} len={len} pre={idx === 0 ? 0 : 6} />
        </Sequence>
      );
    })}
    {/* film grain */}
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity: 0.05,
        background:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)",
      }}
    />
  </AbsoluteFill>
);
