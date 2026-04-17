import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

interface LiveAvatarProps {
  imageUrl?: string | null;
  name: string;
  isSpeaking: boolean;
  isListening: boolean;
  isLoading: boolean;
  /** Optional analyser node to drive lipsync mouth amplitude. */
  analyser?: AnalyserNode | null;
  className?: string;
}

/**
 * 2.5D animated avatar: takes any user-generated avatar image and brings it to life
 * with lipsync (mouth open/close), blinking, head sway, breathing, and a city-office backdrop.
 * Has a small in-box mode and a fullscreen cinematic mode.
 */
const LiveAvatar = ({
  imageUrl,
  name,
  isSpeaking,
  isListening,
  isLoading,
  analyser,
  className = "",
}: LiveAvatarProps) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0); // 0..1
  const [eyesClosed, setEyesClosed] = useState(false);
  const rafRef = useRef<number | null>(null);
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lipsync — drive mouth from analyser amplitude when speaking, fall back to oscillator
  useEffect(() => {
    let dataArr: Uint8Array<ArrayBuffer> | null = null;
    if (analyser) dataArr = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    let phase = 0;

    const tick = () => {
      if (!isSpeaking) {
        setMouthOpen(prev => prev * 0.7);
      } else if (analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr);
        // average low-mid frequencies (voice range)
        let sum = 0;
        const len = Math.min(64, dataArr.length);
        for (let i = 4; i < len; i++) sum += dataArr[i];
        const amp = Math.min(1, sum / (len * 90));
        setMouthOpen(amp);
      } else {
        // fallback: oscillate to fake mouth movement
        phase += 0.35;
        setMouthOpen(0.25 + Math.abs(Math.sin(phase)) * 0.55);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isSpeaking, analyser]);

  // Blink loop
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3500;
      blinkTimerRef.current = setTimeout(() => {
        setEyesClosed(true);
        setTimeout(() => setEyesClosed(false), 130);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // Subtle floating/breathing transform values driven by time
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 40);
    return () => clearInterval(id);
  }, []);
  const sway = Math.sin(tick / 20) * 4;
  const breathe = 1 + Math.sin(tick / 18) * 0.012;
  const headTilt = Math.sin(tick / 28) * 1.5;

  const sizeClass = fullscreen
    ? "fixed inset-0 z-[100] flex items-center justify-center bg-black"
    : "relative w-full h-full flex items-center justify-center";

  const avatarSize = fullscreen ? "min(70vh, 70vw)" : "min(100%, 260px)";

  // City-office backdrop (CSS only — gradient skyline)
  const Backdrop = () => (
    <div className="absolute inset-0 overflow-hidden rounded-2xl">
      {/* sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1226] via-[#1a1f3d] to-[#2d1b3a]" />
      {/* sun glow */}
      <div className="absolute top-[18%] right-[20%] w-32 h-32 rounded-full bg-amber-400/30 blur-3xl" />
      {/* skyline silhouettes */}
      <div className="absolute bottom-[35%] left-0 right-0 h-1/3 flex items-end justify-around opacity-90">
        {[28, 44, 36, 60, 32, 48, 40, 56, 30, 50].map((h, i) => (
          <div
            key={i}
            className="bg-[#0a0f1f] border-t border-x border-amber-500/10"
            style={{
              width: `${6 + (i % 3) * 2}%`,
              height: `${h}%`,
            }}
          >
            {/* lit windows */}
            <div className="grid grid-cols-3 gap-[2px] p-1 h-full">
              {Array.from({ length: 12 }).map((_, j) => (
                <div
                  key={j}
                  className="bg-amber-300/40"
                  style={{ opacity: (i * 7 + j * 3) % 5 === 0 ? 0.9 : 0.15 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* office floor */}
      <div className="absolute bottom-0 left-0 right-0 h-[35%] bg-gradient-to-b from-[#1a1428] to-[#0a0612]" />
      {/* desk line */}
      <div className="absolute bottom-[28%] left-0 right-0 h-[2px] bg-amber-500/20" />
    </div>
  );

  const accentColor = isSpeaking
    ? "shadow-[0_0_60px_rgba(236,72,153,0.55)]"
    : isListening
    ? "shadow-[0_0_45px_rgba(168,85,247,0.45)]"
    : "shadow-[0_0_30px_rgba(168,85,247,0.25)]";

  return (
    <div className={`${sizeClass} ${className}`}>
      <div
        className={`relative ${fullscreen ? "w-full h-full" : "w-full h-full min-h-[260px] rounded-2xl overflow-hidden"}`}
      >
        <Backdrop />

        {/* Fullscreen toggle */}
        <button
          onClick={() => setFullscreen(f => !f)}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/50 hover:bg-black/70 text-amber-300 backdrop-blur-sm transition"
          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Avatar stage */}
        <div
          className="absolute left-1/2 z-10"
          style={{
            top: "50%",
            transform: `translate(-50%, -50%) translateX(${sway}px)`,
          }}
        >
          <div
            className="relative rounded-full overflow-hidden border-4 border-amber-500/40 transition-all"
            style={{
              width: avatarSize,
              height: avatarSize,
              transform: `scale(${breathe}) rotate(${headTilt}deg)`,
              transformOrigin: "center 60%",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className={`w-full h-full object-cover ${accentColor}`}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 flex items-center justify-center text-7xl">
                👤
              </div>
            )}

            {/* Eyelid overlays — drop down across upper-mid face when blinking */}
            <div
              className="pointer-events-none absolute left-[18%] right-[18%] bg-black/0"
              style={{
                top: "32%",
                height: eyesClosed ? "12%" : "0%",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.4))",
                borderRadius: "50%",
                transition: "height 90ms ease-out",
              }}
            />

            {/* Mouth overlay — dark ellipse that grows with amplitude */}
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bg-[#2a0a14] border border-black/60"
              style={{
                bottom: "22%",
                width: `${18 + mouthOpen * 8}%`,
                height: `${2 + mouthOpen * 14}%`,
                borderRadius: "50%",
                opacity: 0.78,
                transition: "width 60ms linear, height 60ms linear",
                boxShadow: "inset 0 -2px 6px rgba(0,0,0,0.6)",
              }}
            />

            {/* Glow ring */}
            <div
              className={`pointer-events-none absolute inset-0 rounded-full ${accentColor} transition-shadow`}
            />
          </div>

          {/* Name plate */}
          <p
            className={`text-center font-medium text-amber-200 mt-3 ${
              fullscreen ? "text-xl" : "text-sm"
            }`}
          >
            {name}
            {isSpeaking && <span className="ml-2 text-pink-400 animate-pulse">● speaking</span>}
            {!isSpeaking && isListening && (
              <span className="ml-2 text-purple-400 animate-pulse">● listening</span>
            )}
            {isLoading && !isSpeaking && (
              <span className="ml-2 text-amber-400 animate-pulse">● thinking</span>
            )}
          </p>
        </div>

        {/* Floor reflection / shadow */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-black/50 blur-md"
          style={{
            bottom: fullscreen ? "12%" : "8%",
            width: fullscreen ? "30%" : "55%",
            height: fullscreen ? "3%" : "5%",
            transform: `translateX(-50%) scaleX(${1 + Math.sin(tick / 18) * 0.04})`,
          }}
        />
      </div>
    </div>
  );
};

export default LiveAvatar;
