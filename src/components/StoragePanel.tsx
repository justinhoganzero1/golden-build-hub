import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, Download, FileText, Image as ImageIcon, Film, Music, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface StoragePanelProps {
  /** Filter by source_page values (one or more). */
  sourcePages: string[];
  /** Optional filter by media_type values. */
  mediaTypes?: string[];
  /** Section title. */
  title?: string;
  /** Optional callback when an item is clicked (e.g. to load into editor). */
  onLoad?: (item: any) => void;
  /** Empty state message. */
  emptyText?: string;
  /** Show thumbnails (true) or compact chips (false). */
  thumbnails?: boolean;
  /** Max items to fetch. */
  limit?: number;
}

const iconFor = (type: string) => {
  switch (type) {
    case "image":
    case "gif":
      return <ImageIcon className="w-3 h-3" />;
    case "video":
      return <Film className="w-3 h-3" />;
    case "audio":
      return <Music className="w-3 h-3" />;
    default:
      return <FileText className="w-3 h-3" />;
  }
};

const StoragePanel = ({
  sourcePages,
  mediaTypes,
  title = "Your Saved Items",
  onLoad,
  emptyText = "Nothing saved yet — generations will appear here automatically.",
  thumbnails = true,
  limit = 30,
}: StoragePanelProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const queryKey = ["storage-panel", user?.id, sourcePages.join(","), (mediaTypes || []).join(",")];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("user_media")
        .select("id,title,url,thumbnail_url,media_type,source_page,metadata,created_at,updated_at")
        .eq("user_id", user!.id)
        .in("source_page", sourcePages)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (mediaTypes && mediaTypes.length > 0) q = q.in("media_type", mediaTypes);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item from your storage? This can't be undone.")) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("user_media").delete().eq("id", id);
      if (error) throw error;
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["user-media"] });
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleClick = (item: any) => {
    if (onLoad) {
      onLoad(item);
      return;
    }
    // Default: open URL if it looks browsable
    const url = item.url || "";
    if (/^https?:\/\//.test(url) || /^data:/.test(url)) {
      window.open(url, "_blank");
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground text-center">
        Sign in to use Storage.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-primary">📦 {title}</p>
        <span className="text-[10px] text-muted-foreground">{items.length} saved</span>
      </div>

      {isLoading ? (
        <div className="py-4 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3">{emptyText}</p>
      ) : thumbnails ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((it: any) => {
            const thumb = it.thumbnail_url || (it.media_type === "image" || it.media_type === "gif" ? it.url : null);
            return (
              <div key={it.id} className="shrink-0 w-24 group relative">
                <button
                  onClick={() => handleClick(it)}
                  className="block w-24 h-24 rounded-lg overflow-hidden bg-muted border border-border hover:border-primary/60"
                  title={it.title || "Untitled"}
                >
                  {thumb && /^(https?:|data:)/.test(thumb) ? (
                    <img src={thumb} alt={it.title || ""} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      {iconFor(it.media_type)}
                    </div>
                  )}
                </button>
                <p className="mt-1 text-[10px] text-foreground truncate" title={it.title}>
                  {it.title || "Untitled"}
                </p>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  {it.url && /^https?:/.test(it.url) && (
                    <a
                      href={it.url}
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded bg-background/80 text-foreground hover:bg-primary hover:text-primary-foreground"
                      aria-label="Download"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(it.id); }}
                    disabled={busyId === it.id}
                    className="p-1 rounded bg-background/80 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Delete"
                  >
                    {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card border border-border">
              <button
                onClick={() => handleClick(it)}
                className="flex-1 flex items-center gap-2 text-left text-xs text-foreground hover:text-primary truncate"
              >
                {iconFor(it.media_type)}
                <span className="truncate">{it.title || "Untitled"}</span>
              </button>
              <button
                onClick={() => handleDelete(it.id)}
                disabled={busyId === it.id}
                className="p-1 rounded text-destructive hover:bg-destructive/10"
                aria-label="Delete"
              >
                {busyId === it.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoragePanel;
