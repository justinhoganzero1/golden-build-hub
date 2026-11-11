import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Download, Eye, EyeOff, Loader2, Play, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  ORACLE_CLIPS_BUCKET, OracleClip, clipFilename, clipSource, formatClipLength, isNewClip, lastSeenKey,
} from "@/lib/oracleClips";

const db = supabase as any;

async function playableUrl(clip: OracleClip): Promise<string> {
  const src = clipSource(clip.video_url);
  if (src.kind === "direct") return src.url;
  const { data, error } = await supabase.storage.from(ORACLE_CLIPS_BUCKET).createSignedUrl(src.path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error("This clip couldn't be opened.");
  return data.signedUrl;
}

async function posterUrl(clip: OracleClip): Promise<string | undefined> {
  if (!clip.poster_url) return undefined;
  const src = clipSource(clip.poster_url);
  if (src.kind === "direct") return src.url;
  const { data } = await supabase.storage.from(ORACLE_CLIPS_BUCKET).createSignedUrl(src.path, 60 * 60);
  return data?.signedUrl;
}

function videoLength(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
}

/** Members' Oracle video Library: Juzzy's published clips, included in membership. */
export default function OracleVideosPage() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const qc = useQueryClient();
  const [lastSeen] = useState<string | null>(() => (user ? localStorage.getItem(lastSeenKey(user.id)) : null));
  const [playing, setPlaying] = useState<{ clip: OracleClip; url: string } | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const { data: clips = [], isLoading, error } = useQuery({
    queryKey: ["oracle-clips", isAdmin],
    queryFn: async (): Promise<(OracleClip & { poster?: string })[]> => {
      const { data, error } = await db
        .from("oracle_clips")
        .select("id,title,description,video_url,poster_url,duration_seconds,is_published,published_at")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return Promise.all((data || []).map(async (c: OracleClip) => ({ ...c, poster: await posterUrl(c) })));
    },
  });

  // Remember this visit so only clips added later show as New next time.
  useEffect(() => {
    if (!user || isLoading) return;
    return () => localStorage.setItem(lastSeenKey(user.id), new Date().toISOString());
  }, [user, isLoading]);

  const newCount = useMemo(() => clips.filter((c) => c.is_published && isNewClip(c.published_at, lastSeen)).length, [clips, lastSeen]);

  const open = async (clip: OracleClip) => {
    setOpeningId(clip.id);
    try {
      setPlaying({ clip, url: await playableUrl(clip) });
    } catch (e: any) {
      toast.error(e?.message || "This clip couldn't be opened.");
    } finally {
      setOpeningId(null);
    }
  };

  const download = async (clip: OracleClip) => {
    const filename = clipFilename(clip.title);
    const src = clipSource(clip.video_url);
    let href: string;
    if (src.kind === "direct") {
      href = src.url;
    } else {
      const { data, error } = await supabase.storage.from(ORACLE_CLIPS_BUCKET).createSignedUrl(src.path, 600, { download: filename });
      if (error || !data?.signedUrl) { toast.error("Download couldn't start."); return; }
      href = data.signedUrl;
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Download started.");
  };

  const setPublished = async (clip: OracleClip, is_published: boolean) => {
    const { error } = await db.from("oracle_clips").update({ is_published }).eq("id", clip.id);
    if (error) toast.error(error.message);
    else { toast.success(is_published ? "Members can see it." : "Hidden from members."); qc.invalidateQueries({ queryKey: ["oracle-clips"] }); }
  };

  const remove = async (clip: OracleClip) => {
    if (!confirm(`Delete "${clip.title}" for everyone?`)) return;
    const src = clipSource(clip.video_url);
    const { error } = await db.from("oracle_clips").delete().eq("id", clip.id);
    if (error) { toast.error(error.message); return; }
    const paths = [src, clip.poster_url ? clipSource(clip.poster_url) : null]
      .filter((s): s is { kind: "storage"; path: string } => !!s && s.kind === "storage")
      .map((s) => s.path);
    if (paths.length) await supabase.storage.from(ORACLE_CLIPS_BUCKET).remove(paths);
    toast.success("Clip deleted.");
    qc.invalidateQueries({ queryKey: ["oracle-clips"] });
  };

  return (
    <PageShell title="Oracle Videos" subtitle="Oracle Lunar clips for members" icon={<Clapperboard className="h-5 w-5" />}>
      <SEO title="Oracle Videos — Oracle Lunar" description="Watch and download Oracle Lunar videos, included with your membership." />

      <Card className="mb-5 flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold">Included in your membership</p>
          <p className="text-muted-foreground">
            New clips are added here as they're made. You can watch and download every one at no extra cost.
          </p>
          {newCount > 0 && <p className="mt-1 font-medium text-primary">{newCount} new since your last visit</p>}
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">The videos couldn't load. Please try again shortly.</Card>
      ) : clips.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No clips yet. New ones will appear here.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {clips.map((clip) => {
            const isNew = clip.is_published && isNewClip(clip.published_at, lastSeen);
            const length = formatClipLength(clip.duration_seconds);
            return (
              <Card key={clip.id} className={`overflow-hidden border-border/60 bg-card/60 ${clip.is_published ? "" : "opacity-60"}`}>
                <button type="button" onClick={() => open(clip)} className="relative block aspect-[9/16] w-full bg-muted" aria-label={`Play ${clip.title}`}>
                  {clip.poster && <img src={clip.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                      {openingId === clip.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />}
                    </span>
                  </span>
                  {isNew && <Badge className="absolute left-1.5 top-1.5">New</Badge>}
                  {!clip.is_published && <Badge variant="secondary" className="absolute left-1.5 top-1.5">Hidden</Badge>}
                  {length && <span className="absolute bottom-1.5 right-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px]">{length}</span>}
                </button>
                <div className="space-y-1.5 p-2">
                  <p className="line-clamp-2 text-xs font-semibold">{clip.title}</p>
                  {clip.description && <p className="line-clamp-2 text-[11px] text-muted-foreground">{clip.description}</p>}
                  <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => download(clip)}>
                    <Download className="mr-1 h-3 w-3" /> Download
                  </Button>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 flex-1 text-[11px]" onClick={() => setPublished(clip, !clip.is_published)}>
                        {clip.is_published ? <><EyeOff className="mr-1 h-3 w-3" />Hide</> : <><Eye className="mr-1 h-3 w-3" />Show</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => remove(clip)} aria-label="Delete clip">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isAdmin && <div className="mt-6"><OwnerUpload onDone={() => qc.invalidateQueries({ queryKey: ["oracle-clips"] })} userId={user?.id} /></div>}

      {playing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-4" role="dialog" aria-label={playing.clip.title}>
          <div className="mb-3 flex w-full max-w-md items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{playing.clip.title}</p>
            <Button size="icon" variant="ghost" onClick={() => setPlaying(null)} aria-label="Close video"><X className="h-5 w-5" /></Button>
          </div>
          <video
            key={playing.url}
            src={playing.url}
            data-ignore-app-mute
            controls
            autoPlay
            playsInline
            onPlay={(e) => { e.currentTarget.muted = false; if (e.currentTarget.volume === 0) e.currentTarget.volume = 1; }}
            onError={() => toast.error("This clip couldn't play in this browser — try Download.")}
            className="max-h-[calc(100svh-9rem)] w-full max-w-md rounded-xl bg-background object-contain"
          />
          <Button className="mt-3" variant="outline" onClick={() => download(playing.clip)}>
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
        </div>
      )}
    </PageShell>
  );
}

function OwnerUpload({ onDone, userId }: { onDone: () => void; userId?: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  const upload = async () => {
    const video = videoRef.current?.files?.[0];
    const poster = posterRef.current?.files?.[0];
    if (!title.trim()) { toast.error("Give the clip a title."); return; }
    if (!video) { toast.error("Choose a video file."); return; }
    setBusy(true);
    try {
      const folder = crypto.randomUUID();
      const safe = (n: string) => n.replace(/[^\w.\-]+/g, "_");
      const videoPath = `${folder}/${safe(video.name)}`;
      const { error: vErr } = await supabase.storage.from(ORACLE_CLIPS_BUCKET).upload(videoPath, video, { contentType: video.type || "video/mp4" });
      if (vErr) throw vErr;
      let posterPath: string | null = null;
      if (poster) {
        posterPath = `${folder}/${safe(poster.name)}`;
        const { error: pErr } = await supabase.storage.from(ORACLE_CLIPS_BUCKET).upload(posterPath, poster, { contentType: poster.type || "image/jpeg" });
        if (pErr) throw pErr;
      }
      const { error } = await db.from("oracle_clips").insert({
        title: title.trim().slice(0, 200),
        description: description.trim() || null,
        video_url: videoPath,
        poster_url: posterPath,
        duration_seconds: await videoLength(video),
        created_by: userId ?? null,
      });
      if (error) throw error;
      toast.success("Published — members can watch it now.");
      setTitle(""); setDescription("");
      if (videoRef.current) videoRef.current.value = "";
      if (posterRef.current) posterRef.current.value = "";
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-5 space-y-3 border-dashed p-4">
      <p className="text-sm font-semibold">Add a new clip (only you see this)</p>
      <div className="space-y-1"><Label htmlFor="clip-title">Title</Label><Input id="clip-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></div>
      <div className="space-y-1"><Label htmlFor="clip-desc">Short description</Label><Textarea id="clip-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
      <div className="space-y-1"><Label htmlFor="clip-video">Video file</Label><Input id="clip-video" ref={videoRef} type="file" accept="video/*" /></div>
      <div className="space-y-1"><Label htmlFor="clip-poster">Cover picture (optional)</Label><Input id="clip-poster" ref={posterRef} type="file" accept="image/*" /></div>
      <Button onClick={upload} disabled={busy} className="w-full">
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />} Publish to members
      </Button>
    </Card>
  );
}
