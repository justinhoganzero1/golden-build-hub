import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { MASTER_AI_AVATAR, MASTER_AI_AVATAR_ALT } from "@/assets/master-ai-avatar";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "How do I install SOLACE on my phone?",
  "What can the Oracle do?",
  "Walk me through the Crisis Hub",
  "How much does it cost?",
];

const PortalTutorWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — I'm your **SOLACE Concierge**. Tap the mic to talk to me, or type below. I can walk you through every feature and help you install the app.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const sendRef = useRef<(t: string) => void>();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-tutor`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (resp.status === 429) {
        setMessages((p) => [...p, { role: "assistant", content: "I'm getting a lot of questions right now — please try again in a moment." }]);
        return;
      }
      if (resp.status === 402) {
        setMessages((p) => [...p, { role: "assistant", content: "The tutor is temporarily unavailable. Please try again later." }]);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let started = false;
      let done = false;

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              assistantText += delta;
              setMessages((p) => {
                if (!started) {
                  started = true;
                  return [...p, { role: "assistant", content: assistantText }];
                }
                return p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantText } : m));
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("tutor error:", err);
      setMessages((p) => [...p, { role: "assistant", content: "Sorry — I lost connection. Try asking again?" }]);
    } finally {
      setLoading(false);
    }
  };

  // ===== Speech recognition (mic) =====
  useEffect(() => { sendRef.current = send; });

  const toggleMic = async () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((p) => [...p, { role: "assistant", content: "Voice input isn't supported in this browser. Try Chrome, Edge, or Safari." }]);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "I need microphone access to listen. Please allow it in your browser settings." }]);
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText + interim);
    };
    rec.onerror = () => { setListening(false); };
    rec.onend = () => {
      setListening(false);
      const text = finalText.trim();
      if (text) sendRef.current?.(text);
      setInput("");
    };
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open SOLACE Concierge"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary pl-2 pr-5 py-2 text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:scale-105 transition-transform"
        >
          <img
            src={MASTER_AI_AVATAR}
            alt={MASTER_AI_AVATAR_ALT}
            className="h-9 w-9 rounded-full object-cover border-2 border-primary-foreground/40"
          />
          <span className="font-semibold hidden sm:inline">Ask the Concierge</span>
          <MessageCircle className="h-5 w-5 sm:hidden" />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[400px] z-50 flex flex-col rounded-2xl border border-border bg-card shadow-2xl max-h-[85vh]">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src={MASTER_AI_AVATAR}
                alt={MASTER_AI_AVATAR_ALT}
                className="h-10 w-10 rounded-full object-cover border-2 border-primary shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
              />
              <div>
                <div className="font-semibold text-foreground">SOLACE Concierge</div>
                <div className="text-xs text-muted-foreground">Your guide to every feature</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 hover:bg-secondary text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto max-w-[85%] bg-primary text-primary-foreground"
                    : "mr-auto max-w-[90%] bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {loading && (
              <div className="mr-auto rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </span>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs rounded-full border border-border bg-background px-3 py-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-border p-3"
          >
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Talk to the Concierge"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-all ${
                listening
                  ? "border-primary bg-primary text-primary-foreground animate-pulse shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
                  : "border-border bg-background text-muted-foreground hover:text-primary hover:border-primary"
              }`}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening…" : "Ask anything about SOLACE…"}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default PortalTutorWidget;
