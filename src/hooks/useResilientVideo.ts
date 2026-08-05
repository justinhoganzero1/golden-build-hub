import { useCallback, useEffect, useRef, useState } from "react";
import { fallbackFor, VIDEO_FALLBACK_COUNT } from "@/lib/videoResilience";

/**
 * Keeps a <video> playing without the viewer ever touching play again.
 *
 * Watches for stall / waiting / suspend / error / silent-freeze conditions and
 * walks the 59-step fallback ladder until playback resumes. A real user pause
 * is respected — recovery only fires when the browser stopped on its own.
 */
export function useResilientVideo(opts: {
  /** Called when the ladder asks for a fresh URL (e.g. re-sign storage link). */
  onResign?: () => void;
  /** Disable recovery entirely (e.g. tiny looping preview tiles). */
  enabled?: boolean;
} = {}) {
  const { onResign, enabled = true } = opts;
  const ref = useRef<HTMLVideoElement | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const userPausedRef = useRef(false);
  const lastTimeRef = useRef(0);
  const [recovering, setRecovering] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const recover = useCallback(() => {
    const el = ref.current;
    if (!el || !enabled || userPausedRef.current || el.ended) return;
    if (timerRef.current !== null) return; // one recovery in flight at a time
    if (attemptRef.current >= VIDEO_FALLBACK_COUNT) {
      // Every rung of the ladder failed — hand the viewer a manual escape hatch.
      setRecovering(false);
      setExhausted(true);
      return;
    }

    const step = fallbackFor(attemptRef.current);
    attemptRef.current += 1;
    setAttempts(attemptRef.current);
    setRecovering(true);

    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      const v = ref.current;
      if (!v || userPausedRef.current) { setRecovering(false); return; }
      const at = v.currentTime;

      try {
        switch (step.kind) {
          case "nudge":
            v.currentTime = Math.min(at + step.nudge, Math.max(0, v.duration || at + 1));
            break;
          case "buffer-seek": {
            const b = v.buffered;
            for (let i = 0; i < b.length; i++) {
              if (at >= b.start(i) - 0.5 && at <= b.end(i)) {
                v.currentTime = Math.max(at, b.end(i) - 0.1);
                break;
              }
            }
            break;
          }
          case "muted-resume":
            v.muted = true;
            break;
          case "preload-all":
            v.preload = "auto";
            v.load();
            v.currentTime = at;
            break;
          case "reload-src":
            v.load();
            v.currentTime = at;
            break;
          case "resign":
            onResign?.();
            v.load();
            v.currentTime = at;
            break;
          case "low-quality":
            v.disablePictureInPicture = true;
            (v as HTMLVideoElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true;
            v.preload = "auto";
            v.load();
            v.currentTime = at;
            break;
          case "back-off":
          case "resume":
          default:
            break;
        }
        await v.play();
        setRecovering(false);
      } catch {
        setRecovering(false);
        // The watchdog below will schedule the next rung of the ladder.
      }
    }, step.delayMs);
  }, [enabled, onResign]);

  // Attach listeners + freeze watchdog.
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    const onPlaying = () => {
      attemptRef.current = 0;
      setAttempts(0);
      setRecovering(false);
      setExhausted(false);
      clearTimer();
    };
    const onUserPause = () => {
      // A pause with buffered data and no seek in flight is a real user pause.
      if (!el.seeking && !el.ended && el.readyState >= 3) userPausedRef.current = true;
      // Any browser-side stall shows up as waiting/stalled instead.
    };
    const onPlay = () => { userPausedRef.current = false; };
    const stallish = () => recover();

    el.addEventListener("playing", onPlaying);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onUserPause);
    el.addEventListener("waiting", stallish);
    el.addEventListener("stalled", stallish);
    el.addEventListener("suspend", stallish);
    el.addEventListener("error", stallish);
    el.addEventListener("abort", stallish);

    // Silent freeze watchdog: currentTime not advancing while "playing".
    const watchdog = window.setInterval(() => {
      const v = ref.current;
      if (!v || userPausedRef.current || v.paused || v.ended) return;
      if (Math.abs(v.currentTime - lastTimeRef.current) < 0.01) recover();
      lastTimeRef.current = v.currentTime;
    }, 1200);

    // Tab/app returning to the foreground is the classic "it stopped" moment.
    const onVisible = () => { if (document.visibilityState === "visible") recover(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimer();
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onUserPause);
      el.removeEventListener("waiting", stallish);
      el.removeEventListener("stalled", stallish);
      el.removeEventListener("suspend", stallish);
      el.removeEventListener("error", stallish);
      el.removeEventListener("abort", stallish);
    };
  }, [enabled, recover]);

  const retry = useCallback(() => {
    attemptRef.current = 0;
    setAttempts(0);
    setExhausted(false);
    userPausedRef.current = false;
    const v = ref.current;
    if (v) {
      v.load();
      v.play().catch(() => {});
    }
  }, []);

  return { ref, recovering, attempts, exhausted, retry, totalFallbacks: VIDEO_FALLBACK_COUNT };
}

export default useResilientVideo;
