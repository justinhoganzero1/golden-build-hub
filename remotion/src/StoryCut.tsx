import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import DATA from "./storycut-data.json";

const FPS = 30;
const GOLD = "#E8B44A";

type Beat = { n: string; c: string; m: string; f: number; d: number };
const BEATS = DATA as Beat[];

const starts: number[] = [];
let acc = 0;
for (const b of BEATS) {
  starts.push(Math.round(acc * FPS));
  acc += b.d;
}
export const STORYCUT_FRAMES = Math.round(acc * FPS) + 105;

const Scene: React.FC<{ beat: Beat; len: number; index: number }> = ({ beat, len, index }) => {
  const frame = useCurrentFrame();
  const p = frame / len;

  // Ken Burns / camera move
  const zoom =
    beat.m === "zoom-in" ? interpolate(p, [0, 1], [1.04, 1.22])
    : beat.m === "zoom-out" ? interpolate(p, [0, 1], [1.24, 1.05])
    : interpolate(p, [0, 1], [1.1, 1.18]);
  const tx =
    beat.m === "pan-left" ? interpolate(p, [0, 1], [4, -4])
    : beat.m === "pan-right" ? interpolate(p, [0, 1], [-4, 4])
    : beat.m === "ken-burns" ? interpolate(p, [0, 1], [-2.5, 2.5])
    : 0;
  const ty = beat.m === "ken-burns" ? interpolate(p, [0, 1], [1.5, -1.5]) : 0;

  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [len - 8, len], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const capIn = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const capOut = interpolate(frame, [len - 14, len - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const capY = interpolate(frame, [4, 18], [26, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: "#07070a", opacity }}>
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${tx}%, ${ty}%)` }}>
        <Img
          src={staticFile(`storycut/${String(beat.f).padStart(2, "0")}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* cinematic grade + vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(0,0,0,0.72) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(4,4,8,0.94) 0%, rgba(4,4,8,0.35) 26%, rgba(0,0,0,0) 52%)",
        }}
      />

      {/* caption */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 108,
          opacity: Math.min(capIn, capOut),
          transform: `translateY(${capY}px)`,
        }}
      >
        <div
          style={{
            border: `2px solid ${GOLD}`,
            background: "rgba(8,8,12,0.55)",
            padding: "14px 40px",
            borderRadius: 4,
          }}
        >
          <div
            style={{
              fontFamily: "Liberation Sans, Arial, sans-serif",
              fontWeight: 800,
              fontSize: 58,
              letterSpacing: 5,
              color: GOLD,
              textTransform: "uppercase",
              textShadow: "0 4px 22px rgba(0,0,0,0.9)",
            }}
          >
            {beat.c}
          </div>
        </div>
      </AbsoluteFill>

      {/* scene ticker */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", padding: 40 }}>
        <div
          style={{
            fontFamily: "Liberation Mono, monospace",
            fontSize: 20,
            color: "rgba(232,180,74,0.65)",
            letterSpacing: 3,
          }}
        >
          SCENE {String(index + 1).padStart(2, "0")}/{BEATS.length}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const s = interpolate(frame, [0, 40], [1.08, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(160deg, #0a0a10 0%, #16110a 55%, #07070a 100%)",
        justifyContent: "center",
        alignItems: "center",
        opacity: o,
      }}
    >
      <div style={{ textAlign: "center", transform: `scale(${s})` }}>
        <div
          style={{
            fontFamily: "Liberation Sans, Arial, sans-serif",
            fontWeight: 900,
            fontSize: 96,
            color: GOLD,
            letterSpacing: 6,
            textShadow: "0 8px 40px rgba(232,180,74,0.35)",
          }}
        >
          SCAM THE SCAMMER
        </div>
        <div
          style={{
            fontFamily: "Liberation Sans, Arial, sans-serif",
            fontWeight: 700,
            fontSize: 52,
            color: "#f4e6c8",
            letterSpacing: 14,
            marginTop: 8,
          }}
        >
          JUZZY STYLE
        </div>
        <div style={{ height: 2, background: GOLD, width: 520, margin: "34px auto", opacity: 0.8 }} />
        <div
          style={{
            fontFamily: "Liberation Sans, Arial, sans-serif",
            fontSize: 30,
            color: "rgba(244,230,200,0.85)",
            letterSpacing: 4,
          }}
        >
          WRITTEN IN STORY WRITER · FILMED IN MOVIE MAKER
        </div>
        <div
          style={{
            marginTop: 26,
            display: "inline-block",
            border: `2px solid ${GOLD}`,
            padding: "12px 32px",
            fontFamily: "Liberation Sans, Arial, sans-serif",
            fontSize: 34,
            fontWeight: 800,
            color: GOLD,
            letterSpacing: 3,
          }}
        >
          oracle-lunar.online
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const StoryCut: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07070a" }}>
      {BEATS.map((b, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={Math.round(b.d * FPS) + 2}>
          <Scene beat={b} len={Math.round(b.d * FPS)} index={i} />
        </Sequence>
      ))}
      <Sequence from={durationInFrames - 105} durationInFrames={105}>
        <TitleCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export default StoryCut;
