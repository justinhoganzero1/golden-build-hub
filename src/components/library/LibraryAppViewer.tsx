import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/lib/signedStorageUrl";
import { Button } from "@/components/ui/button";

export function isLibraryApp(item: any) {
  return item?.media_type === "app" || /\.html?$/i.test(item?.metadata?.filename || item?.title || "");
}

export default function LibraryAppViewer({ item }: { item: any }) {
  const { data: html, isPending, error, refetch } = useQuery({
    queryKey: ["library-running-app", item.id, item.updated_at],
    queryFn: async ({ signal }) => {
      const embedded = item.metadata?.html || item.metadata?.code;
      if (typeof embedded === "string" && embedded.trim()) return embedded;
      const url = item.url || "";
      if (/^\s*</.test(url)) return url;
      if (/^data:text\/html[;,]/i.test(url)) {
        const comma = url.indexOf(",");
        return url.slice(0, comma).includes(";base64")
          ? new TextDecoder().decode(Uint8Array.from(atob(url.slice(comma + 1)), c => c.charCodeAt(0)))
          : decodeURIComponent(url.slice(comma + 1));
      }
      const stored = parseStorageUrl(url);
      if (!stored) throw new Error("This app has no saved page to open.");
      const { data, error } = await supabase.storage.from(stored.bucket).createSignedUrl(stored.path, 3600);
      if (error || !data?.signedUrl) throw new Error("Could not open the saved app.");
      const response = await fetch(data.signedUrl, { signal });
      if (!response.ok) throw new Error("Could not load the saved app.");
      return response.text();
    },
    retry: false,
    staleTime: 300_000,
  });
  if (isPending) return <div role="status" className="flex-1 grid place-items-center text-foreground">Opening app…</div>;
  if (error || !html) return <div className="flex-1 grid place-items-center"><div className="text-center space-y-3"><p role="alert">The saved app could not open.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div></div>;
  // Explicit opening permits interaction, but never access to the parent account.
  const page = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src data: https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; connect-src 'none'; form-action 'none';">${html}`;
  return <iframe title={`${item.title} working app`} srcDoc={page} sandbox="allow-scripts allow-downloads allow-modals" allow="autoplay" className="w-full flex-1 min-h-0 border-0 bg-background" />;
}