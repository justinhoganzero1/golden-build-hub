import { useEffect, useState } from "react";

/**
 * Detects whether the current page is being rendered inside a preview iframe
 * (e.g., from the landing-page Feature Preview). When `?preview=1` is present
 * in the URL, real data fetching, AI calls, and persistence should be skipped.
 */
export const usePreviewMode = (): boolean => {
  const [isPreview, setIsPreview] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "1";
  });

  useEffect(() => {
    const handler = () => {
      setIsPreview(new URLSearchParams(window.location.search).get("preview") === "1");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return isPreview;
};
