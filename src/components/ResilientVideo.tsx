import { forwardRef, type VideoHTMLAttributes } from "react";
import { ExternalLink, RotateCw } from "lucide-react";
import useResilientVideo from "@/hooks/useResilientVideo";
import { DownloadButton } from "@/components/DownloadButton";
import { Button } from "@/components/ui/button";

type Props = VideoHTMLAttributes<HTMLVideoElement> & {
  /** Called when the recovery ladder needs a fresh (re-signed) URL. */
  onResign?: () => void;
  /** Show a subtle "reconnecting" pill while a fallback is running. */
  showStatus?: boolean;
  /** Filename used by the manual "Download MP4" escape hatch. */
  downloadName?: string;
};

/**
 * <video> that heals itself. Runs the 59-step fallback ladder whenever
 * playback stalls. If every rung fails, the viewer is offered a manual
 * escape hatch: download the MP4, open it in a new tab, or retry.
 */
const ResilientVideo = forwardRef<HTMLVideoElement, Props>(function ResilientVideo(
  { onResign, showStatus = true, className, downloadName, ...rest },
  _forwarded
) {
  const { ref, recovering, attempts, exhausted, retry, totalFallbacks } = useResilientVideo({ onResign });
  const src = typeof rest.src === "string" ? rest.src : "";

  return (
    <div className="relative w-full h-full">
      <video ref={ref} playsInline preload="auto" className={className} {...rest} />

      {showStatus && recovering && !exhausted && (
        <div className="absolute bottom-2 left-2 rounded-full bg-background/80 border border-border px-2 py-0.5 text-[10px] text-muted-foreground pointer-events-none">
          Reconnecting… ({attempts}/{totalFallbacks})
        </div>
      )}

      {exhausted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm p-3 text-center">
          <p className="text-xs text-muted-foreground max-w-[16rem]">
            Streaming didn't hold after {totalFallbacks} retries. Save the file or open it directly instead.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {src && (
              <DownloadButton
                url={src}
                filename={downloadName || "oracle-lunar-video.mp4"}
                label="Download MP4"
                size="sm"
              />
            )}
            {src && (
              <Button asChild size="sm" variant="outline">
                <a href={src} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in new tab
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={retry}>
              <RotateCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

export default ResilientVideo;
