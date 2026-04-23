import { useState } from "react";
import { Upload, Loader2, Sparkles } from "lucide-react";
import { saveToLibrary } from "@/lib/saveToLibrary";
import { toast } from "sonner";

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-gen`;

/** Simplified Photo Magic: upload a photo, prompt-edit it. */
const StandalonePhoto = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onFile = (f: File | null) => {
    setFile(f);
    setResult("");
    if (f) {
      const r = new FileReader();
      r.onload = () => setPreview(String(r.result));
      r.readAsDataURL(f);
    } else setPreview("");
  };

  const transform = async () => {
    if (!file || !prompt.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ prompt, sourceImage: preview, mode: "edit" }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Failed");
      const out = j.imageUrl || j.url || "";
      setResult(out);
      if (out) {
        const id = await saveToLibrary({
          media_type: "image",
          title: `Photo Magic: ${prompt.slice(0, 60)}`,
          url: out,
          source_page: "standalone-photo",
          metadata: { prompt, mode: "edit" },
        });
        if (id) toast.success("Saved to your Library");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="aspect-video rounded-2xl border-2 border-dashed border-border bg-card flex items-center justify-center cursor-pointer hover:border-primary/40 overflow-hidden">
          {preview ? (
            <img src={preview} alt="upload" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-2" />Tap to upload a photo</div>
          )}
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || null)} />
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="How should I transform it? e.g. 'make it look like an oil painting'"
        rows={3}
        className="w-full bg-muted rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40 resize-none"
      />
      <button
        onClick={transform}
        disabled={loading || !file || !prompt.trim()}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Transform
      </button>
      {error && <div className="text-sm text-destructive text-center">{error}</div>}
      {result && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Result</div>
          <img src={result} alt="result" className="w-full rounded-2xl" />
          <a href={result} download className="block text-center mt-2 text-sm text-primary hover:underline">Download</a>
        </div>
      )}
    </div>
  );
};

export default StandalonePhoto;
