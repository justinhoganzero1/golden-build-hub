import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Check { name: string; ok: boolean; detail: string; }
interface HealthResponse { checks: Check[]; all_ok: boolean; expected_webhook_url: string; account_id?: string; }
interface SummaryRow { source: string; status: string; count: number; last_at: string; }

export default function StripeHealthPanel() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const [{ data: hc, error }, { data: sum }] = await Promise.all([
        supabase.functions.invoke("stripe-health-check"),
        supabase.rpc("stripe_event_summary", { _hours: 24 }),
      ]);
      if (error) throw error;
      setData(hc as HealthResponse);
      setSummary((sum as SummaryRow[] | null) ?? []);
    } catch (e) {
      toast.error("Health check failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-card/60 p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-amber-200">Stripe Health Check</h2>
          <p className="text-sm text-muted-foreground">Webhook, portal, payouts, and connection status</p>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recheck
        </Button>
      </div>

      {data && (
        <>
          <div className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm ${data.all_ok ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
            {data.all_ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <span>{data.all_ok ? "All Stripe systems operational" : "Action needed — see failed checks below"}</span>
          </div>

          <ul className="space-y-2">
            {data.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
                {c.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="text-sm text-muted-foreground break-words">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg bg-background/40 p-3 text-xs text-muted-foreground break-all">
            <span className="text-foreground/80">Expected webhook URL:</span> {data.expected_webhook_url}
          </div>
        </>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-amber-200 mb-2">Last 24h event log</h3>
        {summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Stripe events recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left">
              <tr><th className="py-1">Source</th><th>Status</th><th>Count</th><th>Last seen</th></tr>
            </thead>
            <tbody>
              {summary.map((r, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="py-1">{r.source}</td>
                  <td className={r.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{r.status}</td>
                  <td>{r.count}</td>
                  <td className="text-muted-foreground">{new Date(r.last_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
