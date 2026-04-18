import { useState, useEffect } from "react";
import { Sparkles, Copy, ArrowRight, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type ToolKey = "ai-name" | "logo-idea" | "horoscope" | "biz-idea" | "tagline";

const TOOLS: { key: ToolKey; label: string; placeholder: string; emoji: string }[] = [
  { key: "ai-name", label: "Brand Name Generator", placeholder: "e.g. an AI yoga app for seniors", emoji: "✨" },
  { key: "tagline", label: "Tagline Writer", placeholder: "e.g. eco-friendly coffee subscription", emoji: "💬" },
  { key: "biz-idea", label: "Business Idea Spark", placeholder: "e.g. ex-teacher who loves photography", emoji: "💡" },
  { key: "horoscope", label: "Daily Horoscope", placeholder: "e.g. Leo, feeling tired this week", emoji: "🔮" },
  { key: "logo-idea", label: "Logo Concept Maker", placeholder: "e.g. minimalist coffee shop", emoji: "🎨" },
];

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-magnet`;

interface Props {
  onClose?: () => void;
  inline?: boolean;
}

export default function LeadMagnetWidget({ onClose, inline = false }: Props) {
  const navigate = useNavigate();
  const [tool, setTool] = useState<ToolKey>("ai-name");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSaveCTA, setShowSaveCTA] = useState(false);

  const cfg = TOOLS.find((t) => t.key === tool)!;

  const run = async () => {
    if (!prompt.trim() || loading) return;
    // Fort Knox: signup required to use ANY AI tool. No anonymous calls.
    toast.info("Create your free account to use this tool — 30 days Tier 3 unlocked instantly 🎉");
    navigate(`/sign-in?redirect=${encodeURIComponent("/dashboard")}`);
    return;
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Copied to clipboard");
  };

  const Wrapper = inline ? "div" : "div";

  return (
    <Wrapper className={inline ? "rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-amber-500/5 p-4" : "fixed bottom-4 right-4 w-[min(380px,calc(100vw-32px))] max-h-[80vh] overflow-y-auto rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/20 p-4 z-50"}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Free AI Tools — Sign Up to Try</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTool(t.key); setResult(null); setShowSaveCTA(false); }}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              tool === t.key
                ? "bg-primary/20 border-primary text-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {t.emoji} {t.label.split(" ")[0]}
          </button>
        ))}
      </div>

      <label className="text-xs text-muted-foreground mb-1.5 block">{cfg.label}</label>
      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && run()}
        placeholder={cfg.placeholder}
        maxLength={300}
        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      <button
        onClick={run}
        disabled={loading || !prompt.trim()}
        className="w-full mt-2 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <>Sign up free → Generate <ArrowRight className="w-4 h-4" /></>}
      </button>

      {result && (
        <div className="mt-3 p-3 rounded-lg bg-background border border-border">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-semibold text-primary">Your result</span>
            <button onClick={copy} className="text-muted-foreground hover:text-primary" aria-label="Copy">
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{result}</pre>
        </div>
      )}

      {showSaveCTA && result && (
        <div className="mt-3 p-3 rounded-lg bg-primary/15 border border-primary/40">
          <p className="text-xs text-foreground mb-2">💾 Want to save this and unlock <b>50+ more AI tools</b> free?</p>
          <button
            onClick={() => navigate("/sign-in")}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90"
          >
            Save free → Get full app
          </button>
        </div>
      )}
    </Wrapper>
  );
}
