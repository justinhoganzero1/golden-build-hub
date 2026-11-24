import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { unzip, strFromU8 } from "fflate";
import { Loader2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";
import { guessSource, parseExportFile, wantedZipEntry, type ImportedConversation } from "@/lib/chatHistoryImport";

/** Free public viewer: reads a ChatGPT/Gemini export entirely in the visitor's browser. Nothing is uploaded or saved. */
const ChatGptViewerPage = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [convs, setConvs] = useState<ImportedConversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Free ChatGPT & Gemini Export Viewer | Oracle Lunar";
    const d = document.querySelector('meta[name="description"]');
    d?.setAttribute("content", "Open your ChatGPT or Gemini export ZIP and search your past chats for free. Runs in your browser — nothing is uploaded.");
  }, []);

  const read = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg(null);
    try {
      const out: ImportedConversation[] = [];
      for (const file of Array.from(files)) {
        if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
          const data = new Uint8Array(await file.arrayBuffer());
          const entries = await new Promise<Record<string, Uint8Array>>((res, rej) =>
            unzip(data, { filter: f => wantedZipEntry(f.name) !== null }, (e, f) => (e ? rej(e) : res(f))));
          for (const [name, bytes] of Object.entries(entries)) out.push(...parseExportFile(wantedZipEntry(name)!, name, strFromU8(bytes)));
        } else {
          const text = await file.text(); const s = guessSource(file.name, text);
          if (s) out.push(...parseExportFile(s, file.name, text));
        }
      }
      setConvs(out);
      setMsg(out.length ? `${out.length.toLocaleString()} chats found.` : "No chats found in that file. Pick the ZIP ChatGPT or Google emailed you.");
    } catch { setMsg("That file couldn't be opened."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return convs.slice(0, 200);
    return convs.filter(c => (c.title ?? "").toLowerCase().includes(t) || c.messages.some(m => m.content.toLowerCase().includes(t))).slice(0, 200);
  }, [convs, q]);

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <section className="oracle-signin-card space-y-4 max-w-2xl" aria-labelledby="viewer-title">
        <h1 id="viewer-title" className="oracle-signin-title">Free ChatGPT &amp; Gemini history viewer</h1>
        <p className="text-sm text-muted-foreground">Open your export ZIP and search your old chats. It all runs on your device — nothing is uploaded.</p>
        <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
          Want an AI best friend who already knows your story? <Link to="/download" className="text-primary underline">Get Oracle Lunar free</Link> and bring these chats into her memory.
        </div>
        <input ref={fileRef} type="file" accept=".zip,.json,.html,application/zip" multiple className="hidden" onChange={e => void read(e.target.files)} />
        <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}Choose your export ZIP
        </Button>
        {msg && <p role="status" className="text-sm text-foreground">{msg}</p>}
        {convs.length > 0 && (
          <>
            <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search chats" className="pl-8" placeholder="Search your chats" value={q} onChange={e => setQ(e.target.value)} /></div>
            <ul className="space-y-2">
              {shown.map(c => (
                <li key={c.id} className="rounded-lg border border-border/70 bg-background/40 p-2 text-sm">
                  <button type="button" className="w-full text-left font-semibold text-foreground" onClick={() => setOpen(open === c.id ? null : c.id)}>{c.title || "Untitled chat"} <span className="font-normal text-muted-foreground">({c.messages.length})</span></button>
                  {open === c.id && <div className="mt-2 space-y-2">{c.messages.map((m, i) => (
                    <p key={i} className="whitespace-pre-wrap break-words"><b className="text-primary">{m.role === "user" ? "You" : "AI"}:</b> {m.content}</p>))}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
        <h2 className="text-sm font-semibold text-foreground">How to get your export</h2>
        <p className="text-xs text-muted-foreground">ChatGPT: Settings → Data controls → Export data. Gemini: Google Takeout → My Activity → Gemini Apps. Both arrive by email as a ZIP.</p>
      </section>
    </main>
  );
};
export default ChatGptViewerPage;
