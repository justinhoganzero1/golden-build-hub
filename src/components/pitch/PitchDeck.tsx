import type { DeckSlide } from "@/lib/pitchMachine";

const KIND_TONE: Record<string, string> = {
  title: "from-primary/30 via-card/80 to-accent-blue/20",
  problem: "from-destructive/20 via-card/80 to-card/60",
  next: "from-primary/25 via-card/80 to-primary/10",
};

/** Glossy slide deck used by the owner preview and the public demo page. */
export default function PitchDeck({ slides, businessName, currentSiteImage }: { slides: DeckSlide[]; businessName?: string | null; currentSiteImage?: string | null }) {
  if (!slides?.length) return null;
  return (
    <div className="space-y-4">
      {slides.map((s, i) => (
        <section
          key={i}
          className={`relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br ${KIND_TONE[s.kind] || "from-card/90 via-card/70 to-accent-blue/10"} p-6 sm:p-10 shadow-[0_20px_60px_-20px_hsl(var(--gold)/0.35)] backdrop-blur-xl`}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/80">
            {i === 0 ? "Proposal" : `${String(i).padStart(2, "0")}`} {businessName && i === 0 ? `· ${businessName}` : ""}
          </p>
          <h2 className={`mt-2 font-bold text-foreground ${i === 0 ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>{s.title}</h2>
          {s.subtitle && <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">{s.subtitle}</p>}
          {s.kind === "problem" && currentSiteImage && (
            <img src={currentSiteImage} alt="Your current website" className="mt-5 w-full max-w-xl rounded-xl border border-border/60 opacity-90" loading="lazy" />
          )}
          {s.quote && (
            <blockquote className="mt-5 border-l-2 border-primary pl-4 text-base italic text-foreground/90">“{s.quote}”</blockquote>
          )}
          {s.bullets.length > 0 && (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {s.bullets.map((b, j) => (
                <li key={j} className="flex gap-3 rounded-2xl border border-border/50 bg-background/40 p-3 text-sm text-foreground/90">
                  <span className="mt-0.5 h-2 w-2 flex-none rounded-full bg-primary shadow-[0_0_10px_hsl(var(--gold))]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
