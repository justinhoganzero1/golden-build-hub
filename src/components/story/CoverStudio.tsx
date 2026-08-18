import { useMemo, useState } from "react";
import { Loader2, Sparkles, ImageIcon, X, Eraser, BookMarked, Users, RefreshCw, Download, Share2 } from "lucide-react";
import { SignedImage } from "@/components/SignedMedia";
import { Button } from "@/components/ui/button";
import { bakeCoverText, type BakeTextOptions } from "@/lib/bakeCoverText";
import { toast } from "sonner";

/**
 * Cover Studio — the FINAL illustration step of Story Writer.
 *
 * The image AI only ever paints *pure background artwork* (no titles, no
 * blurbs, no lettering of any kind — models render text badly). Every word you
 * see on the covers below is real HTML/CSS laid over the artwork, so the title,
 * author and blurb are always crisp, correctly spelled and guaranteed present.
 *
 * A team of AI agents (casting, art direction, copywriter, critic, lead) can
 * design both covers and write the back-cover blurb straight from the finished
 * book, so no two books ever get the same generic cover.
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
  frontDirection?: string;
  backDirection?: string;
  onGenerateBoth: () => void;
  onGenerateSlot: (slot: "cover" | "back") => void;
  onClearSlot: (slot: "cover" | "back") => void;
  onPickSlot: (slot: "cover" | "back") => void;
  storyWordCount: number;
  /** Live status line while the cover agent swarm is running. */
  swarmBusy?: string | null;
  /** Launch the cover agent swarm. */
  onRunSwarm?: () => void;
}

