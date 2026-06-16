// Project dashboard for Movie Studio Pro: live realtime updates, per-scene progress, retry failed scenes,
// inline MP4 player, character bible editor, trailer + YouTube publish actions when project completes.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Film, Clock, DollarSign, AlertTriangle, RefreshCw, Crown, Youtube, Play, RotateCw, Users, CreditCard } from "lucide-react";
import { toast } from "sonner";
import MovieInlinePlayer from "./MovieInlinePlayer";
import CharacterBibleEditor from "./CharacterBibleEditor";
import MoviePaymentDialog from "./MoviePaymentDialog";

interface Project {
  id: string;
  title: string;
  status: string;
  quality_tier: string;
  target_duration_minutes: number;
  total_scenes: number;
  completed_scenes: number;
  failed_scenes: number;
  spent_cost_cents: number;
  estimated_cost_cents: number;
  final_video_url?: string | null;
  trailer_url?: string | null;
  thumbnail_url?: string | null;
  last_error?: string | null;
  payment_status?: string | null;
  created_at: string;
}

interface Scene {
  id: string;
  scene_number: number;
  status: string;
  last_error?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", chunking: "Writing scenes…", queued: "Queued",
  rendering: "Rendering", stitching: "Stitching", mixing: "Mixing",
  upscaling: "Upscaling", completed: "✅ Completed", failed: "❌ Failed", paused: "Paused",
};

const QUALITY_LABEL: Record<string, string> = {
  sd: "SD 720p", hd: "HD 1080p", "4k": "4K Pro", "8k_ultimate": "🏆 ULTIMATE 8K",
};

export const MovieProjectDashboard = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [failedScenes, setFailedScenes] = useState<Record<string, Scene[]>>({});
  const [loading, setLoading] = useState(true);
  const [bibleProjectId, setBibleProjectId] = useState<string | null>(null);
  const [payProject, setPayProject] = useState<{ id: string; title: string } | null>(null);

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("movie_projects").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Project[];
    setProjects(list);
    // Pull failed scenes per project
    const failedIds = list.filter(p => p.failed_scenes > 0).map(p => p.id);
    if (failedIds.length) {
      const { data: fs } = await supabase
        .from("movie_scenes").select("id, scene_number, status, last_error, project_id")
        .in("project_id", failedIds).eq("status", "failed");
      const grouped: Record<string, Scene[]> = {};
      (fs ?? []).forEach((s: any) => {
        (grouped[s.project_id] = grouped[s.project_id] || []).push(s);
      });
      setFailedScenes(grouped);
    } else {
      setFailedScenes({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    refresh();
    // Realtime subscription on both projects and scenes
    const channel = supabase
      .channel(`movie_live_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "movie_projects", filter: `user_id=eq.${user.id}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "movie_scenes", filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const retryScene = async (sceneId: string) => {
    const { error } = await supabase.rpc("retry_failed_scene", { _scene_id: sceneId });
    if (error) toast.error(error.message);
    else toast.success("Scene re-queued — rendering will resume shortly");
    refresh();
  };

  const publishToYouTube = async (project: Project) => {
    if (!project.final_video_url) return;
    toast.loading("Preparing YouTube package…");
    const { data, error } = await supabase.functions.invoke("youtube-publish", {
      body: {
        action: "bundle",
        title: project.title,
        description: `Created with ORACLE LUNAR Movie Studio Pro`,
        tags: ["AI", "Movie", "ORACLE LUNAR"],
        video_url: project.final_video_url,
      },
    });
    toast.dismiss();
    if (error || data?.error) {
      toast.error(error?.message || data?.error);
      return;
    }
    // Open YouTube Studio with metadata copied
    if (data?.metadata_text) {
      navigator.clipboard.writeText(data.metadata_text);
      toast.success("Metadata copied! Opening YouTube Studio…");
    }
    window.open("https://studio.youtube.com/", "_blank");
  };

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!projects.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" /> Your Movies ({projects.length})
          <Badge variant="outline" className="text-[9px] ml-1">LIVE</Badge>
        </h3>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-3">
        {projects.map(p => {
          const pct = p.total_scenes > 0 ? (p.completed_scenes / p.total_scenes) * 100 : 0;
          const spent = (p.spent_cost_cents / 100).toFixed(2);
          const est = (p.estimated_cost_cents / 100).toFixed(2);
          const isUltimate = p.quality_tier === "8k_ultimate";
          const failed = failedScenes[p.id] ?? [];
          return (
            <div key={p.id} className={`p-3 rounded-lg border ${isUltimate ? "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card" : "border-border/50 bg-muted/30"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold truncate">{p.title}</h4>
                    {isUltimate && <Crown className="w-3 h-3 text-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{QUALITY_LABEL[p.quality_tier] ?? p.quality_tier}</Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {p.target_duration_minutes}min
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <DollarSign className="w-2.5 h-2.5" /> ${spent} / ~${est}
                    </span>
                  </div>
                </div>
                <Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                  {STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </div>

              {p.total_scenes > 0 && p.status !== "completed" && (
                <>
                  <Progress value={pct} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {p.completed_scenes} / {p.total_scenes} scenes
                    {p.failed_scenes > 0 && <span className="text-destructive ml-2">⚠ {p.failed_scenes} failed</span>}
                  </p>
                </>
              )}

              {failed.length > 0 && (
                <div className="mt-2 space-y-1">
                  {failed.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-1.5 rounded bg-destructive/10 border border-destructive/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-destructive">Scene #{s.scene_number} failed</p>
                        {s.last_error && <p className="text-[9px] text-muted-foreground truncate">{s.last_error}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => retryScene(s.id)}>
                        <RotateCw className="w-2.5 h-2.5 mr-1" /> Retry
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {p.last_error && !failed.length && (
                <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] text-destructive">{p.last_error}</p>
                </div>
              )}

              {p.status === "completed" && p.final_video_url && (
                <MovieInlinePlayer url={p.final_video_url} title={p.title} />
              )}

              {p.payment_status !== "paid" && p.status !== "completed" && (
                <Button size="sm" className="w-full h-9 mt-2 text-xs bg-primary"
                  onClick={() => setPayProject({ id: p.id, title: p.title })}>
                  <CreditCard className="w-3 h-3 mr-1" /> Pay & Render this movie
                </Button>
              )}

              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <Button size="sm" variant="outline" className="h-8 text-[10px]"
                  onClick={() => setBibleProjectId(p.id)}>
                  <Users className="w-3 h-3 mr-1" /> Cast
                </Button>
                {p.trailer_url && (
                  <Button size="sm" variant="outline" className="h-8 text-[10px]"
                    onClick={() => window.open(p.trailer_url!, "_blank")}>
                    <Play className="w-3 h-3 mr-1" /> Trailer
                  </Button>
                )}
                {p.status === "completed" && p.final_video_url && (
                  <Button size="sm" className="h-8 text-[10px]" onClick={() => publishToYouTube(p)}>
                    <Youtube className="w-3 h-3 mr-1" /> Publish
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {bibleProjectId && (
        <CharacterBibleEditor
          projectId={bibleProjectId}
          open={!!bibleProjectId}
          onOpenChange={(o) => !o && setBibleProjectId(null)}
        />
      )}
      {payProject && (
        <MoviePaymentDialog
          open={!!payProject}
          onOpenChange={(o) => !o && setPayProject(null)}
          projectId={payProject.id}
          projectTitle={payProject.title}
        />
      )}
    </Card>
  );
};

export default MovieProjectDashboard;
