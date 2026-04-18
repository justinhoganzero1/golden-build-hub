import { useState } from "react";
import { Loader2, Megaphone, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oracle-chat`;

/** Simplified Marketing Genie: describe product, get ad copy. */
const StandaloneMarketing = () => {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!product.trim() || loading) return;
    setOut("");
    setLoading(true);
    try {
      const resp = await fetch(URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Generate marketing copy. Product: ${product}. Audience: ${audience || "general"}. Return: 5 catchy headlines, 3 social captions (Instagram/TikTok), 1 short email subject + body. Markdown formatted.`,
          }],
          oracleName: "Marketing",
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
            if (c) { acc += c; setOut(acc); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch {
      setOut("Connection issue — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <input
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        placeholder="What are you selling?"
        className="w-full bg-muted rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
      />
      <input
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
        placeholder="Who is it for? (optional)"
        className="w-full bg-muted rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        onClick={generate}
        disabled={loading || !product.trim()}
        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Generate copy
      </button>
      {out && (
        <div className="bg-card border border-border rounded-2xl p-5 relative">
          <button onClick={copy} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-muted">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{out}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandaloneMarketing;
