import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Crown, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Monthly Awards Showcase — curated, AI-themed categories with this
 * month's top winners. Always renders (uses seed winners when the public
 * library is empty) so the dashboard never feels barren.
 */

type Winner = {
  rank: 1 | 2 | 3;
  name: string;
  handle: string;
  title: string;
  // Tailwind gradient classes used to render a stylish thumbnail tile
  gradient: string;
  glyph: string; // emoji glyph as decorative subject
};

type Category = {
  id: string;
  label: string;
  emoji: string;
  blurb: string;
  winners: Winner[];
};

const CATEGORIES: Category[] = [
  {
    id: "cinematic-portraits",
    label: "Cinematic Portraits",
    emoji: "📸",
    blurb: "Most jaw-dropping AI portrait of the month",
    winners: [
      { rank: 1, name: "Aurora Vex",   handle: "@auroravex",   title: "Velvet Saint",        gradient: "from-amber-400 via-rose-500 to-fuchsia-700",  glyph: "👑" },
      { rank: 2, name: "Kiyan Mori",   handle: "@kiyan.studio", title: "Midnight Monarch",    gradient: "from-sky-400 via-indigo-500 to-purple-800",   glyph: "🌙" },
      { rank: 3, name: "Lumi Park",    handle: "@lumipark",    title: "Bronze Echo",          gradient: "from-orange-400 via-amber-600 to-stone-800",  glyph: "✨" },
    ],
  },
  {
    id: "story-of-month",
    label: "Story of the Month",
    emoji: "📖",
    blurb: "Best AI-illustrated story chapter",
    winners: [
      { rank: 1, name: "Nyx Rivers",   handle: "@nyxrivers",   title: "The Gilded Comet",     gradient: "from-yellow-300 via-amber-500 to-rose-600",   glyph: "🌠" },
      { rank: 2, name: "Sable Quinn",  handle: "@sablequinn",  title: "Hymn of the Wolf",     gradient: "from-emerald-400 via-teal-600 to-slate-800",  glyph: "🐺" },
      { rank: 3, name: "Ren Iwata",    handle: "@reniwata",    title: "Paper Lanterns",       gradient: "from-pink-300 via-fuchsia-500 to-violet-700", glyph: "🏮" },
    ],
  },
  {
    id: "movie-magic",
    label: "Movie Magic",
    emoji: "🎬",
    blurb: "Top short film created in Movie Studio",
    winners: [
      { rank: 1, name: "Dax Halberg",  handle: "@daxfilms",    title: "Echoes of Mars",       gradient: "from-red-500 via-orange-600 to-amber-700",    glyph: "🚀" },
      { rank: 2, name: "Mira Solé",    handle: "@mirasole",    title: "Last Light",           gradient: "from-blue-400 via-cyan-500 to-teal-700",      glyph: "🎞️" },
      { rank: 3, name: "Jonas Vrij",   handle: "@jonasvrij",   title: "After the Rain",       gradient: "from-zinc-400 via-slate-600 to-stone-800",    glyph: "🌧️" },
    ],
  },
  {
    id: "magic-hub",
    label: "Magic Hub",
    emoji: "✨",
    blurb: "Wildest AI photo transformation",
    winners: [
      { rank: 1, name: "Iris Vohr",    handle: "@irisvohr",    title: "Phoenix Bloom",        gradient: "from-rose-400 via-red-500 to-amber-500",      glyph: "🔥" },
      { rank: 2, name: "Theo Rask",    handle: "@theorask",    title: "Glass Garden",         gradient: "from-emerald-300 via-cyan-500 to-sky-700",    glyph: "🪞" },
      { rank: 3, name: "Coco Ling",    handle: "@cocoling",    title: "Neon Sakura",          gradient: "from-pink-400 via-fuchsia-500 to-purple-600", glyph: "🌸" },
    ],
  },
  {
    id: "avatar-icons",
    label: "Avatar Icons",
    emoji: "🧑‍🎤",
    blurb: "Most loved 8K avatar of the month",
    winners: [
      { rank: 1, name: "Vega Kade",    handle: "@vegakade",    title: "Solar Empress",        gradient: "from-amber-300 via-yellow-500 to-orange-700", glyph: "☀️" },
      { rank: 2, name: "Indra Noor",   handle: "@indranoor",   title: "Obsidian Knight",      gradient: "from-slate-400 via-zinc-700 to-black",        glyph: "🛡️" },
      { rank: 3, name: "Pia Lune",     handle: "@pialune",     title: "Crystal Muse",         gradient: "from-violet-300 via-indigo-500 to-blue-800",  glyph: "💎" },
    ],
  },
  {
    id: "living-avatars",
    label: "Living Avatars",
    emoji: "🌀",
    blurb: "Best lip-sync / walking avatar clip",
    winners: [
      { rank: 1, name: "Eden Roux",    handle: "@edenroux",    title: "Soft Static",          gradient: "from-cyan-300 via-blue-500 to-indigo-800",    glyph: "💫" },
      { rank: 2, name: "Mako Kira",    handle: "@makokira",    title: "Glass Idol",           gradient: "from-fuchsia-400 via-purple-600 to-indigo-900",glyph: "🪩" },
      { rank: 3, name: "Saoirse Bell", handle: "@saoirse",     title: "Lumen Walk",           gradient: "from-yellow-200 via-amber-400 to-rose-500",   glyph: "🚶" },
    ],
  },
  {
    id: "voice-virtuoso",
    label: "Voice Virtuoso",
    emoji: "🎤",
    blurb: "Top original voice clone of the month",
    winners: [
      { rank: 1, name: "Orin Sable",   handle: "@orinsable",   title: "Velvet Baritone",      gradient: "from-amber-500 via-orange-700 to-red-900",    glyph: "🎙️" },
      { rank: 2, name: "Nia Voss",     handle: "@niavoss",     title: "Crystal Soprano",      gradient: "from-sky-300 via-indigo-400 to-purple-700",   glyph: "🎶" },
      { rank: 3, name: "Brody Lin",    handle: "@brodylin",    title: "Warm Narrator",        gradient: "from-amber-200 via-yellow-500 to-amber-700",  glyph: "📻" },
    ],
  },
  {
    id: "logo-design",
    label: "Brand & Logo",
    emoji: "🎨",
    blurb: "Best AI-crafted brand identity",
    winners: [
      { rank: 1, name: "Jules Aren",   handle: "@julesaren",   title: "Halo Coffee",          gradient: "from-amber-300 via-orange-500 to-amber-800",  glyph: "☕" },
      { rank: 2, name: "Petra Cole",   handle: "@petracole",   title: "North & Pine",         gradient: "from-emerald-300 via-green-600 to-emerald-900",glyph: "🌲" },
      { rank: 3, name: "Mateo Diaz",   handle: "@mateodiaz",   title: "Lumi Studio",          gradient: "from-violet-300 via-fuchsia-500 to-pink-700", glyph: "💡" },
    ],
  },
];

