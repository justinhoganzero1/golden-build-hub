import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Film, Loader2, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  listMovieHandoffs,
  markMovieHandoffOpened,
  deleteMovieHandoff,
  stashMovieBrief,
  type MovieHandoffRecord,
} from "@/lib/movieHandoff";

interface Props {
  /** Called once a stored story has been loaded into the studio. */
  onOpenStudio: () => void;
  /** Bump to force a refresh. */
  refreshKey?: number;
}

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const SOURCE_LABEL: Record<string, string> = {
  story_writer: "Story Writer",
  library: "Library",
  director: "Oracle Director",
};

const StoryHandoffInbox = ({ onOpenStudio, refreshKey = 0 }: Props) => {
  const [items, setItems] = useState<MovieHandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await listMovieHandoffs());
    } catch (e) {
      console.error("[StoryHandoffInbox] load failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [refreshKey]);

  const open = async (item: MovieHandoffRecord) => {
    setBusy(item.id);
    try {
      stashMovieBrief(item.brief);
      await markMovieHandoffOpened(item.id);
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, opened: true } : i)));
      toast.success(`Loaded "${item.title}" into the studio`);
      onOpenStudio();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: MovieHandoffRecord) => {
    setBusy(item.id);
    try {
      await deleteMovieHandoff(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success("Removed from your Movie Maker inbox");
    } catch {
      toast.error("Could not remove that item");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking for stories sent from Story Writer…
      </Card>
    );
  }

  if (!items.length) {
    return (
      <Card className="p-4 border-dashed">
        <div className="flex items-start gap-3">
          <Inbox className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Nothing sent from Story Writer yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              In Story Writer, tap <strong>Send to Movie Maker</strong>. The story — script, cover art and
              chapter illustrations — is stored here and stays waiting until you use it.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
      <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" /> Sent from Story Writer
        <span className="text-[10px] font-normal text-muted-foreground">({items.length} saved)</span>
      </h3>
      <ul className="space-y-2">
        {items.map(item => {
          const frames = item.brief?.frames?.length ?? 0;
          const words = (item.brief?.script || "").trim().split(/\s+/).filter(Boolean).length;
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-background/40"
            >
              {item.brief?.frames?.[0] ? (
                <img
                  src={item.brief.frames[0]}
                  alt={`Cover art for ${item.title}`}
                  className="w-10 h-14 object-cover rounded shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-10 h-14 rounded bg-muted flex items-center justify-center shrink-0">
                  <Film className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {SOURCE_LABEL[item.source] || item.source} · {words.toLocaleString()} words ·{" "}
                  {frames} image{frames === 1 ? "" : "s"} · {timeAgo(item.created_at)}
                  {item.opened && " · opened"}
                </p>
              </div>
              <Button size="sm" disabled={busy === item.id} onClick={() => open(item)}>
                {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Open"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${item.title}`}
                disabled={busy === item.id}
                onClick={() => remove(item)}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export default StoryHandoffInbox;
