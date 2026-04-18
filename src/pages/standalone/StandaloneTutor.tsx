import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

/** Simplified AI Tutor: ask one question, get a clear lesson. */
const StandaloneTutor = () => {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const text = q.trim();
    if (!text || loading) return;
    setAnswer("");
    setLoading(true);
    try {
      const resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Teach me clearly and step-by-step: ${text}` }],
          oracleName: "Tutor",
        }),
      });
      if (!resp.ok || !resp.body) throw new Error();
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let acc = "";
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
            if (c) { acc += c; setAnswer(acc); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch {
      setAnswer("Connection issue — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="What do you want to learn?"
          className="flex-1 bg-muted rounded-full px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button onClick={ask} disabled={loading || !q.trim()} className="px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Teach me
        </button>
      </div>
      {answer && (
        <div className="bg-card border border-border rounded-2xl p-5 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{answer}</ReactMarkdown>
        </div>
      )}
      {!answer && !loading && (
        <div className="text-center text-muted-foreground text-sm py-12">
          Try: "Explain quantum entanglement", "How do I write a CV?", "Teach me Spanish basics"
        </div>
      )}
    </div>
  );
};

export default StandaloneTutor;