export default function CoverStudio({
  title, author, blurb, genre, coverImage, backImage, busy,
  prompt, onPromptChange, frontDirection, backDirection,
  onGenerateBoth, onGenerateSlot, onClearSlot, onPickSlot,
  storyWordCount, swarmBusy, onRunSwarm,
}: CoverStudioProps) {
  const anyBusy = !!busy || !!swarmBusy;
  const ready = storyWordCount > 200;
  const [exportBusy, setExportBusy] = useState<"download" | "share" | null>(null);
  const layout = useMemo<BakeTextOptions["layout"]>(() => {
    const choices: NonNullable<BakeTextOptions["layout"]>[] = ["masthead", "title-author", "cinematic", "editorial"];
    const seed = `${title}|${genre}`.split("").reduce((n, char) => ((n * 31) + char.charCodeAt(0)) >>> 0, 7);
    return choices[seed % choices.length];
  }, [title, genre]);
  const authorBelowTitle = layout === "title-author" || layout === "editorial";

  const dataUrlToFile = async (dataUrl: string, name: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: "image/jpeg" });
  };

  const buildRetailFiles = async () => {
    if (!coverImage || !backImage) throw new Error("Build both covers first");
    const common = { title, author, genre, width: 1875, height: 2775, layout } as const;
    const [front, back] = await Promise.all([
      bakeCoverText(coverImage, { ...common, slot: "cover" }),
      bakeCoverText(backImage, { ...common, slot: "back", blurb }),
    ]);
    const safe = (title || "book").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return Promise.all([
      dataUrlToFile(front, `${safe}-front-print-6x9-bleed.jpg`),
      dataUrlToFile(back, `${safe}-back-print-6x9-bleed.jpg`),
    ]);
  };

  const downloadRetailFiles = async () => {
    setExportBusy("download");
    try {
      const files = await buildRetailFiles();
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      });
      toast.success("Print-ready front and rear covers downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cover export failed");
    } finally { setExportBusy(null); }
  };

  const shareRetailFiles = async () => {
    setExportBusy("share");
    try {
      const files = await buildRetailFiles();
      if (navigator.canShare?.({ files })) {
        await navigator.share({ files, title: `${title} covers`, text: "Print-ready front and rear book covers" });
      } else {
        throw new Error("File sharing is unavailable here — use Download instead");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Cover sharing failed");
    } finally { setExportBusy(null); }
  };


  return (
    <section className="border-y border-primary/40 bg-card/40 py-4 space-y-4">
      <header className="px-3 space-y-1">
        <h2 className="text-base font-bold text-primary flex items-center gap-2 uppercase tracking-wider">
          <BookMarked className="w-5 h-5" /> Book Cover Swarm Studio
        </h2>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The team reads the finished book, designs two different cinematic concepts, writes the
          rear blurb, then builds the front and back together. Artwork stays text-free; editable
          book text is added only in the preview and exports.
        </p>
      </header>

      {!ready && (
        <p className="mx-3 text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-amber-200">
          Write the story first — covers come last so the art can be baked from the whole book.
        </p>
      )}

      <div className="px-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            Cover art direction (optional)
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onPromptChange("")}
            disabled={!prompt}
            className="h-7 text-[10px] text-muted-foreground"
          >
            <Eraser className="w-3 h-3" /> Clear
          </Button>
        </div>
        <textarea
          value={prompt}
          onChange={e => onPromptChange(e.target.value)}
          rows={3}
          placeholder={`Anything extra the cover artist should know — hero's look, location, weather, palette… (leave empty and the AI reads the whole ${genre || "story"} itself)`}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y"
        />
      </div>

      <Button
        type="button"
        onClick={onGenerateBoth}
        disabled={anyBusy}
        variant="outline"
        className="mx-3 w-[calc(100%-1.5rem)] h-11 font-bold text-sm"
      >
        {anyBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {anyBusy ? "Building both covers from your book…" : "Rebuild both with current directions"}
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-3">
        {(["cover", "back"] as const).map(slot => {
          const url = slot === "cover" ? coverImage : backImage;
          const isBusy = busy === slot;
          const label = slot === "cover" ? "Front Cover" : "Back Cover";
          return (
            <article key={slot} className="border border-border bg-card overflow-hidden shadow-lg">
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
                      {authorBelowTitle && author && (
                        <p className="mt-3 text-center text-foreground text-[clamp(0.55rem,1.7vw,0.85rem)] font-bold uppercase drop-shadow-lg">
                          {author}
                        </p>
                      )}
                    </div>

                    {!authorBelowTitle && author && (
                      <div className="absolute inset-x-0 bottom-0 px-4 pt-10 pb-5 bg-gradient-to-t from-black/90 via-black/55 to-transparent">
                        <p className="text-center text-foreground text-[clamp(0.65rem,2vw,1rem)] font-bold uppercase drop-shadow-lg">{author}</p>
                      </div>
                    )}

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

                    {/* Back: AI-written blurb card */}
                    <div className="absolute inset-x-0 top-[22%] bottom-[18%] flex items-center justify-center px-3">
                      <div className="w-full max-h-full overflow-y-auto rounded-xl bg-black/[0.92] backdrop-blur-[10px] border border-amber-300/60 px-3.5 py-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(0,0,0,0.6)]">
                        {blurb?.trim() ? (
                          <p className="text-white text-[clamp(0.55rem,1.75vw,0.85rem)] leading-relaxed whitespace-pre-wrap drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] first-letter:text-[1.9em] first-letter:font-black first-letter:text-amber-300 first-letter:float-left first-letter:mr-1.5 first-letter:leading-[0.85]">
                            {blurb.trim()}
                          </p>
                        ) : (
                          <p className="text-amber-200/80 text-[clamp(0.5rem,1.5vw,0.75rem)] leading-relaxed italic text-center">
                            {swarmBusy
                              ? "The cover swarm is writing your back-cover blurb…"
                              : "Run the cover swarm — the agents write this blurb from your finished book."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="absolute right-[10%] bottom-[5.5%] h-[10.5%] w-[32%] bg-foreground/95 border border-background/20" aria-label="Retail barcode safe zone" />

                  </>
                )}


                {url && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => onClearSlot(slot)}
                    className="absolute top-1 right-1 z-10 h-7 w-7"
                    aria-label={`Remove ${label} artwork`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              <div className="px-3 py-2 border-t border-border bg-background/60 min-h-14">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                  {slot === "cover" ? "Front concept" : "Rear concept"}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-2">
                  {(slot === "cover" ? frontDirection : backDirection) ||
                    (slot === "cover" ? "Iconic sales image from the finished book" : "Distinct story aftermath with clear blurb space")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onGenerateSlot(slot)}
                disabled={anyBusy}
                className="w-full rounded-none h-10 text-[11px] text-primary"
              >
                {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {url ? `Rebuild ${label}` : `Build ${label}`}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onPickSlot(slot)}
                className="w-full rounded-none h-10 text-[11px] text-muted-foreground border-t border-border"
              >
                <ImageIcon className="w-3 h-3" /> Library / device
              </Button>
            </article>
          );
        })}
      </div>

      {onRunSwarm && (
        <div className="px-3 pt-1 space-y-2">
          <Button
            type="button"
            size="lg"
            onClick={onRunSwarm}
            disabled={anyBusy || !ready}
            className="w-full min-h-14 h-auto whitespace-normal text-sm font-black"
          >
            {swarmBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : coverImage || backImage ? <RefreshCw className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            {swarmBusy ? swarmBusy : "Agent Swarm: redesign front + back from the finished book"}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
            One tap runs casting, front-art, rear-art, copywriting, criticism and lead-direction agents,
            then replaces both covers and the blurb. The front and rear use separate compositions.
          </p>
        </div>
      )}

      <div className="px-3 pt-2 space-y-2 border-t border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={downloadRetailFiles} disabled={anyBusy || !!exportBusy || !coverImage || !backImage}>
            {exportBusy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download print covers
          </Button>
          <Button type="button" variant="outline" onClick={shareRetailFiles} disabled={anyBusy || !!exportBusy || !coverImage || !backImage}>
            {exportBusy === "share" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            Share cover files
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground">
          6 × 9 inch trim, 0.125 inch bleed, 300 DPI JPEG. The rear reserves the bookseller barcode zone; author credit placement adapts to each book.
        </p>
      </div>
    </section>
  );
}
