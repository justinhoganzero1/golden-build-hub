import { Download, Smartphone, Chrome, Apple } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useState, useEffect } from "react";
const InstallPage = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  useEffect(() => { const h = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); }; window.addEventListener("beforeinstallprompt", h); return () => window.removeEventListener("beforeinstallprompt", h); }, []);
  const handleInstall = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); } };
  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-xl bg-primary/10"><Download className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Install Solace</h1><p className="text-muted-foreground text-xs">Get the app on your device</p></div></div>
        {deferredPrompt && <button onClick={handleInstall} className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-3 mb-6"><Download className="w-5 h-5" /> Install Now</button>}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5"><div className="flex items-center gap-3 mb-3"><Chrome className="w-6 h-6 text-primary" /><h3 className="text-sm font-semibold text-foreground">Android / Chrome</h3></div><ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside"><li>Tap the menu (⋮) in Chrome</li><li>Select "Add to Home Screen"</li><li>Tap "Add" to confirm</li></ol></div>
          <div className="bg-card border border-border rounded-xl p-5"><div className="flex items-center gap-3 mb-3"><Apple className="w-6 h-6 text-primary" /><h3 className="text-sm font-semibold text-foreground">iPhone / Safari</h3></div><ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside"><li>Tap the Share button</li><li>Scroll down and tap "Add to Home Screen"</li><li>Tap "Add" to confirm</li></ol></div>
          <div className="bg-card border border-border rounded-xl p-5"><div className="flex items-center gap-3 mb-3"><Smartphone className="w-6 h-6 text-primary" /><h3 className="text-sm font-semibold text-foreground">Play Store</h3></div><p className="text-xs text-muted-foreground">Coming soon to Google Play Store!</p></div>
        </div>
      </div>
    </div>
  );
};
export default InstallPage;
