import { useState } from "react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { BookOpen, Loader2, Sparkles, Download, Info, Eye, EyeOff, Package } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import { useSaveMedia } from "@/hooks/useUserAvatars";
import PaywallGate from "@/components/PaywallGate";

/**
 * eBook Cover Studio — one form, generates a full Kindle/EPUB-ready cover set:
 * front (1600×2560), back (1600×2560), and spine (260×2560 @ ~200 pages).
 * Each part is generated separately with a tailored prompt so the model
 * respects the aspect ratio, then all three save to the Media Library with
 * cover metadata so users can re-download the set later.
 */

const STYLES = [
  { id: "realistic-4k",   label: "4K Realistic",   suffix: "ultra-realistic 4K photography style, razor-sharp, cinematic lighting", tier: "premium" as const },
  { id: "photo-normal",   label: "Normal Photo",   suffix: "natural realistic photograph" },
  { id: "cartoon",        label: "Cartoon",        suffix: "cartoon illustration, bold outlines, flat vibrant colours" },
  { id: "2_5d",           label: "2.5D Photoreal", suffix: "2.5D photorealistic illustration, painterly depth, cinematic lighting" },
  { id: "anime",          label: "Anime",          suffix: "modern anime cover art, cel-shaded, clean line art" },
  { id: "cinematic",      label: "Cinematic",      suffix: "cinematic movie-poster style, dramatic lighting, moody colour grade", tier: "premium" as const },
  { id: "fantasy",        label: "Fantasy",        suffix: "epic fantasy book cover art, painterly, rich detail" },
  { id: "minimalist",     label: "Minimalist",     suffix: "clean minimalist book cover design, elegant typography space, restrained palette" },
];

// KDP/Kindle ebook cover recommended: 1600×2560 (1:1.6). Spine width for
// paperback varies by page count — 260px is roughly correct for a 200-page
// 60lb cream paperback and is the sensible default we surface here.
const SPECS = {
  front: { w: 1600, h: 2560, label: "Front cover", note: "Kindle & EPUB standard (1600×2560, 1:1.6)" },
  back:  { w: 1600, h: 2560, label: "Back cover",  note: "Matches front (1600×2560) — used for KDP paperback wrap" },
  spine: { w: 260,  h: 2560, label: "Spine",       note: "Tall thin strip (260×2560) — sized for ~200-page paperback" },
};

type Part = keyof typeof SPECS;

interface GeneratedPart {
  part: Part;
  url: string;
  libraryId?: string;
}

