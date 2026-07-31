import { useEffect, useState } from "react";
import { Loader2, Trash2, Dna, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  listStyleSamples, addStyleSample, deleteStyleSample,
  loadStyleProfile, saveStyleProfile, STYLE_ANALYST_SYSTEM, type StyleSample,
} from "@/lib/styleDna";

interface Props {
  userId?: string;
  callAI: (system: string, prompt: string, opts?: { model?: string; maxTokens?: number }) => Promise<string>;
  onProfileChange?: (profile: string) => void;
}

const StyleDnaPanel = ({ userId, callAI, onProfileChange }: Props) => {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [training, setTraining] = useState(false);
  const [profile, setProfile] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const p = loadStyleProfile(userId);
    setProfile(p);
    onProfileChange?.(p);
    listStyleSamples(userId).then(setSamples).catch(() => { /* empty */ });
  }, [userId]);

  const refresh = async () => {
    if (!userId) return;
    try { setSamples(await listStyleSamples(userId)); } catch { /* ignore */ }
  };

  const add = async () => {
    if (!userId) { toast.error("Sign in first"); return; }
    setBusy(true);
    try {
      await addStyleSample(userId, draft);
      setDraft("");
      await refresh();
      toast.success("Writing sample saved to your Style DNA");
    } catch (e: any) {
      toast.error(e?.message || "Could not save sample");
    } finally { setBusy(false); }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    setBusy(true);
    try {
      for (const f of Array.from(files).slice(0, 10)) {
        const text = await f.text();
        if (text.trim().length >= 200) await addStyleSample(userId, text);
      }
      await refresh();
      toast.success("Samples uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally { setBusy(false); }
  };

  const train = async () => {
    if (!userId) return;
    if (!samples.length) { toast.error("Add at least one writing sample first."); return; }
    setTraining(true);
    try {
      const corpus = samples.map((s, i) => `--- SAMPLE ${i + 1} ---\n${s.content.slice(0, 6000)}`).join("\n\n");
      const out = await callAI(STYLE_ANALYST_SYSTEM, corpus, { maxTokens: 3000 });
      const clean = (out || "").replace(/^```[a-z]*\n?|```$/g, "").trim();
      if (!clean) throw new Error("Analyst returned nothing");
      setProfile(clean);
      saveStyleProfile(userId, clean);
      onProfileChange?.(clean);
      toast.success("Style DNA trained — new chapters will match your voice");
    } catch (e: any) {
      if (e?.message !== "blocked") toast.error(e?.message || "Training failed");
    } finally { setTraining(false); }
  };

  const remove = async (id: string) => {
    try { await deleteStyleSample(id); await refresh(); } catch { toast.error("Delete failed"); }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-[11px] font-semibold text-primary uppercase tracking-wider"
      >
        <span className="flex items-center gap-1.5"><Dna className="w-3.5 h-3.5" /> Style DNA — write in my voice</span>
        <span className="text-muted-foreground normal-case">
          {samples.length} sample{samples.length === 1 ? "" : "s"} · {profile ? "trained" : "not trained"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] text-muted-foreground">
            Paste or upload your own writing (emails, blog posts, old chapters). The AI studies your rhythm, vocabulary and habits, then writes new chapters in that exact voice.
          </p>

          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            placeholder="Paste a piece of your own writing here — at least a couple of paragraphs…"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={add} disabled={busy || draft.trim().length < 200}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add sample
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground cursor-pointer hover:border-primary/40">
              Upload .txt/.md
              <input type="file" multiple accept=".txt,.md,text/plain" className="hidden" onChange={e => onFiles(e.target.files)} />
            </label>
            <button
              type="button" onClick={train} disabled={training || !samples.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40"
            >
              {training ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Train Style DNA
            </button>
          </div>

          {!!samples.length && (
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {samples.map(s => (
                <li key={s.id} className="flex items-start gap-2 text-[11px] bg-background/60 border border-border rounded-lg px-2 py-1.5">
                  <span className="flex-1 text-muted-foreground line-clamp-2">{s.content.slice(0, 160)}…</span>
                  <button type="button" onClick={() => remove(s.id)} className="text-destructive shrink-0" aria-label="Delete sample">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {profile && (
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer text-primary">View my trained Style DNA profile</summary>
              <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] max-h-48 overflow-y-auto">{profile}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default StyleDnaPanel;