const RANK_COLORS: Record<1 | 2 | 3, string> = {
  1: "from-yellow-300 via-amber-400 to-yellow-600 text-black",
  2: "from-zinc-200 via-zinc-400 to-zinc-500 text-black",
  3: "from-orange-300 via-amber-700 to-orange-900 text-white",
};

const RANK_ICON: Record<1 | 2 | 3, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const monthLabel = () =>
  new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

export default function MonthlyAwardsShowcase() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const cat = CATEGORIES[activeIdx];

  return (
    <section className="px-4 mb-4" aria-label="Monthly creator awards">
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-card/60 to-background backdrop-blur-sm">
        {/* Header */}
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

        {/* Category blurb + nav */}
        <div className="px-4 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="italic">{cat.blurb}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveIdx((i) => (i - 1 + CATEGORIES.length) % CATEGORIES.length)}
              className="p-1 rounded-full hover:bg-muted/60"
              aria-label="Previous category"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveIdx((i) => (i + 1) % CATEGORIES.length)}
              className="p-1 rounded-full hover:bg-muted/60"
              aria-label="Next category"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Winners podium grid */}
        <div className="grid grid-cols-3 gap-2 p-3">
          {cat.winners.map((w) => (
            <article
              key={w.rank}
              className={`group relative rounded-xl overflow-hidden border ${
                w.rank === 1
                  ? "border-amber-400/70 shadow-[0_0_18px_rgba(245,158,11,0.35)]"
                  : "border-border"
              } bg-card/50`}
            >
              {/* Thumb */}
              <div className={`relative aspect-square bg-gradient-to-br ${w.gradient} overflow-hidden`}>
                <div className="absolute inset-0 grid place-items-center text-5xl sm:text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-500">
                  {w.glyph}
                </div>
                {/* Holographic shimmer */}
                <div
                  className="absolute inset-0 opacity-40 mix-blend-overlay"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
                    backgroundSize: "250% 250%",
                    animation: "awardShimmer 4s ease-in-out infinite",
                  }}
                />
                {/* Rank medallion */}
                <div
                  className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r ${RANK_COLORS[w.rank]} shadow`}
                >
                  <span>{RANK_ICON[w.rank]}</span>
                  <span>#{w.rank}</span>
                </div>
                {w.rank === 1 && (
                  <Crown className="absolute top-1.5 right-1.5 w-4 h-4 text-amber-200 drop-shadow" />
                )}
              </div>
              {/* Caption */}
              <div className="p-2">
                <p className="text-[11px] font-bold text-foreground line-clamp-1">{w.title}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{w.name} · {w.handle}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="px-4 pb-3 flex items-center justify-center gap-1.5 text-[10px] text-amber-300/80">
          <Sparkles className="w-3 h-3" />
          <span>Winners are featured across the app for the full month</span>
        </div>
      </div>

      <style>{`
        @keyframes awardShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>
    </section>
  );
}