const EbookCoverStudioPage = () => {
  const saveMedia = useSaveMedia();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [blurb, setBlurb] = useState("");
  const [description, setDescription] = useState("");
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [busy, setBusy] = useState<Part | "all" | null>(null);
  const [results, setResults] = useState<GeneratedPart[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [zipping, setZipping] = useState(false);

  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];

  const slugTitle = (title || "cover").trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") || "cover";

  const downloadZip = async () => {
    if (results.length === 0) {
      toast.error("Generate covers first.");
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`${slugTitle}_KDP_Covers`)!;
      const nameMap: Record<Part, string> = {
        front: `${slugTitle}_Front_Cover.png`,
        back: `${slugTitle}_Back_Cover.png`,
        spine: `${slugTitle}_Spine.png`,
      };
      for (const r of results) {
        const resp = await fetch(r.url);
        const blob = await resp.blob();
        folder.file(nameMap[r.part], blob);
      }
      const readme = [
        `KDP / Kindle / EPUB Cover Set`,
        `Book: ${title}${subtitle ? ` — ${subtitle}` : ""}`,
        author ? `Author: ${author}` : "",
        genre ? `Genre: ${genre}` : "",
        `Style: ${style.label}`,
        ``,
        `Files:`,
        `- ${nameMap.front}  (1600×2560, Kindle & EPUB front cover)`,
        `- ${nameMap.back}   (1600×2560, KDP paperback back cover)`,
        `- ${nameMap.spine}  (260×2560,  KDP paperback spine — ~200pp)`,
        ``,
        `KDP paperback bleed: 0.125" (~38px @ 300dpi).`,
        `Keep type & key art inside the safe zone (~0.25" / 75px inset).`,
        `Barcode zone: ~2"×1.2" (600×360px) bottom-right of back cover — leave white/light background.`,
      ].filter(Boolean).join("\n");
      folder.file("README.txt", readme);

      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugTitle}_KDP_Covers.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("ZIP ready — check your downloads.");
    } catch (e) {
      toast.error(`ZIP failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setZipping(false);
    }
  };


  const promptFor = (part: Part): string => {
    const spec = SPECS[part];
    const palette = genre ? `Genre: ${genre}. ` : "";
    const shared = `${palette}Style: ${style.suffix}. Target canvas ${spec.w}×${spec.h} pixels (aspect ${(spec.w / spec.h).toFixed(3)}:1). Leave clean space for the title and author to be typeset later — do NOT render any text, letters, words or logos in the image itself.`;

    if (part === "front") {
      return `Design a professional eBook FRONT cover for a book titled "${title}"${subtitle ? ` — subtitle "${subtitle}"` : ""}${author ? `, by ${author}` : ""}. ${description || "A striking, emotive cover illustration that sells the story at a glance."} Vertical portrait composition with a bold focal image, strong colour hierarchy, and a clear silent zone at the top for the title and at the bottom for the author name. ${shared}`;
    }
    if (part === "back") {
      return `Design a matching eBook/paperback BACK cover for the book "${title}"${author ? ` by ${author}` : ""}. ${blurb ? `The back should visually complement this blurb: "${blurb.slice(0, 400)}"` : "Simple atmospheric background that complements the front cover."} Keep a large calm upper area suitable for placing a blurb of body text later, with a smaller supporting graphic near the bottom and a clean space for a barcode block in the bottom-right corner. Match the colour palette and mood of the front cover. ${shared}`;
    }
    // spine
    return `Design a paperback SPINE strip for the book "${title}"${author ? ` by ${author}` : ""}. Tall, narrow vertical band that matches the front cover colour palette. Simple continuous background (gradient, pattern, or subtle motif) with a clean central column left free for the title and author name to be typeset later. ${shared}`;
  };

  const generateOne = async (part: Part): Promise<GeneratedPart | null> => {
    const prompt = promptFor(part);
    try {
      const gen = await generateImage({ prompt, tier: style.tier });
      const spec = SPECS[part];
      const saved: any = await saveMedia.mutateAsync({
        media_type: "image",
        title: `Cover ${part}: ${title || "Untitled"}`,
        url: gen.url,
        source_page: "ebook-cover-studio",
        metadata: {
          kind: "ebook-cover",
          part,
          book_title: title,
          subtitle,
          author,
          genre,
          blurb,
          description,
          style: styleId,
          target_size: `${spec.w}x${spec.h}`,
          prompt,
        },
      });
      return { part, url: gen.url, libraryId: saved?.id || saved };
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        toast.error("Out of AI credits — top up to keep generating.");
        return null;
      }
      toast.error(`${SPECS[part].label} failed: ${e instanceof Error ? e.message : "unknown"}`);
      return null;
    }
  };

  const generateSet = async () => {
    if (!title.trim()) {
      toast.error("Give the book a title first.");
      return;
    }
    setBusy("all");
    setResults([]);
    // Generate sequentially so a rate-limit blip on one doesn't cascade.
    const out: GeneratedPart[] = [];
    for (const part of ["front", "back", "spine"] as Part[]) {
      setBusy(part);
      const r = await generateOne(part);
      if (r) out.push(r);
      setResults([...out]);
    }
    setBusy(null);
    if (out.length === 3) toast.success("Full cover set saved to your library!");
    else if (out.length > 0) toast.warning(`Saved ${out.length}/3 covers — you can re-generate the missing part.`);
  };

  const regenerateOne = async (part: Part) => {
    if (!title.trim()) {
      toast.error("Give the book a title first.");
      return;
    }
    setBusy(part);
    const r = await generateOne(part);
    setBusy(null);
    if (r) {
      setResults((prev) => [...prev.filter((p) => p.part !== part), r]);
      toast.success(`${SPECS[part].label} regenerated.`);
    }
  };

  const findResult = (part: Part) => results.find((r) => r.part === part);

  return (
    <PaywallGate requiredTier="starter" featureName="eBook Cover Studio">
      <SEO
        title="eBook Cover Studio — Kindle & EPUB Cover Set Generator | Oracle Lunar"
        description="Generate a full ebook cover set — front, back and spine — sized for Kindle and EPUB, from a single description."
        path="/ebook-cover-studio"
      />
      <div className="min-h-screen bg-background pb-24">
        <UniversalBackButton />
        <div className="max-w-3xl mx-auto px-4 pt-14 pb-6">
          <header className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">eBook Cover Studio</h1>
              <p className="text-xs text-muted-foreground">
                Front, back and spine — Kindle & EPUB ready in one go.
              </p>
            </div>
          </header>

          <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Book title *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. The Silent Tide"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Subtitle
                </label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Author
                </label>
                <input
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Genre
                </label>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Thriller, Fantasy, Romance"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Cover description — the AI text box
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the front cover imagery, mood, colours, characters, setting…"
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Back-cover blurb (optional)
              </label>
              <textarea
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                placeholder="Paste your book blurb so the back cover art matches its tone."
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/60 resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Art style / genre
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {STYLES.map((s) => {
                  const active = s.id === styleId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStyleId(s.id)}
                      disabled={!!busy}
                      className={`px-2 py-2 rounded-lg text-[11px] border transition-colors ${
                        active
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={generateSet}
              disabled={!!busy || !title.trim()}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy === "all"
                ? "Preparing…"
                : busy
                ? `Generating ${SPECS[busy as Part].label.toLowerCase()}…`
                : "Generate full cover set"}
            </button>

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <p>
                Kindle & EPUB use the front cover only. The back cover and spine ship with the same set so you can also
                upload a full wrap to KDP paperback. All three save automatically to your Media Library.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            {(["front", "back", "spine"] as Part[]).map((part) => {
              const spec = SPECS[part];
              const result = findResult(part);
              const isBusy = busy === part;
              return (
                <div key={part} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{spec.label}</h3>
                      <p className="text-[10px] text-muted-foreground">{spec.note}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result?.url && (
                        <a
                          href={result.url}
                          download={`${(title || "cover").replace(/\s+/g, "-").toLowerCase()}-${part}.png`}
                          className="text-[11px] px-2.5 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-foreground flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => regenerateOne(part)}
                        disabled={!!busy || !title.trim()}
                        className="text-[11px] px-2.5 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 disabled:opacity-40"
                      >
                        {isBusy ? "Working…" : result ? "Re-generate" : "Generate"}
                      </button>
                    </div>
                  </div>
                  <div
                    className="w-full bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center"
                    style={{ aspectRatio: `${spec.w} / ${spec.h}`, maxHeight: 480 }}
                  >
                    {isBusy ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : result?.url ? (
                      <img src={result.url} alt={`${part} cover`} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Not generated yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </PaywallGate>
  );
};

export default EbookCoverStudioPage;
