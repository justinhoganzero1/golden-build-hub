import { useEffect, useState } from "react";

/**
 * Detects whether the current page is being rendered inside a preview iframe
 * from an in-app Feature Preview.
 * When true, RequireAuth lets the visitor through so they can trial features
 * without signing in.
 *
 * Triggers when:
 *  - URL has `?preview=1`
 *
 * Important: do NOT infer preview mode from the host. A signed-in user on the
 * Lovable/editor/published host must still be treated as using the real app.
 */
const computePreview = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
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
