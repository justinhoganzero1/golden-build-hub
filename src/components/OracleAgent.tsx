/**
 * OracleAgent — global floating Oracle that runs ANY task in the background
 * and presents the finished result full-screen + saves to the user's library.
 *
 * UX:
 *  - Bottom-right draggable orb (visible on every authenticated screen except /oracle).
 *  - Tap orb → compact prompt sheet ("Ask the Oracle to make anything…").
 *  - Submit → orb minimizes, spinning progress ring shows it's working.
 *  - On completion → full-screen result viewer (image / video / text).
 *  - Auto-saves to library by default. User can pick "auto-delete after viewing"
 *    on first run (privacy consent box). Choice stored locally + can be changed.
 *  - Wake word "ok oracle" re-opens (best-effort Web Speech API).
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, Mic, Loader2, Trash2, Save, Download, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import { saveToLibrary } from "@/lib/saveToLibrary";
import { useDraggable } from "@/hooks/useDraggable";
import { runFullDiagnostic, type DoctorReport } from "@/lib/systemDoctor";

type TaskKind = "image" | "video" | "text" | "research" | "diagnose";
type Job = {
  id: string;
  prompt: string;
  kind: TaskKind;
  status: "running" | "done" | "error";
  resultUrl?: string;
  resultText?: string;
  sources?: { url: string; title?: string; description?: string }[];
  report?: DoctorReport;
  error?: string;
};

const PRIVACY_KEY = "oracle-agent-storage-consent"; // "keep" | "auto-delete"
const ORB_HIDDEN_ROUTES = ["/oracle", "/sign-in", "/auth", "/verify-phone", "/age-required", "/consent"];

const SUPA = import.meta.env.VITE_SUPABASE_URL;
const IMAGE_URL = `${SUPA}/functions/v1/image-gen`;
const VIDEO_URL = `${SUPA}/functions/v1/gemini-video`;
const ORACLE_URL = `${SUPA}/functions/v1/oracle-chat`;
const RESEARCH_URL = `${SUPA}/functions/v1/oracle-research`;

function classify(prompt: string): TaskKind {
  const p = prompt.toLowerCase();
  if (/\b(diagnose|self[- ]?test|self[- ]?check|scan the app|run diagnostic|system check|check the app|fix the app|something(?:'s| is) wrong|app is broken|not working)\b/.test(p)) return "diagnose";
  if (/\b(search|google|look ?up|find online|research|how do i|how to|why does|fix error|solution|on the (web|net|internet))\b/.test(p)) return "research";
  if (/\b(video|clip|animate|movie|short film|moving|footage)\b/.test(p)) return "video";
  if (/\b(image|picture|photo|art|illustration|logo|poster|wallpaper|draw|paint|render|design)\b/.test(p)) return "image";
  return "text";
}

export default function OracleAgent() {
  const { user } = useAuth();
  const location = useLocation();
  const drag = useDraggable("oracle-agent-orb-pos", 16, 120);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [consent, setConsent] = useState<"keep" | "auto-delete">("keep");
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const lastSavedIdRef = useRef<string | null>(null);

  // Load privacy preference
  useEffect(() => {
    const stored = localStorage.getItem(PRIVACY_KEY);
    if (!stored && user) {
      setAskConsent(true);
    } else if (stored === "keep" || stored === "auto-delete") {
      setConsent(stored);
    }
  }, [user]);

  const saveConsent = (choice: "keep" | "auto-delete") => {
    localStorage.setItem(PRIVACY_KEY, choice);
    setConsent(choice);
    setAskConsent(false);
  };

  // Wake word: "ok oracle"
  useEffect(() => {
    if (!user) return;
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    let stopped = false;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((x: any) => x[0].transcript).join(" ").toLowerCase();
      if (/\b(ok|hey)\s+oracle\b/.test(t)) setOpen(true);
    };
    r.onerror = () => {};
    r.onend = () => { if (!stopped) try { r.start(); } catch {} };
    try { r.start(); setListening(true); } catch {}
    recogRef.current = r;
    return () => { stopped = true; try { r.stop(); } catch {} setListening(false); };
  }, [user]);

  const runJob = useCallback(async (prompt: string) => {
    if (!user) { toast.error("Sign in to use the Oracle."); return; }
    const kind = classify(prompt);
    const id = Math.random().toString(36).slice(2);
    const j: Job = { id, prompt, kind, status: "running" };
    setJob(j);
    setOpen(false);
    setShowResult(false);
    toast.success(`Oracle is making your ${kind}…`, { duration: 2500 });

    try {
      const token = getEdgeAuthTokenSync();
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      if (kind === "image") {
        const r = await fetch(IMAGE_URL, {
          method: "POST", headers,
          body: JSON.stringify({ prompt: `${prompt}\n\n8K, ultra-detailed, photorealistic, studio lighting.` }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Image failed");
        const url = data.images?.[0]?.image_url?.url;
        if (!url) throw new Error("No image returned");
        const done: Job = { ...j, status: "done", resultUrl: url };
        setJob(done);
        await maybeSave(done);
      } else if (kind === "video") {
        // Need a starting frame — gen image first then animate
        const ir = await fetch(IMAGE_URL, { method: "POST", headers, body: JSON.stringify({ prompt }) });
        const idata = await ir.json();
        if (!ir.ok) throw new Error(idata.error || "Image step failed");
        const startUrl = idata.images?.[0]?.image_url?.url;
        if (!startUrl) throw new Error("No starting frame");
        const vr = await fetch(VIDEO_URL, {
          method: "POST", headers,
          body: JSON.stringify({ image_url: startUrl, prompt, duration: 5, ratio: "16:9" }),
        });
        const vdata = await vr.json();
        if (!vr.ok) throw new Error(vdata.error || "Video failed");
        const url = vdata.video_url;
        if (!url) throw new Error("No video returned");
        const done: Job = { ...j, status: "done", resultUrl: url };
        setJob(done);
        await maybeSave(done);
      } else {
        // Text — call oracle-chat (streaming)
        const r = await fetch(ORACLE_URL, {
          method: "POST", headers,
          body: JSON.stringify({ messages: [{ role: "user", content: prompt }], oracleName: "Oracle" }),
        });
        if (!r.ok || !r.body) throw new Error("Oracle reply failed");
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "", acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload);
              const delta = obj.choices?.[0]?.delta?.content || "";
              acc += delta;
            } catch {}
          }
        }
        const done: Job = { ...j, status: "done", resultText: acc.trim() || "(no reply)" };
        setJob(done);
        await maybeSave(done);
      }
      setShowResult(true);
    } catch (e: any) {
      setJob({ ...j, status: "error", error: e?.message || "Failed" });
      toast.error(e?.message || "Oracle task failed");
    }
  }, [user, consent]);

  const maybeSave = async (j: Job) => {
    if (consent !== "keep" || !j.resultUrl && !j.resultText) return;
    const id = await saveToLibrary({
      media_type: j.kind === "text" ? "text" : j.kind,
      title: j.prompt.slice(0, 80),
      url: j.resultUrl || j.resultText || "",
      source_page: "oracle-agent",
      metadata: { prompt: j.prompt, oracle: "agent", kind: j.kind },
    });
    lastSavedIdRef.current = id;
  };

  const deleteFromLibrary = async () => {
    if (!lastSavedIdRef.current) { toast.success("Not saved — nothing to delete."); return; }
    try {
      await supabase.from("user_media").delete().eq("id", lastSavedIdRef.current);
      lastSavedIdRef.current = null;
      toast.success("Deleted from your library.");
    } catch { toast.error("Could not delete."); }
  };

  // Hide on certain routes (Oracle's own page handles it natively)
  if (!user) return null;
  if (ORB_HIDDEN_ROUTES.some((p) => location.pathname.startsWith(p))) return null;

  const busy = job?.status === "running";

  return (
    <>
      {/* Floating orb */}
      <button
        ref={drag.ref}
        {...drag.dragHandlers}
        onClick={() => { if (!drag.justDragged) setOpen(true); }}
        style={{ ...drag.style, zIndex: 60 }}
        aria-label="Oracle Agent"
        className="select-none"
      >
        <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-700 shadow-[0_0_30px_rgba(251,191,36,0.5)] flex items-center justify-center ${busy ? "animate-pulse" : ""}`}>
          {busy && (
            <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeDasharray="40 140" strokeLinecap="round" />
            </svg>
          )}
          <Sparkles className="w-7 h-7 text-black drop-shadow" />
        </div>
        <span className="block text-[10px] mt-1 text-amber-300 font-semibold tracking-wider text-center">
          {busy ? "WORKING…" : "ORACLE"}
        </span>
      </button>

      {/* Privacy consent (first run) */}
      {askConsent && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-amber-600/40 rounded-2xl p-6 max-w-md w-full">
            <div className="text-amber-400 text-xs font-bold tracking-widest mb-2">PRIVACY • YOUR CHOICE</div>
            <h2 className="text-xl font-bold text-white mb-3">Should the Oracle keep what it makes for you?</h2>
            <p className="text-sm text-zinc-300 mb-5">
              We follow strict guidelines — <strong>we only keep what you allow us to keep</strong>.
              Pick the default. You can change this any time.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => saveConsent("keep")}
                className="w-full p-3 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2 justify-center">
                <Save className="w-4 h-4" /> Save to my Library (recommended)
              </button>
              <button onClick={() => saveConsent("auto-delete")}
                className="w-full p-3 rounded-xl bg-zinc-800 text-zinc-100 font-semibold flex items-center gap-2 justify-center">
                <Trash2 className="w-4 h-4" /> Auto-delete after I view it
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-4 text-center">
              No images, audio, or chats are sold or shared. Your library is private to you.
            </p>
          </div>
        </div>
      )}

      {/* Compact prompt sheet */}
      {open && !askConsent && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-zinc-950 border border-amber-600/40 rounded-2xl p-5 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="text-amber-300 font-bold tracking-wider text-sm">ORACLE AGENT</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-zinc-400 mb-3">
              Ask me to make <em>anything</em> — image, short video, story, plan. I work in the background and show you the result.
            </p>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { runJob(input); setInput(""); } }}
              placeholder="e.g. A cinematic 8K poster of a rottweiler in Bali sunglasses…"
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] text-zinc-500">
                Storage: <button onClick={() => setAskConsent(true)} className="underline text-amber-400">{consent === "keep" ? "Save to Library" : "Auto-delete"}</button>
              </span>
              <button
                onClick={() => { if (input.trim()) { runJob(input.trim()); setInput(""); } }}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-semibold flex items-center gap-2 disabled:opacity-40">
                <Send className="w-4 h-4" /> Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen result */}
      {showResult && job?.status === "done" && (
        <div className="fixed inset-0 z-[75] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <div className="text-amber-300 font-bold tracking-widest text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ORACLE • DONE
            </div>
            <div className="flex items-center gap-2">
              {consent === "keep" ? (
                <button onClick={deleteFromLibrary} className="text-xs text-zinc-300 hover:text-red-400 flex items-center gap-1">
                  <Trash2 className="w-4 h-4" /> Delete from Library
                </button>
              ) : (
                <span className="text-xs text-zinc-500">Will auto-delete on close</span>
              )}
              <button onClick={() => { setShowResult(false); if (consent === "auto-delete") deleteFromLibrary(); }}
                className="ml-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs">Close</button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {job.kind === "image" && job.resultUrl && (
              <img src={job.resultUrl} alt={job.prompt} className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            )}
            {job.kind === "video" && job.resultUrl && (
              <video src={job.resultUrl} controls autoPlay className="max-w-full max-h-[80vh] rounded-xl shadow-2xl" />
            )}
            {job.kind === "text" && job.resultText && (
              <div className="prose prose-invert max-w-2xl whitespace-pre-wrap text-zinc-100">{job.resultText}</div>
            )}
          </div>
          <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span className="truncate max-w-[60%]">"{job.prompt}"</span>
            {job.resultUrl && (
              <a href={job.resultUrl} target="_blank" rel="noreferrer" download
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300">
                <Download className="w-3 h-3" /> Download
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
