import { AlertTriangle } from "lucide-react";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Persistent flashing red banner shown when running inside the Feature Preview
 * iframe (?preview=1) or the Lovable editor preview. Suppressed for the admin
 * owner — the owner is always working on the real app, never in a demo shell.
 */
const PreviewModeBanner = () => {
  const isPreview = usePreviewMode();
  const { isAdmin, loading } = useIsAdmin();
  // Wait for role resolution to avoid a flash of the banner for admin.
  if (loading) return null;
  if (isAdmin) return null;
  if (!isPreview) return null;
  return (
    <div
      className="fixed top-0 inset-x-0 z-[9999] border-b border-destructive/60 bg-destructive/20 backdrop-blur px-3 py-1.5 text-center text-destructive text-[11px] font-bold tracking-wide animate-pulse flex items-center justify-center gap-2 pointer-events-none"
      role="alert"
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      DISPLAY ONLY — Preview mode. Nothing here is generated or saved.
    </div>
  );
};

export default PreviewModeBanner;

