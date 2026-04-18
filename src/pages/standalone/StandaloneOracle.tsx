import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { isDemoMode, DEMO_REPLY } from "@/lib/demoMode";

type Msg = { role: "user" | "assistant"; content: string };

/** Plastic-display Oracle for the public website.
 *  Every reply is the same: "download the app". No real AI calls. */
const StandaloneOracle = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi, I'm Eric. I only work inside the installed SOLACE app — download it and sign up to chat with me for real." },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((p) => [
      ...p,
      { role: "user", content: text },
      { role: "assistant", content: isDemoMode() ? DEMO_REPLY : "Open the installed app to chat with me for real." },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
              ) : m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask anything…"
          className="flex-1 bg-muted rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button onClick={send} disabled={!input.trim()} className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StandaloneOracle;
