import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePublicLibrary, type PublicLibraryItem } from "@/hooks/usePublicLibrary";
import { Sparkles, ShoppingBag, Eye, Download } from "lucide-react";

// Map raw source_page values into friendly genre groups (bubbles)
const GENRE_MAP: Record<string, { label: string; emoji: string }> = {
  "photography-hub": { label: "Photography", emoji: "📸" },
  "photo-edit-studio": { label: "Photography", emoji: "📸" },
  "magic-hub": { label: "Magic Photos", emoji: "✨" },
  "avatar-generator": { label: "Avatars", emoji: "🧑‍🎤" },
  "Avatar Generator": { label: "Avatars", emoji: "🧑‍🎤" },
  "living-avatars": { label: "Living Avatars", emoji: "🌀" },
  "story-writer": { label: "Stories", emoji: "📖" },
  "movie-studio": { label: "Movies", emoji: "🎬" },
  "standalone-photo": { label: "Photography", emoji: "📸" },
};

const genreFor = (item: PublicLibraryItem) => {
  if (item.kind === "movie") return { label: "Movies", emoji: "🎬" };
  if (item.kind === "gif") return { label: "Living Avatars", emoji: "🌀" };
  const sp = (item.source_page || "").trim();
  return GENRE_MAP[sp] || { label: "Other", emoji: "🎨" };
};

const formatPrice = (cents: number) =>
  cents > 0 ? `$${(cents / 100).toFixed(2)}` : "Free";

const HomePublicGallery = () => {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = usePublicLibrary("all");
  const [activeGenre, setActiveGenre] = useState<string>("All");

  const grouped = useMemo(() => {
    const map = new Map<string, { emoji: string; items: PublicLibraryItem[] }>();
    for (const item of items) {
      const g = genreFor(item);
      if (!map.has(g.label)) map.set(g.label, { emoji: g.emoji, items: [] });
      map.get(g.label)!.items.push(item);
    }
    return map;
  }, [items]);

  const genres = useMemo(
    () => ["All", ...Array.from(grouped.keys()).sort()],
    [grouped],
  );

  const visibleItems = useMemo(() => {
    if (activeGenre === "All") return items.slice(0, 24);
    return grouped.get(activeGenre)?.items.slice(0, 24) ?? [];
  }, [activeGenre, items, grouped]);

  if (isLoading) {
    return (
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-4 text-center text-xs text-muted-foreground">
          Loading creators’ public gallery…
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-4 text-center">
          <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Creators’ Gallery
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Be the first to publish a creation. Open any studio, then toggle “Share to Public Library”.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="px-4 mb-4" aria-label="Creators public gallery">
      <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Creators’ Gallery</h2>
            <span className="text-[10px] text-muted-foreground">({items.length})</span>
          </div>
          <button
            onClick={() => navigate("/public-library")}
            className="text-[11px] px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition"
          >
            View all
          </button>
        </header>

        {/* Genre bubble filter */}
        <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {genres.map((g) => {
            const meta = g === "All" ? { emoji: "🌐" } : { emoji: grouped.get(g)?.emoji ?? "🎨" };
            const active = g === activeGenre;
            return (
              <button
                key={g}
                onClick={() => setActiveGenre(g)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{g}</span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-3">
          {visibleItems.map((item) => {
            const thumb = item.thumbnail_url || (item.media_type === "image" ? item.url : "");
            return (
              <button
                key={`${item.kind}-${item.id}`}
                onClick={() => navigate(`/public-library?focus=${item.kind}-${item.id}`)}
                className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted/30 text-left hover:border-primary/60 transition"
                aria-label={item.title || "Creation"}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={item.title || "Creation"}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">
                    {item.media_type.toUpperCase()}
                  </div>
                )}

                {/* Bottom info bar */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                  <p className="text-[10px] font-semibold text-white line-clamp-1">
                    {item.title || "Untitled"}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-white/70 line-clamp-1">
                      {item.creator_display_name || "Anonymous"}
                    </span>
                    {item.shop_enabled && item.shop_price_cents > 0 ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-bold">
                        <ShoppingBag className="w-2.5 h-2.5" />
                        {formatPrice(item.shop_price_cents)}
                      </span>
                    ) : (
                      <span className="text-[9px] text-white/60 inline-flex items-center gap-0.5">
                        <Eye className="w-2.5 h-2.5" />
                        {item.view_count}
                        <Download className="w-2.5 h-2.5 ml-1" />
                        {item.download_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default HomePublicGallery;
