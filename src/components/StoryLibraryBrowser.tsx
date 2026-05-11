import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Search, Loader2, ChevronDown, ChevronUp,
  Trash2, Copy, ArrowUpDown, Image as ImageIcon,
} from "lucide-react";

interface Props {
  onOpen: (id: string) => void;
  currentId?: string | null;
}

const PAGE_SIZE = 50;

type SortKey = "updated" | "title" | "chapters";

const StoryLibraryBrowser = ({ onOpen, currentId }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debounced, sortKey]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["story-library-browser", user?.id, debounced, page, sortKey],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("user_media")
        .select("id,title,updated_at,metadata", { count: "exact" })
        .eq("user_id", user!.id)
        .eq("source_page", "story-writer")
        .eq("media_type", "story");

      // Server-side sort for fields the DB knows. Chapter count is in JSON, sort client-side after fetch.
      if (sortKey === "title") q = q.order("title", { ascending: true });
      else q = q.order("updated_at", { ascending: false });

      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (debounced) q = q.ilike("title", `%${debounced}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
  });

  const sortedItems = useMemo(() => {
    const items = data?.items || [];
    if (sortKey !== "chapters") return items;
    return [...items].sort((a: any, b: any) => {
      const ac = Array.isArray(a.metadata?.chapters) ? a.metadata.chapters.length : 0;
      const bc = Array.isArray(b.metadata?.chapters) ? b.metadata.chapters.length : 0;
      return bc - ac;
    });
  }, [data, sortKey]);

  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtDate = (s: string) => new Date(s).toLocaleDateString();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["story-library-browser"] });
    qc.invalidateQueries({ queryKey: ["story-writer-library"] });
    qc.invalidateQueries({ queryKey: ["user-media"] });
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title || "Untitled Story"}"? This can't be undone.`)) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("user_media").delete().eq("id", id);
      if (error) throw error;
      toast.success("Story deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      const { data: src, error } = await supabase
        .from("user_media")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !src) throw error || new Error("Not found");
      const payload: any = {
        user_id: user.id,
        media_type: src.media_type,
        title: `${src.title || "Untitled Story"} (Copy)`,
        url: src.url,
        source_page: src.source_page,
        metadata: src.metadata,
      };
      const { error: insErr } = await supabase.from("user_media").insert([payload]);
      if (insErr) throw insErr;
      toast.success("Story duplicated");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">My Story Library</span>
          <span className="text-[10px] text-muted-foreground">{total} saved</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search all your stories by title..."
                className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                className="bg-background border border-border rounded-lg pl-6 pr-2 py-1.5 text-[11px] text-foreground"
                aria-label="Sort stories"
              >
                <option value="updated">Recent</option>
                <option value="title">Title A–Z</option>
                <option value="chapters">Most chapters</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : sortedItems.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-3 text-center">
              {debounced ? "No matches." : "No saved stories yet — start writing and they'll appear here."}
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
              {sortedItems.map((it: any) => {
                const meta = (it.metadata || {}) as any;
                const chapters = Array.isArray(meta.chapters) ? meta.chapters : [];
                const cover = meta.coverImage as string | undefined;
                const isCurrent = it.id === currentId;
                const busy = busyId === it.id;
                return (
                  <div
                    key={it.id}
                    className={`flex items-stretch gap-2 rounded-lg border overflow-hidden ${
                      isCurrent
                        ? "bg-primary/15 border-primary/50"
                        : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    <button
                      onClick={() => onOpen(it.id)}
                      className="shrink-0 w-12 h-16 bg-muted/30 flex items-center justify-center"
                      aria-label="Open story"
                    >
                      {cover ? (
                        <img src={cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                      )}
                    </button>
                    <button
                      onClick={() => onOpen(it.id)}
                      className="flex-1 text-left py-1.5 pr-1 min-w-0"
                    >
                      <div className={`text-xs font-medium truncate ${isCurrent ? "text-primary" : "text-foreground"}`}>
                        {it.title || "Untitled Story"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {chapters.length} ch · {fmtDate(it.updated_at)}
                      </div>
                    </button>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleDuplicate(it.id)}
                        disabled={busy}
                        className="flex-1 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40"
                        aria-label="Duplicate story"
                        title="Duplicate"
                      >
                        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(it.id, it.title)}
                        disabled={busy}
                        className="flex-1 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        aria-label="Delete story"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                className="px-2 py-1 rounded text-[11px] bg-card border border-border text-foreground disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-[10px] text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                className="px-2 py-1 rounded text-[11px] bg-card border border-border text-foreground disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StoryLibraryBrowser;
