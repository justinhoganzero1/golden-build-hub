import { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useMute } from "@/contexts/MuteContext";

const MasterMuteButton = () => {
  const { isMuted, toggleMute } = useMute();
  const [pos, setPos] = useState({ x: window.innerWidth - 60, y: window.innerHeight - 140 });
  const dragging = useRef(false);
  const hasMoved = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    dragging.current = true;
    hasMoved.current = false;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };

    const handleMove = (mx: number, my: number) => {
      if (!dragging.current) return;
      hasMoved.current = true;
      setPos({
        x: clamp(mx - offset.current.x, 4, window.innerWidth - 52),
        y: clamp(my - offset.current.y, 4, window.innerHeight - 52),
      });
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleEnd = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
  }, [pos]);

  return (
    <button
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onClick={(e) => {
        if (hasMoved.current) {
          e.preventDefault();
          return;
        }
        toggleMute();
      }}
      className="fixed z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-shadow cursor-grab active:cursor-grabbing touch-none"
      style={{ left: pos.x, top: pos.y }}
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
};

export default MasterMuteButton;
