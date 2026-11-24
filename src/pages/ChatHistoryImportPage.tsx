import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { unzip, strFromU8 } from "fflate";
import { ArrowLeft, CheckCircle2, ExternalLink, History, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";
import {
  guessSource, parseExportFile, toImportRows, wantedZipEntry,
  type ImportedConversation, type ImportSource,
} from "@/lib/chatHistoryImport";

const LABEL: Record<ImportSource, string> = { chatgpt: "ChatGPT", gemini: "Gemini" };
const BATCH = 400;

function unzipWanted(data: Uint8Array): Promise<{ name: string; source: ImportSource; text: string }[]> {
  return new Promise((resolve, reject) => {
    unzip(data, { filter: (f) => wantedZipEntry(f.name) !== null }, (err, files) => {
      if (err) { reject(new Error("That ZIP file couldn't be opened.")); return; }
      resolve(Object.entries(files).map(([name, bytes]) => ({ name, source: wantedZipEntry(name)!, text: strFromU8(bytes) })));
    });
  });
}

const openOutside = (url: string) => {
  const w = window.open(url, "_blank");
  if (w) { try { w.opener = null; } catch { /* ignore */ } } else window.location.href = url;
};

/** Members bring their past ChatGPT / Gemini chats into Oracle's memory (private, searched for free). */
const ChatHistoryImportPage = () => {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState<Record<ImportSource, number | null>>({ chatgpt: null, gemini: null });
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const next = { chatgpt: 0, gemini: 0 } as Record<ImportSource, number>;
    for (const s of ["chatgpt", "gemini"] as ImportSource[]) {
      const { count } = await supabase.from("imported_chat_messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("source", s);
      next[s] = count ?? 0;
    }
    setCounts(next);
  }, [user]);
  useEffect(() => { void loadCounts(); }, [loadCounts]);

  const importFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setResult(null); setProgress(0);
    try {
      setBusy("Reading your file…");
      const found: { source: ImportSource; convs: ImportedConversation[] }[] = [];
      for (const file of Array.from(files)) {
        if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
          const entries = await unzipWanted(new Uint8Array(await file.arrayBuffer()));
          for (const e of entries) found.push({ source: e.source, convs: parseExportFile(e.source, e.name, e.text) });
        } else {
          const text = await file.text();
          const source = guessSource(file.name, text);
          if (source) found.push({ source, convs: parseExportFile(source, file.name, text) });
        }
      }
      const bySource = new Map<ImportSource, ImportedConversation[]>();
      for (const f of found) bySource.set(f.source, [...(bySource.get(f.source) ?? []), ...f.convs]);
      const rowsAll = [...bySource.entries()].flatMap(([source, convs]) => toImportRows(user.id, source, convs));
      if (!rowsAll.length) {
        setResult("I couldn't find any chats in that file. Pick the ZIP that ChatGPT or Google emailed you.");
        return;
      }
      setBusy("Saving into Oracle's memory…");
      for (let i = 0; i < rowsAll.length; i += BATCH) {
        const { error } = await supabase.from("imported_chat_messages")
          .upsert(rowsAll.slice(i, i + BATCH), { onConflict: "user_id,source,conversation_id,msg_index", ignoreDuplicates: true });
        if (error) throw new Error("Saving stopped part-way. Please try the same file again — nothing will be doubled up.");
        setProgress(Math.round(((i + BATCH) / rowsAll.length) * 100));
      }
      const summary = [...bySource.entries()].map(([s, c]) => `${c.length.toLocaleString()} ${LABEL[s]} chat${c.length === 1 ? "" : "s"}`).join(" and ");
      setResult(`Done! Oracle now remembers ${summary}.`);
      toast.success("Past chats added to Oracle's memory");
      await loadCounts();
    } catch (e: any) {
      setResult(e?.message || "Something went wrong reading that file.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (source: ImportSource) => {
    if (!user || !window.confirm(`Remove all your ${LABEL[source]} history from Oracle's memory?`)) return;
    setBusy(`Removing ${LABEL[source]} history…`);
    const { error } = await supabase.from("imported_chat_messages").delete().eq("user_id", user.id).eq("source", source);
    setBusy(null);
    if (error) toast.error("Couldn't remove it. Please try again.");
    else { toast.success(`${LABEL[source]} history removed`); await loadCounts(); }
  };

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <header className="oracle-signin-header">
        <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
        <p className="mt-1 text-xs text-muted-foreground">Bring your past chats to Oracle</p>
      </header>

      <section className="oracle-signin-card space-y-4" aria-labelledby="import-title">
        <h2 id="import-title" className="oracle-signin-title flex items-center gap-2"><History className="h-5 w-5 text-primary" />Your ChatGPT &amp; Gemini history</h2>
        <p className="text-sm text-muted-foreground">
          Oracle will remember your old chats and bring them up when they help. They stay private to you, and looking them up is free.
        </p>

        <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
          <p className="font-semibold text-foreground">1. ChatGPT</p>
          <p className="mt-1 text-muted-foreground">In ChatGPT open <b>Settings → Data controls → Export data</b> and confirm. OpenAI emails you a ZIP file (can take a few hours).</p>
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline" onClick={() => openOutside("https://chatgpt.com/#settings/DataControls")}>Open ChatGPT settings<ExternalLink className="h-3 w-3" /></button>
          {counts.chatgpt ? <p className="mt-2 flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{counts.chatgpt.toLocaleString()} ChatGPT messages remembered</p> : null}
        </div>

        <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-sm">
          <p className="font-semibold text-foreground">2. Gemini</p>
          <p className="mt-1 text-muted-foreground">On Google Takeout tap <b>Deselect all</b>, tick <b>My Activity</b>, tap <b>All activity data included</b> and choose only <b>Gemini Apps</b>. Then <b>Next step → Create export</b>. Google emails you a ZIP file.</p>
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline" onClick={() => openOutside("https://takeout.google.com/")}>Open Google Takeout<ExternalLink className="h-3 w-3" /></button>
          <p className="mt-1 text-xs text-muted-foreground">Google only keeps Gemini chats if "Gemini Apps Activity" was switched on.</p>
          {counts.gemini ? <p className="mt-2 flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{counts.gemini.toLocaleString()} Gemini messages remembered</p> : null}
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-foreground text-sm">3. Give the ZIP to Oracle</p>
          <input ref={fileRef} type="file" accept=".zip,.json,.html,application/zip,application/json,text/html" multiple className="hidden" onChange={(e) => void importFiles(e.target.files)} />
          <Button className="w-full" disabled={!!busy || !user} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}{busy ?? "Choose the ZIP file"}
          </Button>
          {busy && progress > 0 && <Progress value={Math.min(progress, 100)} aria-label="Saving progress" />}
          {result && <p role="status" className="text-sm text-foreground">{result}</p>}
        </div>

        {(counts.chatgpt || counts.gemini) ? (
          <div className="flex flex-wrap gap-2">
            {counts.chatgpt ? <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void remove("chatgpt")}><Trash2 className="mr-1 h-4 w-4" />Remove ChatGPT history</Button> : null}
            {counts.gemini ? <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void remove("gemini")}><Trash2 className="mr-1 h-4 w-4" />Remove Gemini history</Button> : null}
          </div>
        ) : null}

        <Link to="/oracle" className="inline-flex items-center gap-1 text-sm text-primary underline"><ArrowLeft className="h-4 w-4" />Back to Oracle</Link>
      </section>
    </main>
  );
};

export default ChatHistoryImportPage;
