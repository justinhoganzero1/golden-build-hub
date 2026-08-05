import { forwardRef, type VideoHTMLAttributes } from "react";
import useResilientVideo from "@/hooks/useResilientVideo";

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  /** Called when the recovery ladder needs a fresh (re-signed) URL. */
  onResign?: () => void;
  /** Show a subtle "reconnecting" pill while a fallback is running. */
  showStatus?: boolean;
};

/**
 * <video> that heals itself. Runs the 59-step fallback ladder whenever
 * playback stalls, so the viewer never has to hit play again.
 */
const ResilientVideo = forwardRef<HTMLVideoElement, Props>(function ResilientVideo(
  { onResign, showStatus = true, className, ...rest },
  _forwarded
) {
  const { ref, recovering, attempts, totalFallbacks } = useResilientVideo({ onResign });

  return (
    <div className="relative w-full h-full">
      <video ref={ref} playsInline preload="auto" className={className} {...rest} />
      {showStatus && recovering && (
        <div className="absolute bottom-2 left-2 rounded-full bg-background/80 border border-border px-2 py-0.5 text-[10px] text-muted-foreground pointer-events-none">
          Reconnecting… ({attempts}/{totalFallbacks})
        </div>
      )}
    </div>
  );
});

export default ResilientVideo;
