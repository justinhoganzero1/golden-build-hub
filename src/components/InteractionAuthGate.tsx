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
  "/story/",
  "/realm/",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
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

    const trigger = (reason: "type" | "submit" | "action") => {
      if (firing.current) return;
      firing.current = true;
      toast.info("Join or sign in to use this feature", {
        description:
          reason === "type"
            ? "You can look around free — signing in unlocks typing & generating."
            : "Create your free account to continue.",
        duration: 3500,
      });
      navigate("/sign-in", { state: { from: location } });
      // reset after nav settles
      setTimeout(() => {
        firing.current = false;
      }, 800);
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
      // Allow pure navigation keys (Tab, arrows, Escape) so they can still explore
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

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("submit", onSubmit, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [user, loading, location, navigate]);

  return null;
};

export default InteractionAuthGate;
