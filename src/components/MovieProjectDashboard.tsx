// Project dashboard for Movie Studio Pro: list of user's films + per-scene progress + cost meter.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Film, Clock, DollarSign, AlertTriangle, RefreshCw, Crown } from "lucide-react";
import { toast } from "sonner";

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
  thumbnail_url?: string | null;
  last_error?: string | null;
  created_at: string;
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
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("movie_projects").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`movie_projects_${user?.id ?? ""}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "movie_projects", filter: `user_id=eq.${user?.id ?? ""}` },
        () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) return <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!projects.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" /> Your Movies ({projects.length})
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

              {p.last_error && (
                <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                  <p className="text-[10px] text-destructive">{p.last_error}</p>
                </div>
              )}

              {p.status === "completed" && p.final_video_url && (
                <Button size="sm" variant="outline" className="w-full mt-2 h-8 text-xs"
                  onClick={() => window.open(p.final_video_url!, "_blank")}>
                  <Film className="w-3 h-3 mr-1" /> View final movie
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default MovieProjectDashboard;
