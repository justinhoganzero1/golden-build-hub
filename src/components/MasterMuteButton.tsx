import { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useMute } from "@/contexts/MuteContext";
import { useLocation } from "react-router-dom";

const MasterMuteButton = () => {
  const { isMuted, toggleMute } = useMute();
  const [pos, setPos] = useState({ x: window.innerWidth - 44, y: window.innerHeight - 100 });
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
        x: clamp(mx - offset.current.x, 4, window.innerWidth - 36),
        y: clamp(my - offset.current.y, 4, window.innerHeight - 36),
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
      className={`fixed z-50 w-8 h-8 rounded-full shadow-md flex items-center justify-center transition-all duration-200 cursor-grab active:cursor-grabbing touch-none border ${
        isMuted
          ? "bg-red-600/90 border-red-500/50 hover:bg-red-500"
          : "bg-green-600/90 border-green-500/50 hover:bg-green-500"
      }`}
      style={{ left: pos.x, top: pos.y, opacity: 0.85 }}
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
    </button>
  );
};

export default MasterMuteButton;
