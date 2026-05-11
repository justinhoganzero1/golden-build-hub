import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePublicLibrary, type PublicLibraryItem } from "@/hooks/usePublicLibrary";
import { Sparkles, ShoppingBag, Eye, Download, Search, X } from "lucide-react";
import monthlyWinnerPhoto from "@/assets/monthly-winner-photo.jpg";
import monthlyWinnerStory from "@/assets/monthly-winner-story.jpg";
import monthlyWinnerVideo from "@/assets/monthly-winner-video.jpg";
import monthlyWinnerArt from "@/assets/monthly-winner-art.jpg";
import monthlyWinnerApp from "@/assets/monthly-winner-app.jpg";
import monthlyWinnerGeneral from "@/assets/monthly-winner-general.jpg";

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

// Curated demo creations so the gallery never looks empty.
// These are showcase pieces — clicking opens the Public Library / Shop.
const ux = (id: string, w = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${w}&q=85`;

type DemoItem = {
  id: string;
  title: string;
  creator: string;
  genre: string;
  emoji: string;
  thumb: string;
  priceCents: number;
  views: number;
  downloads: number;
};

const DEMO_ITEMS: DemoItem[] = [
  { id: "d1",  title: "Velvet Saint",          creator: "Aurora Vex",   genre: "Photography",    emoji: "📸", thumb: monthlyWinnerPhoto, priceCents: 1200, views: 18432, downloads: 920 },
  { id: "d2",  title: "Midnight Monarch",      creator: "Kiyan Mori",   genre: "Photography",    emoji: "📸", thumb: ux("1506794778202-cad84cf45f1d"), priceCents: 800,  views: 14201, downloads: 612 },
  { id: "d3",  title: "Solar Empress",         creator: "Vega Kade",    genre: "Avatars",        emoji: "🧑‍🎤", thumb: ux("1488426862026-3ee34a7d66df"), priceCents: 600,  views: 41022, downloads: 3140 },
  { id: "d4",  title: "Obsidian Knight",       creator: "Indra Noor",   genre: "Avatars",        emoji: "🧑‍🎤", thumb: ux("1492562080023-ab3db95bfbce"), priceCents: 700,  views: 25678, downloads: 1820 },
  { id: "d5",  title: "Echoes of Mars",        creator: "Dax Halberg",  genre: "Movies",         emoji: "🎬", thumb: monthlyWinnerVideo, priceCents: 1500, views: 32042, downloads: 2410 },
  { id: "d6",  title: "Last Light",            creator: "Mira Solé",    genre: "Movies",         emoji: "🎬", thumb: ux("1493514789931-586cb221d7a7"), priceCents: 1200, views: 19840, downloads: 1410 },
  { id: "d7",  title: "Phoenix Bloom",         creator: "Iris Vohr",    genre: "Magic Photos",   emoji: "✨", thumb: monthlyWinnerArt, priceCents: 900,  views: 28031, downloads: 1980 },
  { id: "d8",  title: "Glass Garden",          creator: "Theo Rask",    genre: "Magic Photos",   emoji: "✨", thumb: ux("1465146344425-f00d5f5c8f07"), priceCents: 700,  views: 17230, downloads: 1190 },
  { id: "d9",  title: "The Gilded Comet",      creator: "Nyx Rivers",   genre: "Stories",        emoji: "📖", thumb: monthlyWinnerStory, priceCents: 900,  views: 21040, downloads: 1820 },
  { id: "d10", title: "Hymn of the Wolf",      creator: "Sable Quinn",  genre: "Stories",        emoji: "📖", thumb: ux("1448375240586-882707db888b"), priceCents: 800,  views: 15610, downloads: 1240 },
  { id: "d11", title: "Soft Static",           creator: "Eden Roux",    genre: "Living Avatars", emoji: "🌀", thumb: ux("1517841905240-472988babdf9"), priceCents: 500,  views: 19833, downloads: 1320 },
  { id: "d12", title: "Glass Idol",            creator: "Mako Kira",    genre: "Living Avatars", emoji: "🌀", thumb: ux("1521119989659-a83eee488004"), priceCents: 500,  views: 15422, downloads: 1010 },
  { id: "d13", title: "Halo Coffee",           creator: "Jules Aren",   genre: "Brand & Logo",   emoji: "🎨", thumb: ux("1495474472287-4d71bcdd2085"), priceCents: 1500, views: 14220, downloads: 1620 },
  { id: "d14", title: "North & Pine",          creator: "Petra Cole",   genre: "Brand & Logo",   emoji: "🎨", thumb: ux("1441986300917-64674bd600d8"), priceCents: 1200, views: 9241,  downloads: 1080 },
  { id: "d15", title: "Pocket Habit Tracker",  creator: "Ren Iwata",    genre: "Apps",           emoji: "📱", thumb: monthlyWinnerApp, priceCents: 1900, views: 8412,  downloads: 510 },
  { id: "d16", title: "Lunar Creation Kit",    creator: "Vega Kade",    genre: "Other",          emoji: "🌐", thumb: monthlyWinnerGeneral, priceCents: 2200, views: 24380, downloads: 1320 },
];

// Map demo genre → (source_page, kind, media_type) so demo items
// route through the same grouping/filtering as real publishes.
const DEMO_TO_SOURCE: Record<string, { source_page: string; kind: "media" | "gif" | "movie"; media_type: string }> = {
  Photography:     { source_page: "photography-hub", kind: "media", media_type: "image" },
  Avatars:         { source_page: "avatar-generator", kind: "media", media_type: "image" },
  Movies:          { source_page: "movie-studio",    kind: "movie", media_type: "video" },
  "Magic Photos":  { source_page: "magic-hub",       kind: "media", media_type: "image" },
  Stories:         { source_page: "story-writer",    kind: "media", media_type: "image" },
  "Living Avatars":{ source_page: "living-avatars",  kind: "gif",   media_type: "gif"   },
  "Brand & Logo":  { source_page: "photography-hub", kind: "media", media_type: "image" },
  Apps:            { source_page: "app-builder",     kind: "media", media_type: "image" },
  Other:           { source_page: "general-ai",      kind: "media", media_type: "image" },
};

// Add Brand & Logo + Apps to GENRE_MAP so labels show through genreFor()
GENRE_MAP["app-builder"] = { label: "Apps", emoji: "📱" };

const demoAsLibrary = (): PublicLibraryItem[] =>
  DEMO_ITEMS.map((d) => {
    const meta = DEMO_TO_SOURCE[d.genre] ?? { source_page: "photography-hub", kind: "media" as const, media_type: "image" };
    return {
      id: d.id,
      kind: meta.kind,
      user_id: "demo",
      title: d.title,
      url: d.thumb,
      thumbnail_url: d.thumb,
      media_type: meta.media_type,
      created_at: new Date(0).toISOString(),
      shop_enabled: true,
      shop_price_cents: d.priceCents,
      creator_display_name: d.creator,
      download_count: d.downloads,
      view_count: d.views,
      source_page: meta.source_page,
    };
  });

const HomePublicGallery = () => {
  const navigate = useNavigate();
  const { data: realItems = [], isLoading } = usePublicLibrary("all");
  const [activeGenre, setActiveGenre] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "popular" | "price_low" | "price_high">("newest");

  // Always merge demo creations after real ones so the gallery is
  // never sparse — real publishes lead, showcase pieces fill the rest.
  const items = useMemo<PublicLibraryItem[]>(
    () => [...realItems, ...demoAsLibrary()],
    [realItems],
  );

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
    const base = activeGenre === "All" ? items : (grouped.get(activeGenre)?.items ?? []);
    const q = search.trim().toLowerCase();
    let list = q
      ? base.filter(
          (i) =>
            (i.title || "").toLowerCase().includes(q) ||
            (i.creator_display_name || "").toLowerCase().includes(q),
        )
      : base.slice();
    if (sort === "popular") {
      list.sort((a, b) => (b.view_count + b.download_count) - (a.view_count + a.download_count));
    } else if (sort === "price_low") {
      list.sort((a, b) => (a.shop_price_cents || 0) - (b.shop_price_cents || 0));
    } else if (sort === "price_high") {
      list.sort((a, b) => (b.shop_price_cents || 0) - (a.shop_price_cents || 0));
    }
    return list.slice(0, 24);
  }, [activeGenre, items, grouped, search, sort]);

  if (isLoading) {
    return (
      <div className="px-4 mb-4">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-4 text-center text-xs text-muted-foreground">
          Loading creators’ public gallery…
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

        {/* Search + sort */}
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or creator…"
              className="w-full pl-8 pr-7 py-1.5 rounded-full bg-muted/40 border border-border text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {([
              ["newest", "Newest"],
              ["popular", "Popular"],
              ["price_low", "$ ↑"],
              ["price_high", "$ ↓"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition ${
                  sort === k
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
