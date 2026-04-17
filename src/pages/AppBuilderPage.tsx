import { useState, useRef, useEffect, useCallback } from "react";
import { Wrench, Code, Layers, Smartphone, Wand2, Plus, Play, X, Loader2, Download, MessageCircle, Send, Bot, User, Globe, Rocket, CreditCard, DollarSign } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { toast } from "sonner";
import { useUserMedia } from "@/hooks/useUserAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

interface AppProject { id: string; name: string; type: string; description: string; code: string; created: string; mediaId?: string; isPaid?: boolean; pricePoint?: string; }

interface ChatMessage { role: "user" | "assistant"; content: string; code?: string; }

const AppBuilderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: userMedia } = useUserMedia();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [previewProject, setPreviewProject] = useState<AppProject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your Master App Builder agent. I can take you all the way from idea → built app → Play Store → paid customers.\n\nJust tell me what you want and I'll handle:\n• Building the app (HTML/JS, fully working)\n• Adding Stripe paywalls if it's a paid app\n• Wrapping it for Google Play (APK/AAB)\n• Setting up the store listing checklist\n\nTry: \"Build me a paid meditation app for $4.99/month\" or \"Make a free portfolio site I can publish to Play Store\"." }
  ]);
  const [input, setInput] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [loadedFromLibrary, setLoadedFromLibrary] = useState(false);

  // Load previously saved apps from the media library on mount
  useEffect(() => {
    if (loadedFromLibrary || !userMedia) return;
    const appMedia = userMedia.filter((m: any) => m.source_page === "app-builder" && m.media_type === "app");
    if (appMedia.length > 0) {
      const loaded: AppProject[] = appMedia.map((m: any) => {
        const meta = (m.metadata && typeof m.metadata === "object") ? m.metadata as Record<string, any> : {};
        return {
          id: m.id,
          name: m.title || "My App",
          type: "custom",
          description: meta.description || "",
          code: m.url || "",
          created: new Date(m.created_at).toLocaleDateString(),
          mediaId: m.id,
        };
      });
      setProjects(loaded);
    }
    setLoadedFromLibrary(true);
  }, [userMedia, loadedFromLibrary]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save or update app in media library
  const saveAppToLibrary = useCallback(async (project: AppProject): Promise<string | undefined> => {
    if (!user) return;
    try {
      if (project.mediaId) {
        await supabase
          .from("user_media")
          .update({
            title: project.name,
            url: project.code,
            metadata: { description: project.description, type: project.type } as any,
          })
          .eq("id", project.mediaId);
        return project.mediaId;
      } else {
        const { data, error } = await supabase
          .from("user_media")
          .insert([{
            user_id: user.id,
            media_type: "app",
            title: project.name,
            url: project.code,
            source_page: "app-builder",
            metadata: { description: project.description, type: project.type } as any,
          }])
          .select("id")
          .single();
        if (error) throw error;
        return data?.id;
      }
    } catch (e) {
      console.error("Failed to save app to library", e);
    }
  }, [user]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isBuilding) return;
    const mod = (await import("@/lib/contentSafety")).moderatePrompt(trimmed);
    if (!mod.ok) { (await import("sonner")).toast.error(mod.reason || "Prompt blocked by content filter"); return; }

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsBuilding(true);

    try {
      const conversationContext = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n");
      
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          type: "assistant",
          prompt: `You are SOLACE Master App Builder — an expert AI agent that builds complete, production-quality web apps AND walks the user from idea all the way to selling on the Play Store.

CONVERSATION SO FAR:
${conversationContext}

USER'S NEW MESSAGE: "${trimmed}"

${currentCode ? `CURRENT APP CODE (user wants to modify this):\n${currentCode.substring(0, 3000)}` : ""}

INSTRUCTIONS:
1. First, respond conversationally (2-3 sentences). If the user mentions selling, paid, subscription, premium, $, price, monetize, charge — treat the app as PAID.
2. If PAID, you MUST inject a clean Stripe Checkout paywall on every premium feature: a "Subscribe" or "Buy" button that calls a placeholder \`startCheckout()\` JS function which posts to \`/api/create-checkout\` with the price tier. Show locked badges on premium features and only unlock them when localStorage has \`solace_paid=true\`. Include a clear pricing card with the price the user mentioned (or suggest $4.99/mo if unspecified).
3. If FREE, no paywall — make every feature open.
4. Generate a COMPLETE self-contained HTML file: mobile-first, dark theme, responsive, modern animations, real production polish. Include header/main/footer. Include a "Get the App" CTA pointing to a Play Store badge placeholder so it's ready to wrap.
5. Add a tiny <meta name="solace-app-config"> tag containing JSON: {"paid": true|false, "price": "$X.XX/mo or one-time", "play_ready": true}.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
CHAT: [Your conversational response — mention paywall + Play Store steps if PAID]
CODE_START
[Complete HTML code here]
CODE_END

IMPORTANT: HTML must be 100% self-contained except Google Fonts. Make it look AMAZING and ready to publish.`
        }),
      });

      if (!resp.ok) throw new Error("Build failed");
      const data = await resp.json();
      const result = data.result || "";

      let chatText = "Here's your app!";
      let code = "";

      const chatMatch = result.match(/CHAT:\s*([\s\S]*?)(?:CODE_START|$)/);
      if (chatMatch) chatText = chatMatch[1].trim();

      const codeMatch = result.match(/CODE_START\s*([\s\S]*?)\s*CODE_END/);
      if (codeMatch) {
        code = codeMatch[1].trim();
      } else if (result.includes("<!DOCTYPE") || result.includes("<html")) {
        const htmlMatch = result.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
        if (htmlMatch) code = htmlMatch[1];
      }

      if (!code && !chatText) chatText = result.substring(0, 500);

      const assistantMsg: ChatMessage = { role: "assistant", content: chatText, code: code || undefined };
      setMessages(prev => [...prev, assistantMsg]);

      if (code) {
        setCurrentCode(code);
        const appName = trimmed.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, "").trim() || "My App";

        // Detect paid status from generated <meta name="solace-app-config">
        let isPaid = false;
        let pricePoint: string | undefined;
        const metaMatch = code.match(/<meta\s+name=["']solace-app-config["']\s+content=["']([^"']+)["']/i);
        if (metaMatch) {
          try {
            const cfg = JSON.parse(metaMatch[1].replace(/&quot;/g, '"'));
            isPaid = !!cfg.paid;
            pricePoint = cfg.price;
          } catch { /* ignore */ }
        }
        if (!isPaid && /\$\d|subscribe|paywall|premium|paid/i.test(trimmed)) isPaid = true;

        // Check if we're updating an existing project
        const existingProject = projects.find(p => p.name === appName);

        const project: AppProject = {
          id: existingProject?.id || Date.now().toString(),
          name: appName,
          type: "custom",
          description: trimmed,
          code,
          created: new Date().toLocaleDateString(),
          mediaId: existingProject?.mediaId,
          isPaid,
          pricePoint,
        };

        // Save to media library immediately
        const mediaId = await saveAppToLibrary(project);
        if (mediaId) {
          project.mediaId = mediaId;
          if (!project.id || project.id === Date.now().toString()) project.id = mediaId;
        }

        setProjects(prev => {
          const updated = [...prev];
          const existingIdx = updated.findIndex(p => p.name === appName);
          if (existingIdx >= 0) { updated[existingIdx] = project; } else { updated.unshift(project); }
          return updated;
        });
        setPreviewProject(project);
        toast.success("App saved to Media Library!");
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble building that. Could you try describing your app again?" }]);
      toast.error("Build failed — try again");
    } finally {
      setIsBuilding(false);
    }
  };

  const downloadApp = (project: AppProject) => {
    const blob = new Blob([project.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("App downloaded!");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10"><Wrench className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">App Builder</h1><p className="text-muted-foreground text-xs">Chat with AI to build full websites & apps</p></div>
        </div>
      </div>

      {/* Preview */}
      {previewProject && (
        <div className="px-4 mb-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-foreground">Live Preview: {previewProject.name}</h3>
            <div className="flex gap-2">
              <button onClick={() => downloadApp(previewProject)} className="text-xs text-primary flex items-center gap-1"><Download className="w-3 h-3" /> Download</button>
              <button onClick={() => setPreviewProject(null)} className="text-xs text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
          <iframe srcDoc={previewProject.code} className="w-full h-64 rounded-xl border border-border bg-white" sandbox="allow-scripts" title="App Preview" />

          {/* Publish & Sell panel — Web Wrapper + Stripe shortcuts */}
          <div className="mt-3 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-amber-500/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">Publish & Sell</span>
                {previewProject.isPaid && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <DollarSign className="w-2.5 h-2.5" /> PAID {previewProject.pricePoint || ""}
                  </span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  const slug = previewProject.name.replace(/\s+/g, "-").toLowerCase();
                  const placeholderUrl = `https://${slug}.lovable.app`;
                  navigate(`/web-wrapper?url=${encodeURIComponent(placeholderUrl)}&name=${encodeURIComponent(previewProject.name)}`);
                }}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
              >
                <Smartphone className="w-3.5 h-3.5" /> Wrap for Play Store
              </button>
              <button
                onClick={() => navigate("/subscribe")}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:border-primary transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" /> Stripe Setup
              </button>
              <button
                onClick={() => window.open("https://play.google.com/console/u/0/developers", "_blank")}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs hover:border-primary transition-colors"
              >
                <Globe className="w-3.5 h-3.5" /> Play Console
              </button>
              <button
                onClick={() => downloadApp(previewProject)}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-card border border-border text-foreground text-xs hover:border-primary transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download HTML
              </button>
            </div>
            {previewProject.isPaid && (
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                💳 Stripe paywall code is already injected. Click <b>Stripe Setup</b> to connect your account, then <b>Wrap for Play Store</b> to package & submit.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4" style={{ maxHeight: previewProject ? "calc(100vh - 460px)" : "calc(100vh - 200px)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-card border border-border text-foreground rounded-bl-md"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.code && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    <Code className="w-3 h-3" /> App generated ✓
                  </span>
                </div>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isBuilding && (
          <div className="flex gap-2 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Building your app...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Projects bar */}
      {projects.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-card/50">
          <div className="flex gap-2 overflow-x-auto">
            {projects.map(p => (
              <button key={p.id} onClick={() => { setPreviewProject(p); setCurrentCode(p.code); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors ${
                  previewProject?.id === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"
                }`}>
                <Code className="w-3 h-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Describe the app you want to build..."
            className="flex-1 px-4 py-3 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            disabled={isBuilding}
          />
          <button onClick={sendMessage} disabled={isBuilding || !input.trim()}
            className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 transition-colors">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default AppBuilderPage;
