import { Download, Smartphone, Chrome, Apple, Wifi, HelpCircle, Link2, Watch, MessageCircle, Loader2 } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const TOOLS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tools`;

const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [aiHelp, setAiHelp] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const handleInstall = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); } };

  const askAI = async () => {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(TOOLS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "assistant", prompt: `You are a Solace app install assistant. Help the user with installation, setup, device linking, or troubleshooting. Be concise and helpful. User question: ${question.trim()}` }),
      });
      if (resp.ok) { const data = await resp.json(); setAiHelp(data.result || "I can help! Try asking a more specific question."); }
    } catch { toast.error("AI unavailable"); } finally { setLoading(false); setQuestion(""); }
  };

  const storeLinks = [
    { name: "Google Play Store", icon: <Smartphone className="w-6 h-6" />, url: "#", status: "Coming Soon" },
    { name: "Apple App Store", icon: <Apple className="w-6 h-6" />, url: "#", status: "Coming Soon" },
    { name: "Web App (PWA)", icon: <Chrome className="w-6 h-6" />, url: window.location.origin, status: "Available" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-primary/10"><Download className="w-7 h-7 text-primary" /></div>
          <div><h1 className="text-xl font-bold text-primary">Install Solace</h1><p className="text-muted-foreground text-xs">Get the app on all your devices</p></div>
        </div>

        {deferredPrompt && (
          <button onClick={handleInstall} className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-3 mb-6">
            <Download className="w-5 h-5" /> Install Now
          </button>
        )}

        {/* Store Links */}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Download</h2>
        <div className="space-y-3 mb-6">
          {storeLinks.map(s => (
            <div key={s.name} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className="text-primary">{s.icon}</div>
              <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">{s.name}</h3></div>
              <span className={`text-xs px-2 py-1 rounded-full ${s.status === "Available" ? "bg-[hsl(var(--status-active))]/20 text-[hsl(var(--status-active))]" : "bg-secondary text-muted-foreground"}`}>{s.status}</span>
            </div>
          ))}
        </div>

        {/* Install Instructions */}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Manual Install</h2>
        <div className="space-y-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3"><Chrome className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">Android / Chrome</h3></div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside"><li>Tap the menu (⋮) in Chrome</li><li>Select "Add to Home Screen"</li><li>Tap "Add" to confirm</li></ol>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3"><Apple className="w-5 h-5 text-primary" /><h3 className="text-sm font-semibold text-foreground">iPhone / Safari</h3></div>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside"><li>Tap the Share button</li><li>Scroll and tap "Add to Home Screen"</li><li>Tap "Add" to confirm</li></ol>
          </div>
        </div>

        {/* Link Another Device */}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Link Devices</h2>
        <div className="space-y-3 mb-6">
          <button onClick={() => { navigator.clipboard.writeText(window.location.origin); toast.success("Link copied! Open on your other device."); }}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
            <Link2 className="w-5 h-5 text-primary" />
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">Link Another Device</h3><p className="text-[10px] text-muted-foreground">Copy link to install on phone, tablet, or computer</p></div>
          </button>
          <button onClick={() => toast.info("Go to Settings → Wearables to connect")}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left">
            <Watch className="w-5 h-5 text-primary" />
            <div className="flex-1"><h3 className="text-sm font-semibold text-foreground">Link Wearable</h3><p className="text-[10px] text-muted-foreground">Connect Apple Watch, Fitbit, Garmin, etc.</p></div>
          </button>
        </div>

        {/* AI Help */}
        <h2 className="text-xs font-semibold text-muted-foreground uppercase mb-2">AI Install Assistant</h2>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><HelpCircle className="w-4 h-4 text-primary" /><span className="text-xs font-semibold text-foreground">Need help installing?</span></div>
          {aiHelp && <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3 text-xs text-foreground/90">{aiHelp}</div>}
          <div className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()}
              placeholder="Ask about installation..." className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary" />
            <button onClick={askAI} disabled={loading} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default InstallPage;
