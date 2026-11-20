// Oracle News archive — any signed-in member can search and watch published editions.
import { useEffect, useState } from "react";
import { Newspaper, Search, Loader2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { callNews } from "@/lib/newsApi";

interface Edition {
  id: string; title: string; edition_date: string; kind: string; duration_seconds: number | null; script: string;
  sources: Array<{ headline: string; links: Array<{ title: string; url: string; publisher: string | null }> }>;
  video_url: string | null; published_at: string;
}

const NewsArchive = ({ alwaysShow = false, refreshKey = 0 }: { alwaysShow?: boolean; refreshKey?: number }) => {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Edition[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = async (query = q) => {
    setLoading(true);
    try { setItems((await callNews<{ broadcasts: Edition[] }>("archive", query.trim() ? { q: query.trim() } : {})).broadcasts); }
    catch { setItems([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(""); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!alwaysShow && items !== null && items.length === 0 && !q) return null;
  if (!alwaysShow && items === null) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><Newspaper className="w-4 h-4 text-primary" /> Oracle News — past editions</div>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search past editions" onKeyDown={(e) => { if (e.key === "Enter") void load(); }} />
        <Button variant="outline" onClick={() => void load()} disabled={loading} aria-label="Search editions">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>
      {items?.length === 0 && <p className="text-xs text-muted-foreground">No published editions yet.</p>}
      <div className="space-y-3">
        {items?.map((b) => (
          <div key={b.id} className="rounded-xl border border-border p-3 space-y-2">
            <button type="button" className="w-full text-left" onClick={() => setOpen(open === b.id ? null : b.id)}>
              <p className="text-sm font-medium">{b.title}</p>
              <p className="text-[11px] text-muted-foreground">{b.edition_date}{b.duration_seconds ? ` · ${Math.max(1, Math.round(b.duration_seconds / 60))} min` : ""}{b.kind === "breaking" ? " · Breaking" : ""}</p>
            </button>
            {open === b.id && (
              <div className="space-y-2">
                {b.video_url ? <video src={b.video_url} controls playsInline className="w-full rounded-lg bg-muted" /> : <p className="text-xs text-muted-foreground">Video unavailable.</p>}
                <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Transcript</summary><p className="whitespace-pre-wrap mt-2">{b.script}</p></details>
                <details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Sources</summary>
                  <ul className="mt-2 space-y-1">
                    {b.sources.flatMap((s) => s.links).map((l) => (
                      <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">{l.publisher ? `${l.publisher}: ` : ""}{l.title} <ExternalLink className="w-3 h-3" /></a></li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
};

export default NewsArchive;
