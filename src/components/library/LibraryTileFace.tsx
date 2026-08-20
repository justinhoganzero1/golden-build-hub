import { useEffect, useRef, useState } from "react";
import { getThumbnailUrl } from "@/lib/thumbnail";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ultra-light tile face for library grids.
 *
 * - Nothing is fetched until the tile scrolls into view (IntersectionObserver).
 * - The image is downscaled to a ~160px JPEG (server-side transform for
 *   Storage objects, canvas downscale otherwise) and memoised, so a grid of
 *   60 tiles costs kilobytes instead of tens of megabytes.
 * - Video tiles render a still poster instead of a <video> element — decoding
 *   dozens of video streams is the single heaviest thing a grid can do.
 * - List queries omit the heavy `url` column, so when a row has no
 *   `thumbnail_url` yet we lazily fetch that single row's `url` (only for the
 *   ~20 tiles actually on screen), build a tiny preview, and write it back to
 *   `thumbnail_url` so it never has to be computed again.
 */
interface Props {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: number;
  fallback?: React.ReactNode;
  /** user_media row id — enables lazy backfill when `src` is missing. */
  mediaId?: string | null;
  /** only image-like rows are worth backfilling. */
  canBackfill?: boolean;
}

const LibraryTileFace = ({
  src,
  alt = "",
  className = "",
  size = 160,
  fallback = null,
  mediaId = null,
  canBackfill = false,
}: Props) => {
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
    if (!visible) return;

    const run = async () => {
      let source = src || null;

      // No thumbnail stored on the row — pull the full media URL for this one
      // row on demand (the list query deliberately omits it).
      if (!source && mediaId && canBackfill) {
        try {
          const { data } = await supabase
            .from("user_media")
            .select("url")
            .eq("id", mediaId)
            .maybeSingle();
          source = (data as any)?.url || null;
        } catch { /* ignore — falls back below */ }
      }
      if (!source) { if (!cancelled) setFailed(true); return; }

      let out: string | null = null;
      try {
        out = await getThumbnailUrl(source, size);
      } catch { /* handled below */ }
      if (cancelled) return;
      if (!out) { setFailed(true); return; }
      setThumb(out);

      // Persist a genuinely small preview so future page loads are instant.
      if (!src && mediaId && canBackfill && out.startsWith("data:image/") && out.length < 60_000) {
        supabase.from("user_media").update({ thumbnail_url: out }).eq("id", mediaId).then(() => {});
      }
    };

    run();
    return () => { cancelled = true; };
  }, [visible, src, size, mediaId, canBackfill]);

  if ((!src && !(mediaId && canBackfill)) || failed) return <>{fallback}</>;


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
