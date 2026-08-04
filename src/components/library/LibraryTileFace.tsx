import { useEffect, useRef, useState } from "react";
import { getThumbnailUrl } from "@/lib/thumbnail";

/**
 * Ultra-light tile face for library grids.
 *
 * - Nothing is fetched until the tile scrolls into view (IntersectionObserver).
 * - The image is downscaled to a ~160px JPEG (server-side transform for
 *   Storage objects, canvas downscale otherwise) and memoised, so a grid of
 *   60 tiles costs kilobytes instead of tens of megabytes.
 * - Video tiles render a still poster instead of a <video> element — decoding
 *   dozens of video streams is the single heaviest thing a grid can do.
 */
interface Props {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: number;
  fallback?: React.ReactNode;
}

const LibraryTileFace = ({ src, alt = "", className = "", size = 160, fallback = null }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [thumb, setThumb] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    if (!visible || !src) return;
    getThumbnailUrl(src, size)
      .then((u) => { if (!cancelled) setThumb(u || null); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visible, src, size]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <div ref={ref} className={`w-full h-full ${className}`}>
      {thumb ? (
        <img
          src={thumb}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-muted/30 animate-pulse" />
      )}
    </div>
  );
};

export default LibraryTileFace;
