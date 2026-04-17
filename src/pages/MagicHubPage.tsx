import { useState } from "react";
import { Star, Wand2, Sparkles, Palette, Zap, Gift, Loader2, Copy, CheckCircle, ArrowLeft } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { moderatePrompt } from "@/lib/contentSafety";
import { useSaveMedia } from "@/hooks/useUserAvatars";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

type MagicTool = "art" | "story" | "color" | "transform" | "surprise" | null;

const magicTools = [
  { type: "art" as MagicTool, icon: <Wand2 className="w-6 h-6" />, title: "AI Art Generator", desc: "Create stunning artwork descriptions from text", placeholder: "Describe the artwork you want to create..." },
  { type: "story" as MagicTool, icon: <Sparkles className="w-6 h-6" />, title: "Story Writer", desc: "Generate creative stories with AI", placeholder: "Give a theme, genre, or opening line..." },
  { type: "color" as MagicTool, icon: <Palette className="w-6 h-6" />, title: "Color Palette", desc: "AI-curated color schemes for any project", placeholder: "Describe the mood, brand, or project..." },
  { type: "transform" as MagicTool, icon: <Zap className="w-6 h-6" />, title: "Quick Transform", desc: "Rewrite, summarize, translate any content", placeholder: "Paste content and say what transformation you want..." },
  { type: "surprise" as MagicTool, icon: <Gift className="w-6 h-6" />, title: "Surprise Me", desc: "Random AI-generated creative surprise", placeholder: "Optional: give a topic, or leave blank for pure surprise..." },
];

const SYSTEM_PROMPTS: Record<string, string> = {
  art: "You are a master art director. Generate a vivid, detailed art concept description based on the user's prompt. Include style, colors, composition, mood, lighting, and medium. Format beautifully with headers.",
  story: "You are a bestselling creative fiction writer. Write an engaging short story (500-800 words) based on the user's prompt. Include vivid descriptions, dialogue, and a satisfying arc.",
  color: "You are a professional color theory expert and designer. Generate a curated color palette of 6-8 colors based on the user's description. For each color provide: name, hex code, HSL values, and usage suggestion. Format as a beautiful list.",
  transform: "You are a content transformation expert. Transform the user's content exactly as they request - rewrite, summarize, translate, change tone, simplify, expand, or any other transformation. Maintain accuracy.",
  surprise: "You are the world's most creative AI. Generate something delightful and unexpected - it could be a poem, a fun fact, a mini-game concept, a recipe, a philosophical thought, a joke, a creative challenge, or anything surprising. Make it engaging and memorable.",
};

const MagicHubPage = () => {
  const [activeTool, setActiveTool] = useState<MagicTool>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const saveMedia = useSaveMedia();

  const generate = async () => {
    if (!activeTool) return;
    const userPrompt = prompt.trim() || (activeTool === "surprise" ? "Surprise me with something creative and unexpected!" : "");
    if (!userPrompt) { toast.error("Please enter a prompt"); return; }
    const mod = moderatePrompt(userPrompt);
    if (!mod.ok) { toast.error(mod.reason || "Prompt blocked by content filter"); return; }
    setIsLoading(true);
    setResult(null);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "assistant", prompt: `[${SYSTEM_PROMPTS[activeTool]}]\n\nUser request: ${userPrompt}` }),
      });
      if (!resp.ok) { toast.error("Generation failed"); return; }
      const data = await resp.json();
      const out = data.result || "No result generated";
      setResult(out);
      toast.success("✨ Magic complete!");
      // Auto-save text creation to library as a data: URL
      try {
        const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(out)}`;
        await saveMedia.mutateAsync({
          media_type: "text",
          title: `${currentTool?.title || "Magic"} — ${userPrompt.slice(0, 60)}`,
          url: dataUrl,
          source_page: "magic-hub",
          metadata: { tool: activeTool, prompt: userPrompt },
        });
      } catch { /* non-blocking */ }
    } catch { toast.error("Something went wrong"); } finally { setIsLoading(false); }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const currentTool = magicTools.find(t => t.type === activeTool);

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Star className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Magic Hub</h1><p className="text-muted-foreground text-xs">AI magic at your fingertips</p></div>
        </div>

        {activeTool && currentTool ? (
          <div className="space-y-4">
            <button onClick={() => { setActiveTool(null); setResult(null); setPrompt(""); }} className="flex items-center gap-2 text-sm text-primary"><ArrowLeft className="w-4 h-4" /> Back to tools</button>
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">{currentTool.icon}</div>
                <div><h3 className="text-sm font-semibold text-foreground">{currentTool.title}</h3><p className="text-[10px] text-muted-foreground">{currentTool.desc}</p></div>
              </div>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={currentTool.placeholder} rows={4}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm placeholder:text-muted-foreground outline-none focus:border-primary resize-none mb-3" />
              <button onClick={generate} disabled={isLoading || (!prompt.trim() && activeTool !== "surprise")}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating magic...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
              </button>
            </div>

            {result && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-foreground">✨ Result</h3>
                  <button onClick={copyResult} className="text-xs text-primary flex items-center gap-1">
                    {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="prose prose-sm prose-invert max-w-none text-sm text-foreground/90 overflow-auto max-h-96">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {magicTools.map(t => (
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
export default MagicHubPage;
