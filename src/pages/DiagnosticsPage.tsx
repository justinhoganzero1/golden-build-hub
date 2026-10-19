import { useEffect, useState } from "react";
import { Activity, Loader2, Play, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import UniversalBackButton from "@/components/UniversalBackButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Check = { name: string; status: string; count?: number; detail?: string };
export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [incidents, setIncidents] = useState<{ id: string; summary: string }[]>([]);
  const loadIncidents = async () => {
    const { data } = await supabase.from("system_incidents").select("id,summary").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(50);
    setIncidents(data ?? []);
  };
  useEffect(() => {
    void supabase.from("system_health_reports").select("checks").eq("source", "daily-database").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data && Array.isArray(data.checks)) setChecks(data.checks as unknown as Check[]);
    });
    void loadIncidents();
  }, []);
  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-health", { body: { check: true } });
      if (error || !data?.checks) throw new Error("Safety review could not run. Owner access is required.");
      setChecks(data.checks);
      await loadIncidents();
      toast.success("Safety review recorded. No AI, calls or payments were generated.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Review unavailable"); }
    finally { setBusy(false); }
  };
  return (
    <main className="min-h-screen bg-background pb-24 px-4 pt-16">
      <UniversalBackButton />
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center gap-3"><Activity className="text-primary w-7 h-7" /><h1 className="text-xl font-bold text-foreground">Reliability & security</h1></header>
        <p className="text-sm text-muted-foreground">Daily database review: 03:00 UTC. Availability and configuration checks do not prove real delivery or paid operations.</p>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}Run safety review</Button>
        <section className="divide-y divide-border" aria-label="Safety checks">
          {checks.map((check, i) => <div className="py-3 flex gap-3 items-start" key={`${check.name}-${i}`}>
            {check.status === "pass" ? <CheckCircle className="w-5 h-5 text-primary shrink-0" /> : <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />}
            <div><h2 className="font-medium text-sm text-foreground">{check.name}</h2><p className="text-xs text-muted-foreground">{check.status}{check.count !== undefined ? ` · ${check.count} issues` : ""}{check.detail ? ` · ${check.detail}` : ""}</p></div>
          </div>)}
          {!checks.length && <p className="py-4 text-muted-foreground text-sm">No review available yet.</p>}
        </section>
        <section aria-label="Owner alerts"><h2 className="text-lg font-semibold text-foreground">Open alerts</h2>
          {incidents.map(incident => <div className="py-3 border-b border-border flex flex-wrap items-center justify-between gap-3" key={incident.id}>
            <p className="text-sm text-foreground">{incident.summary}</p>
            <Button size="sm" variant="outline" onClick={async () => {
              const { error } = await supabase.from("system_incidents").update({ acknowledged_at: new Date().toISOString() }).eq("id", incident.id);
              if (error) toast.error("Could not acknowledge alert"); else await loadIncidents();
            }}>Acknowledge</Button>
          </div>)}
          {!incidents.length && <p className="py-3 text-sm text-muted-foreground">No open alerts.</p>}
        </section>
      </div>
    </main>
  );
}
