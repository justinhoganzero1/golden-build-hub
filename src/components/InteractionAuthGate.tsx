import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Global "look but don't touch" gate.
 *
 * Unauthenticated visitors (including Lovable preview reviewers) can freely
 * navigate every page and see every feature. The moment they try to actually
 * *use* a feature — typing into any input/textarea/contenteditable, submitting
 * any form, or clicking a button explicitly marked as an action button —
 * they get bounced to /sign-in.
 *
 * Escape hatches:
 *  - Any element (or ancestor) with `data-auth-allow` is exempt (used by the
 *    sign-in / sign-up / reset-password forms themselves).
 *  - Public routes below are exempt entirely.
 */
const PUBLIC_PATH_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/reset-password",
  "/auth",
  "/consent",
  "/privacy",
  "/terms",
  "/about",
  "/website",
  "/oracle-preview",
  "/oauth/consent",
  "/oauth/authorize",
  "/google/callback",
  "/portal",
  "/advertise",
  "/investor",
  "/story",
  "/stories",
  "/realm",
  "/realms",
];

// SEO landing pages ("try it, no signup" acquisition funnels) must allow typing.
const PUBLIC_EXACT_PATHS = new Set<string>([
  "/ai-chat-companion", "/ai-friend", "/free-ai-chat", "/ai-girlfriend", "/ai-boyfriend",
  "/character-ai-alternative", "/replika-alternative", "/ai-therapist-free", "/ai-tutor-free",
  "/free-ai-voice-chat", "/ai-app-builder", "/ai-image-generator-free", "/ai-video-generator",
  "/ai-music-generator", "/ai-coder", "/ai-3d-app-builder", "/ai-name-generator",
  "/ai-tagline-generator", "/ai-business-idea-generator", "/ai-horoscope-free", "/ai-logo-ideas",
  "/ai-companion-app", "/replika-vs-oracle-lunar", "/ai-life-coach-free", "/ai-elderly-care",
  "/ai-crisis-support", "/ai-photo-editor", "/free-seo-tools", "/ai-email-writer",
  "/chatgpt-alternative", "/gemini-alternative", "/claude-alternative", "/free-ai-app-2026",
  "/ai-for-android", "/ai-for-iphone", "/free-ai-meditation", "/ai-relationship-advice",
  "/ai-resume-builder-free", "/ai-interview-coach", "/ai-cooking-assistant",
  "/ai-travel-planner", "/ai-fitness-coach-free", "/ai-investor-pitch",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isExempt(el: EventTarget | null): boolean {
  let node = el as HTMLElement | null;
  while (node) {
    if (node.dataset && (node.dataset.authAllow !== undefined || node.getAttribute?.("data-auth-allow") !== null)) {
      // dataset check above is enough; belt & braces
      if (node.hasAttribute?.("data-auth-allow")) return true;
    }
    // Anchor tags = navigation, always allow
    if (node.tagName === "A") return true;
    node = node.parentElement;
  }
  return false;
}

export const InteractionAuthGate = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const firing = useRef(false);

  useEffect(() => {
    if (loading || user) return;
    if (isPublicPath(location.pathname)) return;

    const trigger = (reason: "type" | "submit" | "action" | "download") => {
      if (firing.current) return;
      firing.current = true;
      const messages: Record<typeof reason, { title: string; desc: string }> = {
        type:     { title: "Join or sign in to use this feature", desc: "You can look around free — signing in unlocks typing & generating." },
        submit:   { title: "Sign in to continue",                 desc: "Create your free account to submit." },
        action:   { title: "Sign in to use this",                 desc: "This action needs a free account." },
        download: { title: "Sign in to download or export",       desc: "Downloads, exports and PDFs are for members only." },
      };
      const m = messages[reason];
      toast.info(m.title, { description: m.desc, duration: 3500 });
      const redirect = encodeURIComponent(location.pathname + location.search);
      navigate(`/sign-in?redirect=${redirect}`);
      setTimeout(() => { firing.current = false; }, 800);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (t as HTMLElement).isContentEditable === true;
      if (!editable) return;
      if (isExempt(t)) return;
      if (["Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      (t as HTMLInputElement).blur?.();
      trigger("type");
    };

    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || isExempt(t)) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && !(t as HTMLElement).isContentEditable) return;
      e.preventDefault();
      trigger("type");
    };

    const onSubmit = (e: SubmitEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || isExempt(t)) return;
      e.preventDefault();
      e.stopPropagation();
      trigger("submit");
    };

    // Block downloads / exports / PDF / CSV / ZIP clicks for guests.
    const DOWNLOAD_TEXT = /\b(download|export|save as|save file|save pdf|save csv|export csv|export pdf|export zip|get zip|print|copy link)\b/i;
    const onClick = (e: MouseEvent) => {
      let node = e.target as HTMLElement | null;
      while (node) {
        if (node.hasAttribute?.("data-auth-allow")) return;
        // Native download anchor
        if (node.tagName === "A") {
          const a = node as HTMLAnchorElement;
          const href = a.getAttribute("href") || "";
          if (a.hasAttribute("download") || href.startsWith("blob:") || href.startsWith("data:")) {
            e.preventDefault();
            e.stopPropagation();
            trigger("download");
            return;
          }
        }
        // Buttons / links marked or labelled as download/export actions
        if (node.tagName === "BUTTON" || node.tagName === "A") {
          const flag =
            node.hasAttribute?.("data-requires-auth") ||
            node.hasAttribute?.("data-download");
          const label = (node.getAttribute("aria-label") || node.textContent || "").trim();
          if (flag || (label && DOWNLOAD_TEXT.test(label))) {
            e.preventDefault();
            e.stopPropagation();
            trigger("download");
            return;
          }
        }
        node = node.parentElement;
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [user, loading, location, navigate]);

  return null;
};

export default InteractionAuthGate;
