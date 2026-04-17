import { useState } from "react";
import { Share2, TrendingUp, BarChart3, Mail, Globe, Target, Loader2, Copy, CheckCircle, ArrowLeft, Megaphone, PenTool, Search, Users, Calendar, Hash, MessageSquare, FileText, Zap } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { moderatePrompt } from "@/lib/contentSafety";
import { useSaveMedia } from "@/hooks/useUserAvatars";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

type ToolType = "email" | "social" | "ad" | "seo" | "content_calendar" | "hashtag" | "competitor" | "landing_page" | "brand_voice" | "ab_test" | null;

const tools = [
  { type: "email" as ToolType, icon: <Mail className="w-5 h-5" />, title: "Email Campaigns", desc: "Full email sequence generator with subject lines, CTAs, and A/B variants", placeholder: "Describe your product, audience, and campaign goal...", sys: "You are a world-class email marketing expert. Generate a complete email campaign with: 1) Subject line + 3 variants 2) Preview text 3) Full HTML-friendly email body with compelling copy 4) CTA buttons 5) A/B test suggestions. Use proven frameworks like AIDA, PAS. Include personalization tokens. Format beautifully." },
  { type: "social" as ToolType, icon: <Globe className="w-5 h-5" />, title: "Social Media Suite", desc: "Platform-optimized posts for Instagram, TikTok, LinkedIn, X, Facebook", placeholder: "What's the topic? Which platforms?", sys: "You are a viral social media strategist. Generate platform-specific posts for Instagram, TikTok, LinkedIn, X (Twitter), and Facebook. Each post should: include optimal hashtags, have platform-specific formatting, include emoji strategy, suggest best posting time, include hook/caption/CTA. Generate 2 variants per platform." },
  { type: "ad" as ToolType, icon: <Target className="w-5 h-5" />, title: "Ad Creator Pro", desc: "Google Ads, Meta Ads, TikTok Ads with targeting suggestions", placeholder: "Product/service, target audience, budget range...", sys: "You are an elite paid advertising specialist. Generate ad copy for: Google Search Ads (headlines + descriptions fitting character limits), Meta/Facebook Ads (primary text, headline, description), TikTok Ads (hook scripts). Include: targeting audience suggestions, negative keywords, bid strategy recommendations, and estimated CPC ranges." },
  { type: "seo" as ToolType, icon: <Search className="w-5 h-5" />, title: "SEO Dominator", desc: "Keyword research, meta tags, content briefs, schema markup", placeholder: "Your website/topic and target keywords...", sys: "You are a top SEO consultant. Provide: 1) Keyword research with search volume estimates and difficulty 2) Optimized title tag and meta description 3) H1-H3 heading structure 4) Content brief with word count targets 5) Internal linking suggestions 6) Schema markup JSON-LD 7) Featured snippet optimization tips. Be specific and actionable." },
  { type: "content_calendar" as ToolType, icon: <Calendar className="w-5 h-5" />, title: "Content Calendar", desc: "30-day content calendar with topics, formats, and timing", placeholder: "Your industry, brand, and content goals...", sys: "You are a content strategist. Create a detailed 30-day content calendar with: daily topics, content format (video/blog/carousel/reel/story), platform, posting time, content pillar category, hashtag sets, and engagement hooks. Include themed weeks and viral trend opportunities." },
  { type: "hashtag" as ToolType, icon: <Hash className="w-5 h-5" />, title: "Hashtag Research", desc: "Optimized hashtag sets with reach estimates", placeholder: "Your niche, post topic, and platform...", sys: "You are a hashtag research expert. Generate 5 hashtag sets of 30 each: 1) High volume (1M+ posts) 2) Medium competition 3) Niche/long-tail 4) Trending/timely 5) Brand-able/unique. Include estimated reach, competition level, and posting strategy." },
  { type: "competitor" as ToolType, icon: <Users className="w-5 h-5" />, title: "Competitor Analysis", desc: "SWOT analysis and counter-strategy generator", placeholder: "Your brand and competitors to analyze...", sys: "You are a competitive intelligence analyst. Provide: 1) SWOT analysis framework 2) Content gap analysis 3) Messaging differentiation strategy 4) Price positioning suggestions 5) Audience overlap analysis 6) Counter-positioning strategy 7) Quick wins to exploit competitor weaknesses." },
  { type: "landing_page" as ToolType, icon: <FileText className="w-5 h-5" />, title: "Landing Page Copy", desc: "High-converting landing page copy with wireframe", placeholder: "Product/service, target audience, main CTA...", sys: "You are a conversion rate optimization expert. Generate complete landing page copy including: 1) Hero section (headline, subheadline, CTA) 2) Social proof section 3) Features/benefits with icons 4) Objection handling FAQ 5) Testimonial templates 6) Final CTA section 7) Page wireframe layout description. Use proven conversion frameworks." },
  { type: "brand_voice" as ToolType, icon: <PenTool className="w-5 h-5" />, title: "Brand Voice Guide", desc: "Define and document your unique brand personality", placeholder: "Describe your brand, values, and target audience...", sys: "You are a brand strategist. Create a comprehensive brand voice guide including: 1) Brand personality traits (3-5) 2) Tone of voice spectrum 3) Do's and Don'ts 4) Sample phrases and word preferences 5) Emoji usage guidelines 6) Response templates for common scenarios 7) Voice adaptation for each platform." },
  { type: "ab_test" as ToolType, icon: <Zap className="w-5 h-5" />, title: "A/B Test Ideas", desc: "Data-driven testing hypotheses for maximum conversion", placeholder: "Current page/campaign performance and goals...", sys: "You are a growth hacking expert. Generate 10 A/B test ideas with: 1) Hypothesis 2) Variable to test 3) Expected impact (high/medium/low) 4) Implementation difficulty 5) Minimum sample size estimate 6) Success metric. Prioritize by expected impact. Include both quick wins and long-term experiments." },
];

