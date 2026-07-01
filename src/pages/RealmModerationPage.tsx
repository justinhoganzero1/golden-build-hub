/**
 * RealmModerationPage — admin-only queue for reported public realms.
 * Owner (admin) reviews pending reports, opens the realm, and can take down
 * (moderation_status = 'removed', is_public = false) or dismiss the report.
 */
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Loader2, Shield, ExternalLink, CheckCircle2, XCircle, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import SEO from "@/components/SEO";
import { toast } from "sonner";

interface ReportRow {
  id: string;
  realm_id: string;
  reporter_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}
interface RealmMini {
  id: string;
  title: string;
  skybox_url: string | null;
  share_slug: string | null;
  is_public: boolean;
  moderation_status: string;
  user_id: string;
}

export default function RealmModerationPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [realms, setRealms] = useState<Record<string, RealmMini>>({});
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: rep } = await (supabase as any)
        .from("realm_reports")
        .select("id,realm_id,reporter_id,reason,details,status,created_at")
        .in("status", ["pending", "under_review"])
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (rep as ReportRow[]) ?? [];
      setReports(list);
      const ids = Array.from(new Set(list.map((r) => r.realm_id)));
      if (ids.length) {
        const { data: rl } = await (supabase as any)
          .from("user_realms")
          .select("id,title,skybox_url,share_slug,is_public,moderation_status,user_id")
          .in("id", ids);
        const m: Record<string, RealmMini> = {};
        (rl as RealmMini[] | null)?.forEach((r) => { m[r.id] = r; });
        setRealms(m);
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to="/sign-in" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  async function takedown(report: ReportRow) {
    setBusy(report.id);
    try {
      const { error: e1 } = await (supabase as any)
        .from("user_realms")
        .update({ moderation_status: "removed", is_public: false, moderation_notes: notes[report.id] ?? null })
        .eq("id", report.realm_id);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from("realm_reports")
        .update({ status: "resolved", action_taken: "taken_down", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", report.id);
      if (e2) throw e2;
      toast.success("Realm taken down");
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e: any) {
      toast.error("Takedown failed", { description: e?.message });
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(report: ReportRow) {
    setBusy(report.id);
    try {
      const { error } = await (supabase as any)
        .from("realm_reports")
        .update({ status: "dismissed", action_taken: "no_action", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
        .eq("id", report.id);
      if (error) throw error;
      toast.success("Report dismissed");
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e: any) {
      toast.error("Dismiss failed", { description: e?.message });
    } finally {
      setBusy(null);
    }
  }

  async function hide(report: ReportRow) {
    setBusy(report.id);
    try {
      const { error } = await (supabase as any)
        .from("user_realms")
        .update({ is_public: false, moderation_status: "under_review", moderation_notes: notes[report.id] ?? "Hidden pending review" })
        .eq("id", report.realm_id);
      if (error) throw error;
      toast.success("Realm hidden from public gallery");
    } catch (e: any) {
      toast.error("Hide failed", { description: e?.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      <SEO title="Realm Moderation — Admin" description="Review reported realms and take moderation actions." />
      <header className="border-b border-white/10 bg-black/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="text-white/70"><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link></Button>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-amber-400" /> Realm Moderation Queue</h1>
          <span className="ml-auto text-xs text-white/50">{reports.length} pending</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
        ) : reports.length === 0 ? (
          <Card className="p-10 text-center bg-neutral-900/70 border-white/10 text-white/60">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <p>Queue is empty. All reports have been reviewed.</p>
          </Card>
        ) : (
          reports.map((r) => {
            const realm = realms[r.realm_id];
            return (
              <Card key={r.id} className="p-4 bg-neutral-900/70 border-white/10 grid gap-3 md:grid-cols-[160px_1fr]">
                {realm?.skybox_url ? (
                  <img src={realm.skybox_url} alt="" className="w-full h-24 md:h-full rounded object-cover" />
                ) : (
                  <div className="w-full h-24 md:h-full rounded bg-white/5" />
                )}
                <div className="space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{realm?.title ?? "(deleted realm)"}</div>
                      <div className="text-[11px] text-white/40">Reason: <span className="text-amber-300">{r.reason}</span> · {new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    {realm?.share_slug && (
                      <Button asChild size="sm" variant="ghost" className="text-amber-400">
                        <Link to={`/realm/${realm.share_slug}`} target="_blank"><ExternalLink className="w-3 h-3 mr-1" /> Open</Link>
                      </Button>
                    )}
                  </div>
                  {r.details && <p className="text-sm text-white/70 whitespace-pre-wrap">{r.details}</p>}
                  <Textarea
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
                    rows={2}
                    placeholder="Moderator notes (optional)…"
                    className="bg-black/40 border-white/10 text-sm"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => takedown(r)}>
                      <XCircle className="w-4 h-4 mr-1" /> Take down
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => hide(r)} className="bg-white/10 border border-white/20">
                      <EyeOff className="w-4 h-4 mr-1" /> Hide pending review
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => dismiss(r)} className="text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Dismiss report
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}
