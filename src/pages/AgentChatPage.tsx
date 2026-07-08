import { useEffect, useRef, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Send, Loader2, Brain, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import AgentKeyPanel from "@/components/AgentKeyPanel";
import { getEdgeAuthTokenSync } from "@/lib/edgeAuth";

type Msg = { role: "user" | "assistant"; content: string };

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`;

const AGENTS: Record<string, {
  name: string;
  tagline: string;
  model: string;
  greeting: string;
  Icon: typeof Brain;
  accent: string;
  bubble: string;
}> = {
  nova: {
    name: "Nova",
    tagline: "GPT-5.5 · Sharp, precise, analytical",
    model: "GPT-5.5",
    greeting: "Hey — I'm Nova. I run on GPT-5.5. Best at reasoning, code, planning and careful analysis. What are we working on?",
    Icon: Brain,
    accent: "text-sky-400",
    bubble: "bg-sky-500/10 border-sky-500/30",
  },
  lyra: {
    name: "Lyra",
    tagline: "Gemini 3.5 Flash · Warm, fast, creative",
    model: "Gemini 3.5 Flash",
    greeting: "Hi! I'm Lyra ✨ I run on Gemini 3.5 Flash. Great for brainstorms, stories, quick ideas and creative energy. What shall we spark?",
    Icon: Sparkles,
    accent: "text-amber-400",
    bubble: "bg-amber-500/10 border-amber-500/30",
  },
};

const STORAGE_PREFIX = "oracle_agent_chat_";

const AgentChatPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const agent = agentId ? AGENTS[agentId] : null;

  const storageKey = agentId ? `${STORAGE_PREFIX}${agentId}` : "";

  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined" || !storageKey) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (storageKey && messages.length > 0) {
      try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-50))); } catch { /* ignore */ }
    }
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, [agentId]);

  if (!agent) return <Navigate to="/agents" replace />;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getEdgeAuthTokenSync()}`,
        },
        body: JSON.stringify({ agent: agentId, messages: next }),
      });

      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({ error: "Request failed" }));
        toast.error(j.error || j.message || "Agent unavailable");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

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
            const chunk = JSON.parse(j).choices?.[0]?.delta?.content;
            if (chunk) {
              acc += chunk;
              setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m)));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Connection error — try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([]);
    if (storageKey) { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } }
    inputRef.current?.focus();
  };

  const Icon = agent.Icon;
  const displayMessages = messages.length === 0
    ? [{ role: "assistant" as const, content: agent.greeting }]
    : messages;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEO
        title={`${agent.name} — AI Agent · Oracle Lunar`}
        description={`Chat with ${agent.name}, powered by ${agent.model}, inside Oracle Lunar.`}
        path={`/agents/${agentId}`}
      />
      <UniversalBackButton />

      <div className="px-4 pt-14 pb-3 border-b border-border/50 flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-card ${agent.accent}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">{agent.name}</h1>
          <p className="text-[11px] text-muted-foreground">{agent.tagline}</p>
        </div>
        <button
          onClick={reset}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="New conversation"
          aria-label="New conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl mx-auto w-full">
        {displayMessages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" ? (
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 border ${agent.bubble}`}>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground text-sm">
                {m.content}
              </div>
            )}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-4 py-2.5 border ${agent.bubble}`}>
              <Loader2 className={`w-4 h-4 animate-spin ${agent.accent}`} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/50 p-3 max-w-3xl mx-auto w-full">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={`Message ${agent.name}…`}
            rows={1}
            className="flex-1 resize-none bg-input border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary max-h-32"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="h-11 w-11 flex-shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
            aria-label="Send"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentChatPage;
