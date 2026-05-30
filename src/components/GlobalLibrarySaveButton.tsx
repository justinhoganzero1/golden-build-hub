import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FilePlus2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { saveToLibrary } from "@/lib/saveToLibrary";

/**
 * Global floating "Create Library File" pill. Visible on every authenticated
 * app/tile route, hidden on auth, landing, library and admin pages. Guarantees
 * any tile — including ones that don't yet have native "save" hooks — can
 * write a verifiable proof entry to the user's Media Library.
 */
const HIDDEN_PREFIXES = [
  "/", "/website", "/welcome", "/sign-in", "/age-required", "/consent",
  "/media-library", "/library", "/my-library", "/library/public",
  "/owner-dashboard", "/admin", "/smoke-test", "/oracle-preview",
  "/storefront", "/apps-store", "/stories",
  "/privacy-policy", "/terms-of-service", "/about", "/commandments",
  "/investor", "/creators", "/advertise", "/seo",
  "/subscribe", "/subscription-status", "/subscription-timeline",
  "/movie-payment-success", "/unlock-success", "/shop-success", "/referral",
];

const PRETTY: Record<string, string> = {
  "/oracle": "Oracle Chat",
  "/chat-oracle": "Oracle Chat",
  "/ai-companion": "AI Companion",
  "/personal-assistant": "Personal Assistant",
  "/ai-tutor": "AI Tutor",
  "/interpreter": "Interpreter",
  "/live-vision": "Live Vision",
  "/voice-studio": "Voice Studio",
  "/avatar-generator": "Avatar Generator",
  "/magic-hub": "Magic Hub",
  "/story-writer": "Story Writer",
  "/crisis-hub": "Crisis Hub",
  "/safety-center": "Safety Center",
  "/elderly-care": "Elderly Care",
  "/mind-hub": "Mind Hub",
  "/family-hub": "Family Hub",
  "/audio-filter": "Audio Filter",
  "/calendar": "Calendar",
  "/alarm-clock": "Alarm Clock",
  "/special-occasions": "Special Occasions",
  "/inventor": "Inventor",
  "/professional-hub": "Professional Hub",
  "/app-builder": "App Builder",
  "/pos-learn": "POS Learn",
  "/movie-studio-pro": "Movie Studio",
  "/youtube-show-studio": "YouTube Studio",
  "/photography-hub": "Photo Studio",
  "/video-editor": "Video Editor",
  "/marketing-hub": "Marketing Hub",
  "/creator-studio": "Creator Studio",
  "/living-gif-studio": "Living Avatar Studio",
  "/ai-studio": "AI Studio",
  "/wallet": "Wallet",
  "/vault": "Vault",
  "/personal-vault": "Personal Vault",
  "/claims-assistant": "Claims Assistant",
  "/claims-app": "Claims App",
  "/diagnostics": "Diagnostics",
  "/avatar-gallery": "Avatar Gallery",
  "/web-wrapper": "Web Wrapper",
};

const GlobalLibrarySaveButton = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  const meta = useMemo(() => {
    const clean = pathname.replace(/\/+$/, "") || "/";
    if (!user) return null;
    if (HIDDEN_PREFIXES.includes(clean)) return null;
    const label = PRETTY[clean] ?? clean.replace(/^\//, "").replace(/-/g, " ");
    const sourcePage = clean.replace(/^\//, "") || "app";
    return { label, sourcePage };
  }, [pathname, user]);

  if (!meta) return null;

  const handleClick = async () => {
    setState("saving");
    const body = `${meta.label} — Library proof file\n\nGenerated on ${new Date().toLocaleString()}\nRoute: ${pathname}`;
    const id = await saveToLibrary({
      media_type: "document",
      title: `${meta.label} — Library File`,
      url: `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`,
      source_page: meta.sourcePage,
      metadata: { kind: "library_proof", created_via: "GlobalLibrarySaveButton", route: pathname, created_at: new Date().toISOString() },
    });
    if (id) { setState("done"); toast.success("Saved to your Library"); setTimeout(() => setState("idle"), 4000); }
    else    { setState("idle"); toast.error("Could not save — try again"); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={state === "saving"}
      aria-label={`Create ${meta.label} library file`}
      className="fixed bottom-24 right-4 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-bold bg-primary/20 border border-primary/50 text-primary backdrop-blur hover:bg-primary/30 transition shadow-lg disabled:opacity-60"
    >
      {state === "saving" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
       state === "done"   ? <Check className="w-3.5 h-3.5 text-emerald-400" /> :
                            <FilePlus2 className="w-3.5 h-3.5" />}
      {state === "done" ? "Saved" : "Create Library File"}
    </button>
  );
};

export default GlobalLibrarySaveButton;
