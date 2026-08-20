import { useEffect, useState } from "react";
import { Maximize2, Sparkles, X } from "lucide-react";
import { SignedImage } from "@/components/SignedMedia";

interface IllustrationPlateProps {
  src: string;
  /** 1-based plate number shown on the page furniture. */
  index: number;
  caption?: string;
  /** Holographic plates get a prism overlay. */
  holographic?: boolean;
  onRemove?: () => void;
}

/**
 * A full-page book plate: one illustration per page, portrait, edge to edge.
 * Tapping it opens a simple full-screen lightbox (no 3D viewer).
 */
export const IllustrationPlate = ({ src, index, caption, holographic, onRemove }: IllustrationPlateProps) => {
  const [open, setOpen] = useState(false);

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
          aria-label="View this illustration full screen"
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
            <Maximize2 className="w-3 h-3" /> Full screen
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
          <div className="flex items-center justify-end px-4 py-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Close
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
            <SignedImage
              src={src}
              alt={caption || `Full-page illustration ${index}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default IllustrationPlate;
