// StudioLibraryStrip — in-studio view of everything the user has created.
// Work is auto-saved to user_media (main Library); this surfaces it inside the
// studio so creators can close/reopen their work without leaving the hub.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Image as ImageIcon, Video, Music, FileText, Box, ArrowRight, Loader2 } from "lucide-react";
import LibraryTileFace from "@/components/library/LibraryTileFace";
import { useAllUserMediaPaginated } from "@/hooks/useAllUserMedia";

const FILTERS = [
  { key: "all", label: "All", Icon: FolderOpen },
  { key: "image", label: "Photos", Icon: ImageIcon },
  { key: "video", label: "Videos", Icon: Video },
  { key: "audio", label: "Audio", Icon: Music },
  { key: "text", label: "Stories", Icon: FileText },
  { key: "app", label: "Apps", Icon: Box },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const StudioLibraryStrip = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAllUserMediaPaginated(true, 24);

  const items = useMemo(() => {
    const flat = (data?.pages || []).flat();
    return filter === "all" ? flat : flat.filter((i: any) => i.media_type === filter);
  }, [data, filter]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-amber-300" />
          Studio Library
        </h2>
        <button
          onClick={() => navigate("/media-library")}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-300 hover:gap-2.5 transition-all"
        >
          Open full library <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Everything you make is saved automatically — close your work any time and pick it back up here.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
              filter === f.key
                ? "text-amber-300 border-amber-500/50 bg-amber-500/15"
                : "text-muted-foreground border-border/60 hover:border-amber-500/30"
            }`}
          >
            <f.Icon className="w-3 h-3" />
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your work…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nothing saved here yet — create something in a studio above and it lands here automatically.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {items.map((item: any) => (
              <button
                key={item.id}
                onClick={() => navigate(`/media-library?item=${item.id}`)}
                title={item.title || "Untitled"}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-card hover:border-amber-500/50 transition-colors"
              >
                <LibraryTileFace
                  src={item.thumbnail_url}
                  alt={item.title || "Saved creation"}
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-muted/30 text-muted-foreground">
                      <FileText className="w-5 h-5" />
                    </div>
                  }
                />
                <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[10px] leading-tight text-left bg-gradient-to-t from-background/95 to-transparent text-foreground line-clamp-2">
                  {item.title || "Untitled"}
                </span>
              </button>
            ))}
          </div>

          {hasNextPage && (
            <div className="text-center mt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="text-xs px-4 py-2 rounded-full border border-border/60 text-muted-foreground hover:border-amber-500/40 hover:text-amber-300 transition-colors"
              >
                {isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default StudioLibraryStrip;
