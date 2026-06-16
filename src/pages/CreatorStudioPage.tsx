// CreatorStudioPage — YouTube-Studio style dashboard hub for creators.
// Four distinct, visually unique deep-link cards (no generic repeated tiles)
// that drop the user into a dedicated workspace for each discipline.
import { useNavigate } from "react-router-dom";
import { Camera, Clapperboard, Palette, Mic2, ArrowRight, Sparkles } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import SEO from "@/components/SEO";

interface StudioCard {
  key: string;
  title: string;
  tagline: string;
  bullets: string[];
  cta: string;
  to: string;
  Icon: typeof Camera;
  /** Tailwind gradient classes for the hero strip */
  gradient: string;
  /** Accent color class for icon + chips */
  accent: string;
  /** Decorative emoji shown big in the corner */
  glyph: string;
}

const CARDS: StudioCard[] = [
  {
    key: "photo",
    title: "Photo Studio",
    tagline: "8K AI photography, headshots, products & brand visuals.",
    bullets: ["Generate from text", "Edit your photos", "Up to 8K upscale"],
    cta: "Open Photo Studio",
    to: "/photography-hub",
    Icon: Camera,
    gradient: "from-amber-500/30 via-orange-500/15 to-transparent",
    accent: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    glyph: "📸",
  },
  {
    key: "video",
    title: "Movie & Video Studio",
    tagline: "Full AI movie pipeline — script → scenes → final cut.",
    bullets: ["Cinematic scenes", "Character bible", "1080p / 4K / 8K render"],
    cta: "Open Movie Studio",
    to: "/movie-studio-pro",
    Icon: Clapperboard,
    gradient: "from-fuchsia-500/30 via-purple-500/15 to-transparent",
    accent: "text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10",
    glyph: "🎬",
  },
  {
    key: "brand",
    title: "Brand Kit",
    tagline: "Logo, colors, fonts, watermarks — your channel identity.",
    bullets: ["AI logo generator", "Brand colors & fonts", "Auto-watermark exports"],
    cta: "Open Brand Kit",
    to: "/photography-hub?tool=brand",
    Icon: Palette,
    gradient: "from-cyan-500/30 via-sky-500/15 to-transparent",
    accent: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
    glyph: "🎨",
  },
  {
    key: "voice",
    title: "Voice & Audio",
    tagline: "Voice-overs, cloning, music & SFX in 32+ languages.",
    bullets: ["120+ voices", "Clone your voice", "Royalty-free music"],
    cta: "Open Voice Studio",
    to: "/voice-studio",
    Icon: Mic2,
    gradient: "from-emerald-500/30 via-teal-500/15 to-transparent",
    accent: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    glyph: "🎙️",
  },
];

const CreatorStudioPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Creator Studio — Oracle Lunar"
        description="A full YouTube-style creator studio: photo, video, brand and voice — all in one place."
      />
      <UniversalBackButton />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 sm:mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>YouTube Producers · All-In-One</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight bg-gradient-to-br from-amber-200 via-foreground to-cyan-200 bg-clip-text text-transparent">
            Creator Studio
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Pick a workspace. Each one is a real studio — not a folder of generic tiles.
          </p>
        </header>

        {/* Four distinct hero cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CARDS.map((c) => (
            <button
              key={c.key}
              onClick={() => navigate(c.to)}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card text-left transition-all hover:border-amber-500/50 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-amber-500/10"
            >
              {/* Gradient hero strip */}
              <div className={`relative h-28 sm:h-32 bg-gradient-to-br ${c.gradient}`}>
                <span
                  aria-hidden
                  className="absolute right-3 bottom-1 text-7xl sm:text-8xl opacity-30 group-hover:opacity-50 transition-opacity select-none"
                >
                  {c.glyph}
                </span>
                <div className={`absolute top-3 left-3 inline-flex items-center justify-center w-11 h-11 rounded-xl border ${c.accent}`}>
                  <c.Icon className="w-5 h-5" />
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">{c.title}</h2>
                <p className="text-sm text-muted-foreground mt-1">{c.tagline}</p>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {c.bullets.map((b) => (
                    <li
                      key={b}
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${c.accent}`}
                    >
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300 group-hover:gap-2.5 transition-all">
                  {c.cta}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground/70 mt-8">
          Everything you create is auto-saved to your Media Library.
        </p>
      </div>
    </div>
  );
};

export default CreatorStudioPage;
