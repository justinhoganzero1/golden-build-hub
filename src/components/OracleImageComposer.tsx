import { useRef, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import { useSaveMedia } from "@/hooks/useUserAvatars";

interface OracleImageComposerProps {
  onGenerated?: (url: string, prompt: string) => void;
}

const MAX_REFS = 4;

type StyleId =
  | "realistic-4k"
  | "photo-normal"
  | "cartoon"
  | "2_5d-photoreal"
  | "anime"
  | "cinematic"
  | "oil-painting"
  | "watercolor"
  | "3d-render";

const STYLES: { id: StyleId; label: string; hint: string; suffix: string; tier?: "premium" | "fast" }[] = [
  { id: "realistic-4k",   label: "4K Realistic",       hint: "Ultra-detailed, magazine quality", suffix: "ultra-realistic 4K photography, razor-sharp focus, natural lighting, DSLR quality, highly detailed textures, professional colour grading", tier: "premium" },
  { id: "photo-normal",   label: "Normal Photo",       hint: "Like a phone snapshot",           suffix: "natural everyday photograph, casual composition, realistic lighting, taken on a modern phone camera" },
  { id: "cartoon",        label: "Cartoon",            hint: "Bold lines, flat colours",         suffix: "cartoon illustration, bold clean outlines, flat vibrant colours, playful expressive style" },
  { id: "2_5d-photoreal", label: "2.5D Photoreal",     hint: "Stylised depth, realistic feel",   suffix: "2.5D photorealistic illustration, subtle depth and parallax, painterly realism with cinematic lighting, stylised yet lifelike" },
  { id: "anime",          label: "Anime",              hint: "Japanese anime style",             suffix: "modern anime illustration, clean line art, cel-shaded colours, expressive eyes, detailed background" },
  { id: "cinematic",      label: "Cinematic",          hint: "Movie poster look",                suffix: "cinematic film still, dramatic lighting, shallow depth of field, moody colour grade, 35mm film grain", tier: "premium" },
  { id: "oil-painting",   label: "Oil Painting",       hint: "Classic painted look",             suffix: "classical oil painting, visible brushstrokes, rich pigments, gallery-quality composition" },
  { id: "watercolor",     label: "Watercolour",        hint: "Soft washed colours",              suffix: "delicate watercolour painting, soft washes of colour, paper texture, gentle bleeding edges" },
  { id: "3d-render",      label: "3D Render",          hint: "Pixar-style 3D",                   suffix: "high-quality 3D render, soft global illumination, subsurface scattering, Pixar-style character design, octane render" },
];

/**
 * Compose an image with written details + optional reference photos.
 * Opens as a modal from a floating button so users have an explicit place
 * to type comments/details for photos and attach source images, rather
 * than only being able to speak into the Oracle chat.
 */
const OracleImageComposer = ({ onGenerated }: OracleImageComposerProps) => {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [styleId, setStyleId] = useState<StyleId>("realistic-4k");
  const [refs, setRefs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveMedia = useSaveMedia();

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_REFS - refs.length;
    if (remaining <= 0) {
      toast.error(`Up to ${MAX_REFS} reference photos.`);
      return;
    }
    const accept = Array.from(files).slice(0, remaining);
    let loaded = 0;
    const next: string[] = [];
    accept.forEach((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image`);
        loaded++;
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} is over 10MB`);
        loaded++;
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        next.push(String(r.result));
        loaded++;
        if (loaded === accept.length) setRefs((prev) => [...prev, ...next].slice(0, MAX_REFS));
      };
      r.readAsDataURL(f);
    });
  };

  const removeRef = (i: number) => setRefs((prev) => prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setDetails("");
    setRefs([]);
    setResultUrl(null);
  };

  const generate = async () => {
    const base = details.trim();
    if (!base) {
      toast.error("Add some details for the photo.");
      return;
    }
    const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
    const prompt = `${base} — style: ${style.suffix}`;
    setBusy(true);
    setResultUrl(null);
    try {
      const gen = await generateImage({
        prompt,
        inputImage: refs[0],
        tier: style.tier,
      });
      const url = gen.url;
      setResultUrl(url);
      onGenerated?.(url, prompt);
      try {
        await saveMedia.mutateAsync({
          media_type: "image",
          title: `Image: ${prompt.slice(0, 60)}`,
          url,
          source_page: "oracle-image",
          metadata: {
            kind: "image",
            prompt,
            style: styleId,
            references: refs.length,
            composer: "oracle-image-composer",
            fallback: gen.fallback,
          },
        });
        toast.success("Saved to your library");
      } catch {
        toast.error("Image made, but library save failed");
      }
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        toast.error("Out of AI credits — top up to keep generating.");
      } else {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Create image with details"
        className="p-2 rounded-full bg-[#FFAA00]/20 hover:bg-[#FFAA00]/40 transition-colors"
      >
        <ImagePlus className="w-5 h-5 text-[#FFAA00]" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0f0f10] border border-[#FFAA00]/30 rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FFAA00]" />
                <h2 className="text-white text-sm font-semibold">Create an image</h2>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-300"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">
                Details / comments
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the photo you want — subject, mood, lighting, style, colours…"
                rows={5}
                spellCheck
                autoCapitalize="sentences"
                className="w-full bg-black/60 border border-white/10 focus:border-[#FFAA00]/60 outline-none rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-500 resize-none"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                The more you write, the better the result.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] uppercase tracking-wider text-gray-400">
                  Reference photos <span className="text-gray-600">(optional, up to {MAX_REFS})</span>
                </label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={refs.length >= MAX_REFS || busy}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-purple-500/20 hover:bg-purple-500/40 disabled:opacity-40 text-purple-200"
                >
                  <Upload className="w-3 h-3" /> Add photos
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              {refs.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="w-full py-6 rounded-xl border-2 border-dashed border-white/15 hover:border-[#FFAA00]/50 text-gray-500 hover:text-[#FFAA00] text-xs flex flex-col items-center gap-1 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Tap to select photos to use as reference
                </button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {refs.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/40">
                      <img src={url} alt={`ref-${i}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeRef(i)}
                        disabled={busy}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 hover:bg-red-600/80 text-white"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {i === 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-center text-[#FFAA00] py-0.5">
                          Primary
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {resultUrl && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5">Result</div>
                <img src={resultUrl} alt="Generated" className="w-full rounded-xl border border-white/10" />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={generate}
                disabled={busy || !details.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#FFAA00] text-black font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {busy ? "Generating…" : resultUrl ? "Generate again" : "Generate image"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OracleImageComposer;
