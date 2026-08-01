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
                    <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/75 via-black/40 to-transparent">
                      <h3 className="text-white font-black uppercase leading-tight tracking-tight text-center text-[clamp(0.85rem,3.4vw,1.6rem)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        {title || "Your Title Here"}
                      </h3>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                      <p className="text-white/95 text-center font-semibold tracking-[0.18em] uppercase text-[clamp(0.55rem,1.9vw,0.9rem)] drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                        {author || "Author Name"}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <div className="w-full max-h-[88%] overflow-y-auto rounded-lg bg-black/62 backdrop-blur-[3px] border border-white/20 px-3 py-3 shadow-2xl">
                      <p className="text-white text-[clamp(0.55rem,1.55vw,0.78rem)] leading-relaxed whitespace-pre-wrap">
                        {blurb?.trim() || "Write your blurb above — it appears here in full, perfectly readable, on the back cover."}
                      </p>
                      <p className="mt-2 pt-2 border-t border-white/20 text-white/80 text-[10px] uppercase tracking-[0.16em] text-center">
                        {author || "Author Name"}
                      </p>
                    </div>
                  </div>
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
