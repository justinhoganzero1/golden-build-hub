import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, ImageIcon, X, Eraser, BookMarked, Users, RefreshCw, Download, Share2 } from "lucide-react";
import { SignedImage } from "@/components/SignedMedia";
import { Button } from "@/components/ui/button";
import { bakeCoverText, type BakeTextOptions, type CoverDesign } from "@/lib/bakeCoverText";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
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
  teamNotes?: string[];
  /** Typography + palette decision made by the design agent. */
  design?: CoverDesign;
}


export default function CoverStudio({
  title, author, blurb, genre, coverImage, backImage, busy,
  prompt, onPromptChange, frontDirection, backDirection,
  onGenerateBoth, onGenerateSlot, onClearSlot, onPickSlot,
  storyWordCount, swarmBusy, onRunSwarm, teamNotes = [], design,
}: CoverStudioProps) {
  const anyBusy = !!busy || !!swarmBusy;
  const ready = storyWordCount > 200;
  const [exportBusy, setExportBusy] = useState<"download" | "share" | null>(null);
  const [printPreviews, setPrintPreviews] = useState<{ cover?: string; back?: string }>({});
  const layout = useMemo<BakeTextOptions["layout"]>(() => {
    if (design?.layout) return design.layout;
    const choices: NonNullable<BakeTextOptions["layout"]>[] = ["masthead", "title-author", "cinematic", "editorial"];
    const seed = `${title}|${genre}`.split("").reduce((n, char) => ((n * 31) + char.charCodeAt(0)) >>> 0, 7);
    return choices[seed % choices.length];
  }, [title, genre, design?.layout]);
  const designKey = JSON.stringify(design ?? {});
  const coverTheme = useMemo(() => {
    const themes = ["electric", "coral", "violet", "emerald", "sunset"];
    const seed = `${title}|${genre}`.split("").reduce((n, char) => ((n * 33) + char.charCodeAt(0)) >>> 0, 11);
    return themes[seed % themes.length];
  }, [title, genre]);

  // The on-screen covers are the same flattened pixels sent to download/share.
  // No editor labels, controls, placeholders or concept notes sit over the art.
  useEffect(() => {
    let active = true;
    const common = { title, author, genre, width: 1875, height: 2775, layout, design } as const;
    Promise.all([
      coverImage ? resolveStorageUrl(coverImage, 3600) : Promise.resolve(undefined),
      backImage ? resolveStorageUrl(backImage, 3600) : Promise.resolve(undefined),
    ]).then(([resolvedCover, resolvedBack]) => Promise.all([
      resolvedCover ? bakeCoverText(resolvedCover, { ...common, slot: "cover" }) : Promise.resolve(undefined),
      resolvedBack ? bakeCoverText(resolvedBack, { ...common, slot: "back", blurb }) : Promise.resolve(undefined),
    ])).then(([cover, back]) => {
      if (active) setPrintPreviews({ cover, back });
    }).catch(() => {
      if (active) setPrintPreviews({ cover: coverImage, back: backImage });
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, author, genre, blurb, coverImage, backImage, layout, designKey]);

  const dataUrlToFile = async (dataUrl: string, name: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], name, { type: "image/jpeg" });
  };

  const buildRetailFiles = async () => {
    if (!coverImage || !backImage) throw new Error("Build both covers first");
    const common = { title, author, genre, width: 1875, height: 2775, layout, design } as const;

    const [resolvedCover, resolvedBack] = await Promise.all([
      resolveStorageUrl(coverImage, 3600),
      resolveStorageUrl(backImage, 3600),
    ]);
    const [front, back] = await Promise.all([
      bakeCoverText(resolvedCover, { ...common, slot: "cover" }),
      bakeCoverText(resolvedBack, { ...common, slot: "back", blurb }),
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

      {teamNotes.length > 0 && (
        <div className="mx-3 border border-accent-blue/40 bg-background/70 p-3">
          <p className="text-[11px] font-black uppercase text-accent-blue">Creative team decisions</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {teamNotes.map((note, index) => (
              <p key={`${index}-${note}`} className="text-[10px] leading-relaxed text-foreground/85">
                <span className="font-bold text-primary">{index + 1}.</span> {note}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className={`cover-identity cover-identity-${coverTheme} grid grid-cols-1 sm:grid-cols-2 gap-4 px-3`}>
        {(["cover", "back"] as const).map(slot => {
          const url = slot === "cover" ? coverImage : backImage;
          const isBusy = busy === slot;
          const label = slot === "cover" ? "Front Cover" : "Back Cover";
          const printPreview = slot === "cover" ? printPreviews.cover : printPreviews.back;
          return (
            <article key={slot} className="border border-border bg-card overflow-hidden shadow-lg">
              <div className="relative aspect-[2/3] bg-muted/30 overflow-hidden">
                {printPreview ? (
                  <SignedImage src={printPreview} alt={`${label}, exactly as exported for print`} className="absolute inset-0 w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isBusy
                      ? <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
                      : <ImageIcon className="w-8 h-8 text-muted-foreground/40" />}
                  </div>
                )}

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
              {url && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onClearSlot(slot)}
                  className="w-full rounded-none h-9 text-[11px] text-destructive border-t border-border"
                >
                  <X className="w-3 h-3" /> Remove artwork
                </Button>
              )}
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
          6 × 9 inch trim, 0.125 inch bleed, 300 DPI JPEG. The preview is the exact flattened print file; author credit placement adapts to each book.
        </p>
      </div>
    </section>
  );
}
