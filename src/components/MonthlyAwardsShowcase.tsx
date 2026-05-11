import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Crown, Sparkles, ChevronLeft, ChevronRight, Heart, Eye, Download, X, ShoppingBag } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAllUserMedia } from "@/hooks/useAllUserMedia";

/**
 * Monthly Awards Showcase — curated AI-themed categories with this
 * month's winners. Uses real photographic Unsplash imagery for an 8K
 * photo-realistic look. Clicking a winner opens a rich detail dialog
 * showing bio, stats, and a 4-image sample gallery.
 */

type Winner = {
  rank: 1 | 2 | 3;
  name: string;
  handle: string;
  title: string;
  bio: string;
  // Unsplash topic keywords for the hero + gallery thumbnails
  hero: string;       // unsplash photo id
  gallery: string[];  // additional unsplash photo ids
  likes: number;
  views: number;
  downloads: number;
  priceCents?: number;
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  winners: Winner[];
};

// Helper to build an image URL. Accepts either a full http(s) URL (e.g.
// from the user's media library) or an Unsplash photo id fallback.
const ux = (idOrUrl: string, w = 800, h = 800) => {
  if (!idOrUrl) return "";
  if (/^https?:\/\//i.test(idOrUrl)) return idOrUrl;
  return `https://images.unsplash.com/photo-${idOrUrl}?auto=format&fit=crop&w=${w}&h=${h}&q=85`;
};

// Heuristic mapping: which source_page values feed which category
const CATEGORY_SOURCE_HINTS: Record<string, string[]> = {
  "cinematic-portraits": ["avatar", "portrait", "photo", "magic"],
  "story-of-month": ["story"],
  "movie-magic": ["movie", "video"],
  "magic-hub": ["magic", "edit", "photo"],
  "avatar-icons": ["avatar"],
  "living-avatars": ["living", "gif", "avatar"],
  "voice-virtuoso": ["voice"],
  "logo-design": ["logo", "brand", "photography"],
};

const CATEGORIES: Category[] = [
  {
    id: "cinematic-portraits",
    label: "Cinematic Portraits",
    emoji: "📸",
    blurb: "Most jaw-dropping AI portrait of the month",
    winners: [
      { rank: 1, name: "Aurora Vex", handle: "@auroravex", title: "Velvet Saint",
        bio: "Cinematic portrait artist blending Renaissance lighting with futurist couture.",
        hero: "1531746020798-e6953c6e8e04",
        gallery: ["1502823403499-6ccfcf4fb453","1488161628813-04466f872be2","1494790108377-be9c29b29330","1524504388940-b1c1722653e1"],
        likes: 12480, views: 184320, downloads: 920, priceCents: 1200 },
      { rank: 2, name: "Kiyan Mori", handle: "@kiyan.studio", title: "Midnight Monarch",
        bio: "Tokyo-based AI photographer specialising in moody nocturnal portraits.",
        hero: "1506794778202-cad84cf45f1d",
        gallery: ["1500648767791-00dcc994a43e","1506277886164-e25aa3f4ef7f","1521119989659-a83eee488004","1463453091185-61582044d556"],
        likes: 9120, views: 142010, downloads: 612 },
      { rank: 3, name: "Lumi Park", handle: "@lumipark", title: "Bronze Echo",
        bio: "Soft warm tones, sun-drenched faces, organic film grain.",
        hero: "1508214751196-bcfd4ca60f91",
        gallery: ["1517841905240-472988babdf9","1534528741775-53994a69daeb","1502685104226-ee32379fefbe","1531123897727-8f129e1688ce"],
        likes: 7340, views: 98220, downloads: 410 },
    ],
  },
  {
    id: "story-of-month",
    label: "Story of the Month",
    emoji: "📖",
    blurb: "Best AI-illustrated story chapter",
    winners: [
      { rank: 1, name: "Nyx Rivers", handle: "@nyxrivers", title: "The Gilded Comet",
        bio: "Nine chapters of cosmic mystery, fully illustrated in cinematic gold.",
        hero: "1419242902214-272b3f66ee7a",
        gallery: ["1465101046530-73398c7f28ca","1444080748397-f442aa95c3e5","1419242902214-272b3f66ee7a","1502134249126-9f3755a50d78"],
        likes: 14210, views: 210400, downloads: 1820, priceCents: 900 },
      { rank: 2, name: "Sable Quinn", handle: "@sablequinn", title: "Hymn of the Wolf",
        bio: "A folkloric novella with hand-painted forest spreads.",
        hero: "1448375240586-882707db888b",
        gallery: ["1441974231531-c6227db76b6e","1426604966848-d7adac402bff","1500382017468-9049fed747ef","1518495973542-4542c06a5843"],
        likes: 9810, views: 156100, downloads: 1240 },
      { rank: 3, name: "Ren Iwata", handle: "@reniwata", title: "Paper Lanterns",
        bio: "A tender slice-of-life set in a coastal Japanese town.",
        hero: "1528360983277-13d401cdc186",
        gallery: ["1490375991207-94e2b65bfdcf","1545569341-9eb8b30979d9","1493780474015-ba834fd0ce2f","1480796927426-f609979314bd"],
        likes: 7110, views: 102530, downloads: 890 },
    ],
  },
  {
    id: "movie-magic",
    label: "Movie Magic",
    emoji: "🎬",
    blurb: "Top short film created in Movie Studio",
    winners: [
      { rank: 1, name: "Dax Halberg", handle: "@daxfilms", title: "Echoes of Mars",
        bio: "A 4-minute sci-fi short rendered entirely in Oracle Movie Studio.",
        hero: "1451187580459-43490279c0fa",
        gallery: ["1446776811953-b23d57bd21aa","1462331940025-496dfbfc7564","1502134249126-9f3755a50d78","1419242902214-272b3f66ee7a"],
        likes: 18540, views: 320420, downloads: 2410, priceCents: 1500 },
      { rank: 2, name: "Mira Solé", handle: "@mirasole", title: "Last Light",
        bio: "Quiet drama about a coastal lighthouse keeper at the end of an era.",
        hero: "1493514789931-586cb221d7a7",
        gallery: ["1470770841072-f978cf4d019e","1500382017468-9049fed747ef","1465056836041-7f43ac27dcb5","1431794062232-2a99a5431c6c"],
        likes: 11230, views: 198400, downloads: 1410 },
      { rank: 3, name: "Jonas Vrij", handle: "@jonasvrij", title: "After the Rain",
        bio: "Neon-soaked Amsterdam vignette in 90 seconds.",
        hero: "1419242902214-272b3f66ee7a",
        gallery: ["1493514789931-586cb221d7a7","1518972559570-7cc1309f3229","1492684223066-81342ee5ff30","1492684223066-81342ee5ff30"],
        likes: 8420, views: 134220, downloads: 980 },
    ],
  },
  {
    id: "magic-hub",
    label: "Magic Hub",
    emoji: "✨",
    blurb: "Wildest AI photo transformation",
    winners: [
      { rank: 1, name: "Iris Vohr", handle: "@irisvohr", title: "Phoenix Bloom",
        bio: "Self-portrait fused with feathers of fire — Magic Hub remix winner.",
        hero: "1495103033382-fe343886b671",
        gallery: ["1502691876148-a84978e59af8","1531297484001-80022131f5a1","1518770660439-4636190af475","1517242810446-cc8951b2be40"],
        likes: 16210, views: 280310, downloads: 1980 },
      { rank: 2, name: "Theo Rask", handle: "@theorask", title: "Glass Garden",
        bio: "A botanical portrait built from refracted prisms.",
        hero: "1465146344425-f00d5f5c8f07",
        gallery: ["1416879595882-3373a0480b5b","1490750967868-88aa4486c946","1501004318641-b39e6451bec6","1462275646964-a0e3386b89fa"],
        likes: 10840, views: 172300, downloads: 1190 },
      { rank: 3, name: "Coco Ling", handle: "@cocoling", title: "Neon Sakura",
        bio: "Cherry-blossom self-portrait set in cyberpunk Kyoto.",
        hero: "1522383225653-ed111181a951",
        gallery: ["1494790108377-be9c29b29330","1531746020798-e6953c6e8e04","1524504388940-b1c1722653e1","1500648767791-00dcc994a43e"],
        likes: 8120, views: 119450, downloads: 740 },
    ],
  },
  {
    id: "avatar-icons",
    label: "Avatar Icons",
    emoji: "🧑‍🎤",
    blurb: "Most loved 8K avatar of the month",
    winners: [
      { rank: 1, name: "Vega Kade", handle: "@vegakade", title: "Solar Empress",
        bio: "Hyper-real 8K avatar, golden hour, regal pose.",
        hero: "1488426862026-3ee34a7d66df",
        gallery: ["1517841905240-472988babdf9","1534528741775-53994a69daeb","1531746020798-e6953c6e8e04","1502823403499-6ccfcf4fb453"],
        likes: 21320, views: 410220, downloads: 3140, priceCents: 800 },
      { rank: 2, name: "Indra Noor", handle: "@indranoor", title: "Obsidian Knight",
        bio: "Armoured avatar with cinematic dark-key lighting.",
        hero: "1492562080023-ab3db95bfbce",
        gallery: ["1500648767791-00dcc994a43e","1506794778202-cad84cf45f1d","1463453091185-61582044d556","1521119989659-a83eee488004"],
        likes: 14210, views: 256780, downloads: 1820 },
      { rank: 3, name: "Pia Lune", handle: "@pialune", title: "Crystal Muse",
        bio: "Ethereal avatar dressed in shards of light.",
        hero: "1524504388940-b1c1722653e1",
        gallery: ["1488161628813-04466f872be2","1494790108377-be9c29b29330","1502685104226-ee32379fefbe","1531123897727-8f129e1688ce"],
        likes: 9810, views: 148120, downloads: 1140 },
    ],
  },
  {
    id: "living-avatars",
    label: "Living Avatars",
    emoji: "🌀",
    blurb: "Best lip-sync / walking avatar clip",
    winners: [
      { rank: 1, name: "Eden Roux", handle: "@edenroux", title: "Soft Static",
        bio: "Lip-sync clip set to ambient synth — featured on the home reel.",
        hero: "1517841905240-472988babdf9",
        gallery: ["1531746020798-e6953c6e8e04","1488426862026-3ee34a7d66df","1502823403499-6ccfcf4fb453","1494790108377-be9c29b29330"],
        likes: 11920, views: 198330, downloads: 1320 },
      { rank: 2, name: "Mako Kira", handle: "@makokira", title: "Glass Idol",
        bio: "Walking avatar on a holographic runway.",
        hero: "1521119989659-a83eee488004",
        gallery: ["1463453091185-61582044d556","1506794778202-cad84cf45f1d","1500648767791-00dcc994a43e","1531746020798-e6953c6e8e04"],
        likes: 9120, views: 154220, downloads: 1010 },
      { rank: 3, name: "Saoirse Bell", handle: "@saoirse", title: "Lumen Walk",
        bio: "Sun-drenched walking loop in honey-gold tones.",
        hero: "1534528741775-53994a69daeb",
        gallery: ["1488161628813-04466f872be2","1502685104226-ee32379fefbe","1531123897727-8f129e1688ce","1494790108377-be9c29b29330"],
        likes: 6840, views: 99410, downloads: 720 },
    ],
  },
  {
    id: "voice-virtuoso",
    label: "Voice Virtuoso",
    emoji: "🎤",
    blurb: "Top original voice clone of the month",
    winners: [
      { rank: 1, name: "Orin Sable", handle: "@orinsable", title: "Velvet Baritone",
        bio: "Warm, resonant baritone — most-used voice in Story Writer this month.",
        hero: "1493225457124-a3eb161ffa5f",
        gallery: ["1511671782779-c97d3d27a1d4","1485579149621-3123dd979885","1493225457124-a3eb161ffa5f","1470225620780-dba8ba36b745"],
        likes: 8420, views: 124310, downloads: 2410, priceCents: 500 },
      { rank: 2, name: "Nia Voss", handle: "@niavoss", title: "Crystal Soprano",
        bio: "Bright lyric soprano — stand-out in poetic narration.",
        hero: "1485579149621-3123dd979885",
        gallery: ["1470225620780-dba8ba36b745","1511671782779-c97d3d27a1d4","1493225457124-a3eb161ffa5f","1485579149621-3123dd979885"],
        likes: 6210, views: 92110, downloads: 1640 },
      { rank: 3, name: "Brody Lin", handle: "@brodylin", title: "Warm Narrator",
        bio: "Calm documentary narrator with soft American cadence.",
        hero: "1470225620780-dba8ba36b745",
        gallery: ["1493225457124-a3eb161ffa5f","1485579149621-3123dd979885","1470225620780-dba8ba36b745","1511671782779-c97d3d27a1d4"],
        likes: 4820, views: 71220, downloads: 1180 },
    ],
  },
  {
    id: "logo-design",
    label: "Brand & Logo",
    emoji: "🎨",
    blurb: "Best AI-crafted brand identity",
    winners: [
      { rank: 1, name: "Jules Aren", handle: "@julesaren", title: "Halo Coffee",
        bio: "A premium specialty-coffee identity built in Photography Hub.",
        hero: "1495474472287-4d71bcdd2085",
        gallery: ["1442975631115-c4f7b05b8a2c","1497935586351-b67a49e012bf","1494314671902-399b18174975","1453614512568-c4024d13c247"],
        likes: 9120, views: 142200, downloads: 1620, priceCents: 1500 },
      { rank: 2, name: "Petra Cole", handle: "@petracole", title: "North & Pine",
        bio: "Outdoor-apparel brand with hand-engraved monogram.",
        hero: "1441986300917-64674bd600d8",
        gallery: ["1518495973542-4542c06a5843","1441974231531-c6227db76b6e","1500382017468-9049fed747ef","1426604966848-d7adac402bff"],
        likes: 6420, views: 92410, downloads: 1080 },
      { rank: 3, name: "Mateo Diaz", handle: "@mateodiaz", title: "Lumi Studio",
        bio: "Bold luminous mark for an interior-design studio.",
        hero: "1497366216548-37526070297c",
        gallery: ["1503602642458-232111445657","1505761671935-60b3a7427bad","1493663284031-b7e3aefcae8e","1505691938895-1758d7feb511"],
        likes: 4910, views: 71240, downloads: 820 },
    ],
  },
];

const RANK_BG: Record<1 | 2 | 3, string> = {
  1: "from-yellow-300 via-amber-400 to-yellow-600 text-black",
  2: "from-zinc-200 via-zinc-400 to-zinc-500 text-black",
  3: "from-orange-300 via-amber-700 to-orange-900 text-white",
};
const RANK_ICON: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const monthLabel = () =>
  new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

export default function MonthlyAwardsShowcase() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const [openWinner, setOpenWinner] = useState<{ cat: Category; w: Winner } | null>(null);

  // Pull real generated images from the admin / user library and weave them
  // into the curated awards so the gallery always reflects actual creator work.
  const { data: media } = useAllUserMedia();
  const liveCategories = useMemo<Category[]>(() => {
    const imgs = (media || []).filter(
      (m: any) => (m.media_type === "image" || m.media_type === "photo") && !!m.url
    );
    if (imgs.length === 0) return CATEGORIES;

    return CATEGORIES.map((c) => {
      const hints = CATEGORY_SOURCE_HINTS[c.id] || [];
      const matched = imgs.filter((m: any) =>
        hints.some((h) => (m.source_page || "").toLowerCase().includes(h))
      );
      const pool = (matched.length >= 4 ? matched : imgs).slice();
      // Stable shuffle by category id so it doesn't reorder every render
      pool.sort((a: any, b: any) =>
        (a.id + c.id).localeCompare(b.id + c.id)
      );
      let cursor = 0;
      const take = () => {
        const item = pool[cursor % pool.length];
        cursor++;
        return item;
      };
      const winners = c.winners.map((w) => {
        const heroItem = take();
        const gallery = [take(), take(), take(), take()].map(
          (g, i) => (g?.thumbnail_url || g?.url || w.gallery[i])
        );
        return {
          ...w,
          hero: heroItem?.url || w.hero,
          gallery,
        };
      }) as [Winner, Winner, Winner];
      return { ...c, winners };
    });
  }, [media]);

  const cat = liveCategories[activeIdx];

  return (
    <section className="px-4 mb-4" aria-label="Monthly creator awards">
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-card/60 to-background backdrop-blur-sm">
        <header className="px-4 py-3 flex items-center justify-between border-b border-amber-500/20">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent truncate">
                Monthly Creator Awards
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">
                {monthLabel()} winners across every studio
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/public-library")}
            className="text-[11px] px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition shrink-0"
          >
            View all
          </button>
        </header>

        {/* Category bubbles */}
        <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {CATEGORIES.map((c, i) => {
            const active = i === activeIdx;
            return (
              <button
                key={c.id}
                onClick={() => setActiveIdx(i)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition border ${
                  active
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.5)]"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
                }`}
              >
                <span>{c.emoji}</span>
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-4 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="italic">{cat.blurb}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setActiveIdx((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length)}
              className="p-1 rounded-full hover:bg-muted/60" aria-label="Previous category">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setActiveIdx((i) => (i + 1) % CATEGORIES.length)}
              className="p-1 rounded-full hover:bg-muted/60" aria-label="Next category">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3D photo-realistic podium */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 p-3 perspective-[1200px]">
          {cat.winners.map((w) => (
            <button
              key={w.rank}
              onClick={() => setOpenWinner({ cat, w })}
              className={`group relative rounded-xl overflow-hidden text-left transform-gpu transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.04] ${
                w.rank === 1 ? "ring-1 ring-amber-300/70" : "ring-1 ring-border"
              }`}
              style={{
                boxShadow: w.rank === 1
                  ? "0 12px 30px -8px hsl(45 100% 45% / 0.55), 0 4px 10px -2px rgba(0,0,0,0.6), inset 0 0 0 1px hsl(45 100% 60% / 0.4)"
                  : "0 8px 22px -10px rgba(0,0,0,0.7), 0 2px 6px -2px rgba(0,0,0,0.5)",
                transform: "perspective(1200px) rotateX(2deg)",
              }}
            >
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={ux(w.hero, 600, 600)}
                  alt={`${w.title} — by ${w.name}`}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                {/* Cinematic gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                {/* Gold rim light */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
                {/* Holographic shimmer */}
                <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
                  style={{
                    background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
                    backgroundSize: "250% 250%",
                    animation: "awardShimmer 5s ease-in-out infinite",
                  }} />
                {/* Rank medallion */}
                <div className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r ${RANK_BG[w.rank]} shadow-md`}>
                  <span>{RANK_ICON[w.rank]}</span><span>#{w.rank}</span>
                </div>
                {w.rank === 1 && (
                  <Crown className="absolute top-1.5 right-1.5 w-4 h-4 text-amber-200 drop-shadow" />
                )}
                {/* Bottom caption */}
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <p className="text-[11px] sm:text-xs font-bold text-white line-clamp-1 drop-shadow">{w.title}</p>
                  <p className="text-[9px] sm:text-[10px] text-white/75 line-clamp-1">{w.name} · {w.handle}</p>
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-white/80">
                    <span className="inline-flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{formatCount(w.likes)}</span>
                    <span className="inline-flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{formatCount(w.views)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 pb-3 flex items-center justify-center gap-1.5 text-[10px] text-amber-300/80">
          <Sparkles className="w-3 h-3" />
          <span>Tap any winner to see their full story</span>
        </div>
      </div>

      {/* ── Winner Detail Dialog ── */}
      <Dialog open={!!openWinner} onOpenChange={(o) => !o && setOpenWinner(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-gradient-to-b from-card via-background to-background border-amber-500/40">
          {openWinner && (
            <div className="relative">
              {/* Hero */}
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                <img
                  src={ux(openWinner.w.hero, 1600, 900)}
                  alt={openWinner.w.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <button
                  onClick={() => setOpenWinner(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-gradient-to-r ${RANK_BG[openWinner.w.rank]} shadow-lg`}>
                    {RANK_ICON[openWinner.w.rank]} #{openWinner.w.rank}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/60 text-amber-200 border border-amber-400/40">
                    {openWinner.cat.emoji} {openWinner.cat.label}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-2xl sm:text-3xl font-black text-amber-200 drop-shadow-lg" style={{ fontFamily: "'Cinzel',serif" }}>
                    {openWinner.w.title}
                  </h3>
                  <p className="text-sm text-white/85">by <span className="font-semibold">{openWinner.w.name}</span> · {openWinner.w.handle}</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                <p className="text-sm text-foreground leading-relaxed">{openWinner.w.bio}</p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Heart, label: "Likes", value: openWinner.w.likes },
                    { icon: Eye, label: "Views", value: openWinner.w.views },
                    { icon: Download, label: "Downloads", value: openWinner.w.downloads },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-border bg-muted/30 p-2 text-center">
                      <Icon className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                      <div className="text-sm font-bold text-foreground">{formatCount(value)}</div>
                      <div className="text-[10px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Sample gallery */}
                <div>
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide mb-2">Sample creations</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {openWinner.w.gallery.map((g, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={ux(g, 400, 400)} alt={`${openWinner.w.title} sample ${i+1}`} loading="lazy"
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {openWinner.w.priceCents && openWinner.w.priceCents > 0 && (
                    <button
                      onClick={() => navigate("/public-library")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-yellow-300 hover:scale-105 transition"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      Buy for ${(openWinner.w.priceCents / 100).toFixed(2)}
                    </button>
                  )}
                  <button
                    onClick={() => navigate("/public-library")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border border-amber-400/40 text-amber-200 hover:bg-amber-400/10 transition"
                  >
                    Open in Public Library
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes awardShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </section>
  );
}
