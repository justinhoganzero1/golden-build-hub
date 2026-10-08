import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, X, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";
import ThinkingIndicator from "@/components/ThinkingIndicator";
import { CHAT_MODELS, loadAgents, recordAgentReply, syncAgentsFromCloud, loadLocalChat, loadCloudChat, saveChat, clearChat, type ChatAgent } from "@/lib/chatAgents";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;
const AGENT_KEY = "oracle.story.agent";
type Msg = { role: "user" | "assistant"; content: string };

type Props = {
  bookId?: string;
  bookTitle: string;
  genre: string;
  premise: string;
  chapterNumber: number;
  totalChapters: number;
  chapterTitle: string;
  chapterText: string;
};

const QUICK = [
  "Edit this chapter: grammar, pacing, repetition, dialogue.",
  "Check this chapter for continuity errors.",
  "Score this chapter: hook, characters, pacing, marketability (out of 10).",
  "Suggest a stronger ending hook for this chapter.",
];

const POS_KEY = "oracle.story.agent.pos";

export default function StoryAgentPanel(p: Props) {
  const [open, setOpen] = useState(false);
  const agents = loadAgents();
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_KEY) || "builtin:juzzy-author");
  const agent: ChatAgent = agents.find((a) => a.id === agentId) ?? agents[0];
  const memKey = `story.${p.bookId || "draft"}.${agent.id}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  // Draggable pill position (closed state only)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const s = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (s && typeof s.x === "number" && typeof s.y === "number") return s;
    } catch { /* ignore */ }
    return { x: 16, y: 80 };
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);

  useEffect(() => { void syncAgentsFromCloud(); }, []);
  useEffect(() => {
    setMsgs(loadLocalChat<Msg>(memKey));
    void loadCloudChat<Msg>(memKey).then((m) => { if (m) setMsgs(m); });
  }, [memKey]);
  useEffect(() => {
    if (msgs.length && !busy) void saveChat(memKey, msgs);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy, memKey]);

  const pickAgent = (id: string) => { setAgentId(id); localStorage.setItem(AGENT_KEY, id); };

  // Drag-to-move for the closed pill (tap still opens the chat)
  const onDragStart = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    const w = e.currentTarget.offsetWidth || 100;
    const h = e.currentTarget.offsetHeight || 44;
    // Pill is anchored by right/bottom offsets, so dragging right/down shrinks them
    const x = Math.min(Math.max(d.origX - dx, 8), window.innerWidth - w - 8);
    const y = Math.min(Math.max(d.origY - dy, 8), window.innerHeight - h - 8);
    setPos({ x, y });
  };
  const onDragEnd = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) { setOpen(true); return; }
    setPos((cur) => { localStorage.setItem(POS_KEY, JSON.stringify(cur)); return cur; });
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const context =
      `[Book context — do not repeat back]\nTitle: ${p.bookTitle || "Untitled"}\nGenre: ${p.genre || "unknown"}\nPremise: ${p.premise || "-"}\n` +
      `Open chapter: ${p.chapterNumber} of ${p.totalChapters} — ${p.chapterTitle || "untitled"}\n\n${(p.chapterText || "(empty)").slice(0, 24000)}`;
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getEdgeAuthTokenSync()}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: context }, { role: "assistant", content: "Got it — I have the chapter." }, ...next.slice(-12)],
          oracleName: agent.name,
          agent: { model: agent.model, name: agent.name, personality: agent.personality },
        }),
      });
      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        toast.error(j.message || j.error || "The agent couldn't reply.");
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "", acc = "";
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const c = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
            if (c) { acc += c; setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: acc } : x))); }
          } catch { /* partial line */ }
        }
      }
      if (acc.trim()) recordAgentReply(agent, acc);
    } catch {
      toast.error("Connection problem — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        aria-label="Open author agent" title="Author agent — drag to move"
        style={{ right: pos.x, left: "auto", bottom: pos.y, top: "auto", touchAction: "none" }}
        className="fixed z-40 flex items-center justify-center h-11 w-11 rounded-full bg-accent-blue text-primary-foreground shadow-[0_0_22px_hsl(var(--accent-blue-glow)/0.45)] select-none cursor-grab active:cursor-grabbing">
        <Bot className="w-5 h-5" />
      </button>
    );
  }


  return (
    <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:right-4 sm:bottom-4 sm:w-[420px] h-[75vh] sm:h-[600px] flex flex-col rounded-t-2xl sm:rounded-2xl border border-primary/40 bg-background shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Bot className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground">Current Agent</p>
          <select aria-label="Choose agent" value={agent.id} onChange={(e) => pickAgent(e.target.value)}
            className="bg-transparent text-sm font-semibold text-foreground outline-none max-w-full">
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name} · {CHAT_MODELS.find((m) => m.id === a.model)?.label ?? ""}</option>)}
          </select>
        </div>
        <button onClick={() => { setMsgs([]); void clearChat(memKey); }} aria-label="New conversation" className="p-1.5 text-muted-foreground hover:text-foreground"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={() => setOpen(false)} aria-label="Close" className="p-1.5 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
      </div>
      <p className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border truncate">
        Reading: {p.bookTitle || "Untitled"} — Chapter {p.chapterNumber}{p.chapterTitle ? `: ${p.chapterTitle}` : ""}
      </p>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {msgs.length === 0 && (
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">Ask {agent.name} about the open chapter, or try:</p>
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} className="text-left text-xs rounded-lg border border-border px-3 py-2 hover:border-primary">{q}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl bg-primary text-primary-foreground px-3 py-2 text-sm">{m.content}</div>
            ) : (
              <div className="text-sm text-foreground">
                <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{m.content || "…"}</ReactMarkdown></div>
                {m.content && (
                  <button onClick={() => { navigator.clipboard.writeText(m.content); toast.success("Copied"); }} className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1 hover:text-primary">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border">
        <ThinkingIndicator active={busy} label="Agent Working..." />
        <div className="flex gap-2 items-end">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={`Message ${agent.name}…`}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm max-h-28 outline-none focus:border-primary" />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} aria-label="Send"
            className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">Each reply uses coins from your wallet.</p>
      </div>
    </div>
  );
}
