import { useEffect, useRef, useState } from "react";
import { Heart, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

const PERSONAS = [
  { name: "Alex", vibe: "supportive best friend" },
  { name: "Riley", vibe: "playful + flirty" },
  { name: "Sam", vibe: "calm, deep listener" },
  { name: "Jordan", vibe: "motivating coach" },
];

/** Simplified Companion: pick persona, chat. */
const StandaloneCompanion = () => {
  const [persona, setPersona] = useState<typeof PERSONAS[number] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !persona) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: next,
          oracleName: persona.name,
          adContext: `You are ${persona.name}, the user's AI companion. Personality: ${persona.vibe}. Warm, real, present.`,
        }),
      });
      if (!resp.ok || !resp.body) throw new Error();
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const c = JSON.parse(j).choices?.[0]?.delta?.content;
            if (c) { acc += c; setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m))); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Connection hiccup — try again." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!persona) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground text-center mb-4">Pick your companion</p>
        {PERSONAS.map((p) => (
          <button key={p.name} onClick={() => setPersona(p)} className="w-full text-left p-4 rounded-2xl border border-border bg-card hover:border-primary/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center"><Heart className="w-5 h-5" /></div>
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.vibe}</div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      <div className="text-xs text-center text-muted-foreground mb-2">Chatting with {persona.name} · <button onClick={() => { setPersona(null); setMessages([]); }} className="underline">change</button></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">Say hi to {persona.name} 💬</div>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.role === "assistant" ? <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.content || "…"}</ReactMarkdown></div> : m.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Message ${persona.name}…`} className="flex-1 bg-muted rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/40" />
        <button onClick={send} disabled={loading || !input.trim()} className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default StandaloneCompanion;
