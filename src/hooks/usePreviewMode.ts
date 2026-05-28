import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Detects whether the current page is being rendered as an unauthenticated
 * in-app Feature Preview.
 * When true, RequireAuth lets visitors trial features without signing in.
 *
 * Triggers when:
 *  - URL has `?preview=1`
 *
 * Important: signed-in users must NEVER be kept in preview/display-only mode,
 * even if the editor or iframe leaves `?preview=1` on the URL.
 */
const computePreview = (): boolean => {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
};

export const usePreviewMode = (): boolean => {
  const { user, loading } = useAuth();
  const [isPreview, setIsPreview] = useState<boolean>(computePreview);

  useEffect(() => {
    const handler = () => setIsPreview(computePreview());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return isPreview && !loading && !user;
};
