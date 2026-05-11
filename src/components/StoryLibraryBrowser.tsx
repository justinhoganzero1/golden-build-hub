import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  onOpen: (id: string) => void;
  currentId?: string | null;
}

const PAGE_SIZE = 50;

const StoryLibraryBrowser = ({ onOpen, currentId }: Props) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [debounced]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["story-library-browser", user?.id, debounced, page],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("user_media")
        .select("id,title,updated_at,metadata", { count: "exact" })
        .eq("user_id", user!.id)
        .eq("source_page", "story-writer")
        .eq("media_type", "story")
        .order("updated_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (debounced) q = q.ilike("title", `%${debounced}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { items: data || [], total: count || 0 };
    },
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtDate = (s: string) => new Date(s).toLocaleDateString();

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            My Story Library
          </span>
          <span className="text-[10px] text-muted-foreground">{total} saved</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search all your stories by title..."
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground"
            />
          </div>

          {isLoading ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-3 text-center">
              {debounced ? "No matches." : "No saved stories yet — start writing and they'll appear here."}
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {items.map((it: any) => {
                const meta = (it.metadata || {}) as any;
                const chapters = Array.isArray(meta.chapters) ? meta.chapters.length : 0;
                const isCurrent = it.id === currentId;
                return (
                  <button
                    key={it.id}
                    onClick={() => onOpen(it.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      isCurrent
                        ? "bg-primary/15 border-primary/50 text-primary"
                        : "bg-card border-border text-foreground hover:bg-primary/5 hover:border-primary/40"
                    }`}
                  >
                    <span className="truncate flex-1 font-medium">
                      {it.title || "Untitled Story"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {chapters} ch · {fmtDate(it.updated_at)}
                    </span>
                  </button>
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
