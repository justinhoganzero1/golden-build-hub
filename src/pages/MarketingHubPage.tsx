import { useState } from "react";
import { Share2, TrendingUp, BarChart3, Mail, Globe, Target, Loader2, Copy, CheckCircle } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

type ToolType = "email" | "social" | "ad" | "seo" | null;

const MarketingHubPage = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const tools = [
    { type: "email" as ToolType, icon: <Mail className="w-5 h-5" />, title: "Email Campaigns", desc: "Generate professional marketing emails", placeholder: "Describe your product/service and target audience..." },
    { type: "social" as ToolType, icon: <Globe className="w-5 h-5" />, title: "Social Media Posts", desc: "Create engaging social content", placeholder: "What do you want to post about?" },
    { type: "ad" as ToolType, icon: <Target className="w-5 h-5" />, title: "Ad Creator", desc: "AI-powered ad copy generation", placeholder: "Describe the product and goal of the ad..." },
    { type: "seo" as ToolType, icon: <BarChart3 className="w-5 h-5" />, title: "SEO Tools", desc: "Optimize your content for search", placeholder: "Paste your content or describe what you need optimized..." },
  ];

  const generate = async () => {
    if (!prompt.trim() || !activeTool) return;
    setIsLoading(true);
    setResult(null);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ type: activeTool, prompt: prompt.trim() }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Generation failed");
        return;
      }
      const data = await resp.json();
      setResult(data.result);
      toast.success("Content generated!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate content");
    } finally {
      setIsLoading(false);
    }
  };

  const copyResult = () => {
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTool = tools.find(t => t.type === activeTool);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Share2 className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Marketing Hub</h1><p className="text-muted-foreground text-xs">Grow your brand with AI</p></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-primary">2.4K</p><p className="text-[10px] text-muted-foreground">Reach</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-primary">348</p><p className="text-[10px] text-muted-foreground">Clicks</p></div>
          <div className="text-center p-3 bg-card border border-border rounded-xl"><p className="text-lg font-bold text-[hsl(var(--status-active))]">14.5%</p><p className="text-[10px] text-muted-foreground">Conv Rate</p></div>
        </div>

        {/* Active tool input */}
        {activeTool && currentTool && (
          <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">{currentTool.title}</h3>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={currentTool.placeholder}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary resize-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={generate} disabled={isLoading || !prompt.trim()}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                {isLoading ? "Generating..." : "Generate"}
              </button>
              <button onClick={() => { setActiveTool(null); setResult(null); setPrompt(""); }}
                className="px-4 py-3 bg-secondary text-foreground rounded-xl text-sm">Back</button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">Generated Content</h3>
              <button onClick={copyResult} className="text-xs text-primary flex items-center gap-1">
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-sm text-foreground/80 overflow-auto max-h-64">
              {typeof result === "string" ? (
                <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{result}</ReactMarkdown></div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          </div>
        )}

        {/* Tool grid */}
        {!activeTool && (
          <div className="space-y-3">
            {tools.map(t => (
              <button key={t.type} onClick={() => setActiveTool(t.type)}
                className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">{t.icon}</div>
                <div><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-xs text-muted-foreground">{t.desc}</p></div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketingHubPage;