const MarketingHubPage = () => {
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{type: string; result: string; date: string}[]>([]);
  const saveMedia = useSaveMedia();

  const generate = async () => {
    if (!prompt.trim() || !activeTool) return;
    const mod = moderatePrompt(prompt);
    if (!mod.ok) { toast.error(mod.reason || "Prompt blocked by content filter"); return; }
    setIsLoading(true); setResult(null);
    const tool = tools.find(t => t.type === activeTool);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "assistant", prompt: `[${tool?.sys}]\n\nUser request: ${prompt.trim()}` }),
      });
      if (!resp.ok) { toast.error("Generation failed"); return; }
      const data = await resp.json();
      const r = data.result || "No result";
      setResult(r);
      setHistory(prev => [{ type: tool?.title || "", result: r, date: new Date().toLocaleString() }, ...prev].slice(0, 20));
      toast.success("Content generated! 🚀");
      try {
        const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(r)}`;
        await saveMedia.mutateAsync({
          media_type: "text",
          title: `${tool?.title || "Marketing"} — ${prompt.trim().slice(0, 60)}`,
          url: dataUrl,
          source_page: "marketing-hub",
          metadata: { tool: activeTool, prompt: prompt.trim() },
        });
      } catch { /* non-blocking */ }
    } catch { toast.error("Failed"); } finally { setIsLoading(false); }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 2000);
  };

  const currentTool = tools.find(t => t.type === activeTool);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Megaphone className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Marketing Hub</h1><p className="text-muted-foreground text-xs">The most advanced AI marketing suite</p></div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-card border border-border rounded-xl"><p className="text-sm font-bold text-primary">{history.length}</p><p className="text-[9px] text-muted-foreground">Generated</p></div>
          <div className="text-center p-2 bg-card border border-border rounded-xl"><p className="text-sm font-bold text-primary">10</p><p className="text-[9px] text-muted-foreground">Tools</p></div>
          <div className="text-center p-2 bg-card border border-border rounded-xl"><p className="text-sm font-bold text-primary">∞</p><p className="text-[9px] text-muted-foreground">Platforms</p></div>
          <div className="text-center p-2 bg-card border border-border rounded-xl"><p className="text-sm font-bold text-[hsl(var(--status-active))]">AI</p><p className="text-[9px] text-muted-foreground">Powered</p></div>
        </div>

        {activeTool && currentTool ? (
          <div className="space-y-4">
            <button onClick={() => { setActiveTool(null); setResult(null); setPrompt(""); }} className="flex items-center gap-2 text-sm text-primary"><ArrowLeft className="w-4 h-4" /> All Tools</button>
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1">{currentTool.title}</h3>
              <p className="text-[10px] text-muted-foreground mb-3">{currentTool.desc}</p>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={currentTool.placeholder} rows={4}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary resize-none mb-3" />
              <button onClick={generate} disabled={isLoading || !prompt.trim()}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><TrendingUp className="w-4 h-4" /> Generate</>}
              </button>
            </div>
            {result && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">Generated Content</h3>
                  <button onClick={copyResult} className="text-xs text-primary flex items-center gap-1">{copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}</button>
                </div>
                <div className="prose prose-sm prose-invert max-w-none text-sm overflow-auto max-h-[50vh]"><ReactMarkdown>{result}</ReactMarkdown></div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tools.map(t => (
              <button key={t.type} onClick={() => setActiveTool(t.type)}
                className="bg-card border border-border rounded-xl p-3 text-left hover:border-primary transition-colors">
                <div className="text-primary mb-2">{t.icon}</div>
                <h3 className="text-xs font-semibold text-foreground">{t.title}</h3>
                <p className="text-[9px] text-muted-foreground mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default MarketingHubPage;
