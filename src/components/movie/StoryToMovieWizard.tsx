import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Film, Loader2, Inbox, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMovieHandoffs,
  markMovieHandoffOpened,
  deleteMovieHandoff,
  stashMovieBrief,
  type MovieHandoffRecord,
} from "@/lib/movieHandoff";
import { MOVIE_FORMATS, stashMovieFormat, type MovieFormat } from "@/lib/movieFormats";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a story + format have been chosen and stashed. */
  onReady: (story: MovieHandoffRecord, format: MovieFormat) => void;
}

const SOURCE_LABEL: Record<string, string> = {
  story_writer: "Story Writer",
  library: "Library",
  director: "Oracle Director",
};

/**
 * One button → pick a story sent from Story Writer → pick the movie style
 * (YouTube, Shorts, trailer, feature, narrated) → studio opens ready to build.
 */
const StoryToMovieWizard = ({ open, onOpenChange, onReady }: Props) => {
  const [items, setItems] = useState<MovieHandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<MovieHandoffRecord | null>(null);
  const [format, setFormat] = useState<MovieFormat | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setFormat(null);
    setLoading(true);
    listMovieHandoffs()
      .then(setItems)
      .catch(e => console.error("[StoryToMovieWizard] load failed", e))
      .finally(() => setLoading(false));
  }, [open]);

  const choose = async (fmt: MovieFormat) => {
    if (!picked) return;
    setBusy(true);
    try {
      stashMovieBrief(picked.brief);
      stashMovieFormat(fmt);
      await markMovieHandoffOpened(picked.id);
      toast.success(`"${picked.title}" loaded as a ${fmt.label}`);
      onOpenChange(false);
      onReady(picked, fmt);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Full render path: creates a real movie_projects row so the queued
   * scene-by-scene render pipeline (chunker → render jobs → stitch → final MP4
   * → YouTube kit) actually runs, instead of only the in-browser quick cut.
   */
  const queueFullRender = async (fmt: MovieFormat) => {
    if (!picked) return;
    setBusy(true);
    try {
      const minutes = Math.max(0.15, Math.round((fmt.targetSeconds / 60) * 100) / 100);
      const { data, error } = await supabase.functions.invoke("movie-project-create", {
        body: {
          title: picked.brief?.youtube?.title || picked.title,
          logline: picked.brief?.intent || "",
          genre: "story",
          target_duration_minutes: minutes,
          quality_tier: "hd",
          brief: { ...picked.brief, format: fmt, source_handoff_id: picked.id },
        },
      });
      const err = error?.message || (data as any)?.error;
      if (err) {
        toast.error(err);
        return;
      }
      stashMovieBrief(picked.brief);
      stashMovieFormat(fmt);
      await markMovieHandoffOpened(picked.id);
      toast.success(`"${picked.title}" queued as a full ${fmt.label} render — track it in Your Movies below.`);
      onOpenChange(false);
      onReady(picked, fmt);
    } catch (e: any) {
      toast.error(e?.message || "Could not queue that render");
    } finally {
      setBusy(false);
    }
  };


  const remove = async (item: MovieHandoffRecord) => {
    try {
      await deleteMovieHandoff(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {
      toast.error("Could not remove that story");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            {picked ? <Film className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
            {picked ? "Choose your movie style" : "Choose a story from Story Writer"}
          </DialogTitle>
        </DialogHeader>

        {!picked && (
          <>
            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading your stories…
              </div>
            )}

            {!loading && !items.length && (
              <Card className="p-4 border-dashed">
                <div className="flex items-start gap-3">
                  <Inbox className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">No stories sent yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Open Story Writer and tap <strong>Send to Movie Maker</strong>. Your script, cover art and
                      chapter illustrations land here and stay saved.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <ul className="space-y-2">
              {items.map(item => {
                const frames = item.brief?.frames?.length ?? 0;
                const words = (item.brief?.script || "").trim().split(/\s+/).filter(Boolean).length;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setPicked(item)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-background/40 hover:border-primary/60 hover:bg-primary/5 text-left transition-colors"
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
                          {SOURCE_LABEL[item.source] || item.source} · {words.toLocaleString()} words · {frames} image
                          {frames === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={`Remove ${item.title}`}
                        onClick={e => {
                          e.stopPropagation();
                          void remove(item);
                        }}
                        className="p-2 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {picked && !format && (
          <>
            <p className="text-xs text-muted-foreground">
              Turning <strong className="text-foreground">{picked.title}</strong> into a movie. Pick the cut you want —
              you can build more cuts from the same story later.
            </p>
            <div className="space-y-2">
              {MOVIE_FORMATS.map(f => (
                <button
                  key={f.id}
                  disabled={busy}
                  onClick={() => setFormat(f)}
                  className="w-full text-left p-3 rounded-lg border border-border/60 bg-background/40 hover:border-primary/60 hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-bold">
                    {f.emoji} {f.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{f.blurb}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {f.width}×{f.height} · about {Math.round(f.targetSeconds / 60) || 1} min target
                  </p>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)} className="text-xs">
              <ArrowLeft className="w-3 h-3 mr-2" /> Pick a different story
            </Button>
          </>
        )}

        {picked && format && (
          <>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{picked.title}</strong> · {format.emoji} {format.label}. How should we
              build it?
            </p>
            <div className="space-y-2">
              <button
                disabled={busy}
                onClick={() => void queueFullRender(format)}
                className="w-full text-left p-3 rounded-lg border border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-bold">🎬 Full movie render (YouTube-ready)</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Queues the real render pipeline: scene breakdown, narration, stitching and a finished MP4 with a
                  YouTube publish kit. Costs coins and runs in the background.
                </p>
              </button>
              <button
                disabled={busy}
                onClick={() => void choose(format)}
                className="w-full text-left p-3 rounded-lg border border-border/60 bg-background/40 hover:border-primary/60 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <p className="text-sm font-bold">⚡ Quick cut in the studio</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Builds instantly in your browser from the story's illustrations — great for a fast preview or a
                  social clip.
                </p>
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFormat(null)} className="text-xs" disabled={busy}>
              <ArrowLeft className="w-3 h-3 mr-2" /> Pick a different cut
            </Button>
            {busy && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Setting it up…
              </p>
            )}
          </>
        )}

      </DialogContent>
    </Dialog>
  );
};

export default StoryToMovieWizard;
