import { useEffect, useState } from "react";

/**
 * Detects whether the current page is being rendered inside a preview iframe
 * (e.g., from the landing-page Feature Preview, or the Lovable editor preview).
 * When true, RequireAuth lets the visitor through so they can trial features
 * without signing in.
 *
 * Triggers when:
 *  - URL has `?preview=1`
 *  - Host is the Lovable editor preview (*.lovableproject.com / *.lovable.app / *.lovable.dev)
 */
const computePreview = (): boolean => {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(window.location.search).get("preview") === "1") return true;
  const host = window.location.hostname;
  return (
    host.endsWith(".lovableproject.com") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev")
  );
};

export const usePreviewMode = (): boolean => {
  const [isPreview, setIsPreview] = useState<boolean>(computePreview);

  useEffect(() => {
    const handler = () => setIsPreview(computePreview());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return isPreview;
};
