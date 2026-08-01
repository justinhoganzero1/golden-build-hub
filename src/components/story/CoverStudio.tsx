import { Loader2, Sparkles, ImageIcon, X, Eraser, BookMarked } from "lucide-react";
import { SignedImage } from "@/components/SignedMedia";

/**
 * Cover Studio — the FINAL illustration step of Story Writer.
 *
 * The image AI only ever paints *pure background artwork* (no titles, no
 * blurbs, no lettering of any kind — models render text badly). Every word you
 * see on the covers below is real HTML/CSS laid over the artwork, so the title,
 * author and blurb are always crisp, correctly spelled and guaranteed present.
 */
export interface CoverStudioProps {
  title: string;
  author: string;
  blurb: string;
  genre: string;
  coverImage?: string;
  backImage?: string;
  busy: string | null;
  prompt: string;
  onPromptChange: (v: string) => void;
  onGenerateBoth: () => void;
  onGenerateSlot: (slot: "cover" | "back") => void;
  onClearSlot: (slot: "cover" | "back") => void;
  onPickSlot: (slot: "cover" | "back") => void;
  storyWordCount: number;
}

export default function CoverStudio({
  title, author, blurb, genre, coverImage, backImage, busy,
  prompt, onPromptChange, onGenerateBoth, onGenerateSlot, onClearSlot, onPickSlot,
  storyWordCount,
}: CoverStudioProps) {
  const anyBusy = !!busy;
  const ready = storyWordCount > 200;

  return (
    <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-3 space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
          <BookMarked className="w-4 h-4" /> Cover Studio — do this last
        </h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          One AI box for both covers. It reads your <b>entire finished story</b> plus the blurb
          and paints pure 3D 4K ultra-realistic artwork — <b>no text is ever painted into the
          picture</b>. Your title, author name and full blurb are laid over the art as real,
          perfectly readable text.
        </p>
      </header>

      {!ready && (
        <p className="text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-amber-200">
          Write the story first — covers come last so the art can be baked from the whole book.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Cover art direction (optional)
          </label>
          <button
            type="button"
            onClick={() => onPromptChange("")}
            disabled={!prompt}
            className="text-[10px] px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1"
          >
            <Eraser className="w-3 h-3" /> Clear
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          rows={3}
          placeholder={`Anything extra the cover artist should know — hero's look, location, weather, palette… (leave empty and the AI reads the whole ${genre || "story"} itself)`}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y"
        />
      </div>

      <button
        type="button"
        onClick={onGenerateBoth}
        disabled={anyBusy}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-primary/20"
      >
        {anyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {anyBusy ? "Baking cover artwork from your whole story…" : "▶ Bake Front + Back Covers from the Whole Story"}
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["cover", "back"] as const).map(slot => {
          const url = slot === "cover" ? coverImage : backImage;
          const isBusy = busy === slot;
          const label = slot === "cover" ? "Front Cover" : "Back Cover";
          return (
            <div key={slot} className="rounded-xl border border-border bg-card overflow-hidden">
              <p className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${slot === "cover" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-500"}`}>
                {label} preview
              </p>

              <div className="relative aspect-[2/3] bg-muted/30 overflow-hidden">
                {url ? (
                  <SignedImage src={url} alt={`${label} artwork`} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isBusy
                      ? <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                      : <ImageIcon className="w-8 h-8 text-muted-foreground/40" />}
                  </div>
                )}

                {/* ── Real HTML/CSS type, never painted by the model ── */}
                {slot === "cover" ? (
                  <>
                    {/* Top: series/genre rule + big title */}
                    <div className="absolute inset-x-0 top-0 px-4 pt-4 pb-10 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
                      {genre && (
                        <p className="text-center text-amber-300/90 text-[clamp(0.4rem,1.1vw,0.6rem)] font-semibold uppercase tracking-[0.42em] mb-1.5">
                          {genre}
                        </p>
                      )}
                      <div className="mx-auto mb-2 h-px w-2/3 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
                      <h3
                        className="text-center font-black uppercase leading-[0.92] tracking-[-0.01em] text-[clamp(1rem,4.6vw,2.3rem)]"
                        style={{
                          backgroundImage: "linear-gradient(180deg,#fff7e0 0%,#ffd77a 48%,#c9962f 100%)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                          filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.95)) drop-shadow(0 0 1px rgba(0,0,0,0.9))",
                        }}
                      >
                        {title || "Your Title Here"}
                      </h3>
                      <div className="mx-auto mt-2 h-px w-1/3 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
                    </div>

                    {/* Bottom: author footer */}
                    <div className="absolute inset-x-0 bottom-0 px-4 pt-12 pb-4 bg-gradient-to-t from-black/92 via-black/55 to-transparent">
                      <p className="text-center text-white/60 text-[clamp(0.38rem,1vw,0.55rem)] uppercase tracking-[0.4em] mb-1">
                        A novel by
                      </p>
                      <p className="text-white text-center font-bold tracking-[0.22em] uppercase text-[clamp(0.6rem,2.2vw,1.05rem)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                        {author || "Author Name"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Back: title band at top */}
                    <div className="absolute inset-x-0 top-0 px-4 pt-3 pb-8 bg-gradient-to-b from-black/90 via-black/55 to-transparent">
                      <h3
                        className="text-center font-black uppercase leading-[0.95] tracking-tight text-[clamp(0.7rem,3vw,1.4rem)]"
                        style={{
                          backgroundImage: "linear-gradient(180deg,#fff7e0 0%,#ffd77a 50%,#c9962f 100%)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                          filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.95))",
                        }}
                      >
                        {title || "Your Title Here"}
                      </h3>
                      <div className="mx-auto mt-1.5 h-px w-1/2 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
                    </div>

                    {/* Back: blurb card */}
                    <div className="absolute inset-x-0 top-[22%] bottom-[16%] flex items-center justify-center px-3">
                      <div className="w-full max-h-full overflow-y-auto rounded-xl bg-black/72 backdrop-blur-[4px] border border-amber-300/30 px-3.5 py-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
                        <p className="text-white/95 text-[clamp(0.5rem,1.6vw,0.8rem)] leading-relaxed whitespace-pre-wrap first-letter:text-[1.9em] first-letter:font-black first-letter:text-amber-300 first-letter:float-left first-letter:mr-1.5 first-letter:leading-[0.85]">
                          {blurb?.trim() || "Write your blurb above — it appears here in full, perfectly readable, on the back cover."}
                        </p>
                      </div>
                    </div>

                    {/* Back: author footer */}
                    <div className="absolute inset-x-0 bottom-0 px-4 pt-10 pb-4 bg-gradient-to-t from-black/92 via-black/55 to-transparent">
                      <p className="text-white text-center font-bold tracking-[0.22em] uppercase text-[clamp(0.55rem,2vw,0.95rem)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                        {author || "Author Name"}
                      </p>
                    </div>
                  </>
                )}


                {url && (
                  <button
                    onClick={() => onClearSlot(slot)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center z-10"
                    aria-label={`Remove ${label} artwork`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={() => onGenerateSlot(slot)}
                disabled={anyBusy}
                className="w-full py-2 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {url ? `Re-bake ${label} artwork` : `Bake ${label} artwork`}
              </button>
              <button
                onClick={() => onPickSlot(slot)}
                className="w-full py-2 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 border-t border-border flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-3 h-3" /> Library / device
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
