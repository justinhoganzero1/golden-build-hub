import { AlertTriangle } from "lucide-react";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * Persistent flashing red banner shown on every page when running inside the
 * Feature Preview iframe (?preview=1). Purely informational — pages still
 * render normally; individual features should call usePreviewMode() to skip
 * real network/AI/persistence calls.
 */
const PreviewModeBanner = () => {
  const isPreview = usePreviewMode();
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
