import { useEffect } from "react";
import { toast } from "sonner";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Look-but-don't-take shield for anonymous visitors browsing inside the
 * Lovable preview.
 *
 * Preview visitors can navigate every page and see every feature, but they
 * cannot copy content out, drag/save media, print, or open devtools shortcuts.
 * Any signed-in member — paying or free-tier — is never shielded: they have
 * their own account and membership, so nothing is restricted for them.
 * The owner (admin) is never shielded either.
 */
const SHIELD_STYLE_ID = "oracle-preview-shield-style";

const PreviewShield = () => {
  const isPreview = usePreviewMode();
  const { isAdmin, loading } = useIsAdmin();
  const { user } = useAuth();

  useEffect(() => {
    if (loading || isAdmin || user || !isPreview) return;

    let warned = 0;
    const warn = (msg: string) => {
      const now = Date.now();
      if (now - warned < 2500) return;
      warned = now;
      toast.info("Preview is view-only", { description: msg, duration: 3000 });
    };

    const style = document.createElement("style");
    style.id = SHIELD_STYLE_ID;
    style.textContent = `
      body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
      img, video, canvas { -webkit-user-drag: none; user-drag: none; pointer-events: auto; }
      @media print { body { display: none !important; } }
    `;
    document.head.appendChild(style);

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      warn("Saving or copying media is disabled here.");
    };

    const onCopy = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      warn("Copying content out of the preview is disabled.");
    };

    const onDragStart = (e: DragEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "IMG" || tag === "VIDEO" || tag === "CANVAS" || tag === "A") {
        e.preventDefault();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blockedMod = mod && !e.shiftKey && ["s", "p", "u", "c", "x"].includes(k);
      const blockedInspect = (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || e.key === "F12";
      if (!blockedMod && !blockedInspect) return;

      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const editable = tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable === true;
      if (editable && blockedMod && (k === "c" || k === "x")) return;

      e.preventDefault();
      e.stopPropagation();
      warn("Saving, printing, source view and devtools shortcuts are off in preview.");
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy as EventListener, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy as EventListener, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.getElementById(SHIELD_STYLE_ID)?.remove();
    };
  }, [isPreview, isAdmin, loading, user]);

  return null;
};

export default PreviewShield;
