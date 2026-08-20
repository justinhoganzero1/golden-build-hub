import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Maximize2, Sparkles, X } from "lucide-react";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import { SignedImage } from "@/components/SignedMedia";

const Photo3DViewer = lazy(() => import("@/components/Photo3DViewer"));

interface IllustrationPlateProps {
  src: string;
  /** 1-based plate number shown on the page furniture. */
  index: number;
  caption?: string;
  /** Holographic plates get a stronger parallax + prism overlay. */
  holographic?: boolean;
  onRemove?: () => void;
}

/**
 * A full-page book plate: one illustration per page, portrait, edge to edge.
 * Tapping it opens a 360° zoomable 3D room where the reader can orbit, tilt and
 * zoom right into the artwork — holographic plates get extra depth + prism glow.
 */
export const IllustrationPlate = ({ src, index, caption, holographic, onRemove }: IllustrationPlateProps) => {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    resolveStorageUrl(src, 3600)
      .catch(() => src)
      .then(u => { if (alive) setResolved(u); });
    return () => { alive = false; };
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <figure
        className={`relative mx-auto my-8 w-full max-w-[34rem] overflow-hidden rounded-2xl border ${
          holographic
            ? "border-accent-blue/60 shadow-[0_0_60px_-12px_hsl(var(--primary)/0.55)]"
            : "border-border"
        } bg-black`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group block w-full"
          aria-label="Open this illustration in 360° 3D"
        >
          <SignedImage
            src={src}
            alt={caption || `Full-page illustration ${index}`}
            className="w-full aspect-[2/3] object-cover"
          />
          {holographic && (
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,hsl(var(--primary)/0.22)_50%,transparent_65%)] mix-blend-screen" />
          )}
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white flex items-center gap-1">
            <Maximize2 className="w-3 h-3" /> 360° zoom
          </span>
          {holographic && (
            <span className="absolute top-2 left-2 rounded-full bg-primary/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Hologram plate
            </span>
          )}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
            aria-label="Remove illustration"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
          Plate {index}{caption ? ` — ${caption}` : ""} · full page
        </figcaption>
      </figure>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-white/80">
            <span>
              Drag to orbit · scroll or pinch to zoom{holographic ? " · holographic plate" : ""}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
          <div className="flex-1">
            {resolved ? (
              <Suspense fallback={<div className="h-full flex items-center justify-center text-white/70"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
                <Photo3DViewer imageUrl={resolved} depth={holographic ? 0.85 : 0.45} />
              </Suspense>
            ) : (
              <div className="h-full flex items-center justify-center text-white/70">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default IllustrationPlate;
