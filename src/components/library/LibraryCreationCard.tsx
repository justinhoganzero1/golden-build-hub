import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Globe, Image, Music, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import LibraryTileFace from "./LibraryTileFace";
import { parseStorageUrl } from "@/lib/signedStorageUrl";

export function readableLibraryTitle(title: string | null | undefined) {
  return (title || "Untitled creation").replace(/\.(html?|pdf|zip|webm|mp4|epub|txt)$/i, "").replace(/_/g, " ").replace(/\bv(\d+)\b/gi, "version $1").trim();
}

export default function LibraryCreationCard({ item, collection, busy, onOpen }: {
  item: any; collection: string; busy: boolean; onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const isApp = item.media_type === "app" || /\.html?$/i.test(item.title || "");
  const { data: detail } = useQuery({
    queryKey: ["library-card-app", item.id, item.updated_at],
    enabled: visible && isApp,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_media").select("url,metadata").eq("id", item.id).single();
      if (error) throw error;
      let html = "";
      const stored = parseStorageUrl(data.url);
      if (stored && isApp) {
        const { data: signed, error: signingError } = await supabase.storage.from(stored.bucket).createSignedUrl(stored.path, 3600);
        if (signingError || !signed?.signedUrl) throw signingError || new Error("Preview unavailable");
        const response = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("Preview unavailable");
        // Only read the opening page, not embedded full videos or entire books.
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let bytes = 0;
          try {
            while (bytes < 512_000) {
              const chunk = await reader.read();
              if (chunk.done) break;
              const remaining = 512_000 - bytes;
              html += decoder.decode(chunk.value.subarray(0, remaining), { stream: true });
              bytes += chunk.value.length;
            }
            html += decoder.decode();
          } finally { await reader.cancel(); }
        }
      }
      return { ...data, html };
    },
  });
  const metadata = (detail?.metadata || {}) as Record<string, any>;
  let storedHtml = detail?.url || "";
  if (/^data:text\/html[;,]/i.test(storedHtml)) {
    try {
      const comma = storedHtml.indexOf(",");
      const payload = storedHtml.slice(comma + 1);
      storedHtml = storedHtml.slice(0, comma).includes(";base64")
        ? new TextDecoder().decode(Uint8Array.from(atob(payload), char => char.charCodeAt(0)))
        : decodeURIComponent(payload);
    } catch { storedHtml = ""; }
  }
  const rawHtml = detail?.html || (/^\s*</.test(storedHtml) ? storedHtml : metadata.html || metadata.code);
  const html = typeof rawHtml === "string" ? rawHtml : "";
  const document = html ? new DOMParser().parseFromString(html, "text/html") : null;
  const appName = metadata.app_name || metadata.appName || document?.querySelector("title")?.textContent || document?.querySelector("h1")?.textContent;
  const title = readableLibraryTitle(item.media_type === "app" && appName ? appName : item.title);
  const imageLike = ["image", "gif"].includes(item.media_type);
  const video = item.media_type === "video";
  const thumb = item.thumbnail_url || metadata.thumbnail || metadata.screenshot || metadata.cover;
  const Icon = imageLike ? Image : isApp ? Globe : item.media_type === "audio" ? Music : FileText;
  const kind = isApp ? "App" : imageLike ? "Image" : video ? "Video" : item.media_type === "audio" ? "Audio" : item.media_type === "story" ? "Book" : item.media_type === "text" ? "Saved conversation" : "Document";
  const previewHtml = html ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">${html}<style>html{scrollbar-width:none}body{animation:none!important}*[style*="opacity: 0"]{opacity:1!important}</style>` : "";
  return (
    <div ref={ref} className="min-w-0">
      <Button variant="ghost" onClick={onOpen} disabled={busy} aria-label={`Open ${title}`} className="group w-full h-full flex flex-col items-stretch justify-start p-0 whitespace-normal overflow-hidden rounded-lg border border-border bg-card text-left hover:bg-card hover:border-primary">
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted shrink-0">
          {imageLike || thumb ? (
            <LibraryTileFace src={thumb} alt={title} size={640} mediaId={item.id} canBackfill={imageLike} fallback={<div className="h-full flex items-center justify-center"><Icon className="h-12 w-12 text-muted-foreground" /></div>} />
          ) : isApp && previewHtml ? (
            <iframe title={`${title} preview`} sandbox="" srcDoc={previewHtml} tabIndex={-1} className="w-full h-full border-0 pointer-events-none" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-4">
              <Icon className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">{isApp ? "Saved app" : kind}</p>
            </div>
          )}
          {video && <Play className="absolute inset-0 m-auto h-10 w-10 text-primary" />}
        </div>
        <div className="w-full p-4 space-y-2 border-t border-border">
          <p className="text-base font-semibold text-foreground break-words line-clamp-3 min-h-12">{title}</p>
          {isApp && appName && title !== readableLibraryTitle(item.title) && <p className="text-xs text-muted-foreground line-clamp-2 break-words">Saved as: {readableLibraryTitle(item.title)}</p>}
          <p className="text-xs text-muted-foreground break-words">{collection} · {kind}</p>
          <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{new Date(item.created_at).toLocaleDateString("en-AU")}</span><span className="text-primary font-semibold">{busy ? "Opening…" : "Open"}</span></div>
        </div>
      </Button>
    </div>
  );
}