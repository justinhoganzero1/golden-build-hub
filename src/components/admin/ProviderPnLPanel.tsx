import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, AlertTriangle, DollarSign, Activity } from "lucide-react";
import { formatCentsAsCoins } from "@/lib/coins";

interface PnLRow {
  service: string;
  charges_count: number;
  revenue_cents: number;
  provider_cost_cents: number;
  platform_fee_cents: number;
  margin_pct: number;
}
interface UsageRow {
  user_id: string;
  user_email: string | null;
  total_generations: number;
  total_spent_cents: number;
  services: Record<string, number> | null;
}
interface AlertRow {
  id: string;
  period_start: string;
  period_end: string;
  revenue_cents: number;
  est_provider_cost_cents: number;
  margin_pct: number;
  threshold_pct: number;
  severity: string;
  acknowledged_at: string | null;
  created_at: string;
}

const fmtUsd = (c: number) => `$${(c / 100).toFixed(2)}`;
const SAFE_MARGIN = 15;

export default function ProviderPnLPanel() {
  const [days, setDays] = useState(30);
  const [pnl, setPnl] = useState<PnLRow[]>([]);
  const [users, setUsers] = useState<UsageRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: u }, { data: a }] = await Promise.all([
      supabase.rpc("provider_pnl_summary", { _days: days }),
      supabase.rpc("user_usage_breakdown", { _days: days, _limit: 25 }),
      supabase.from("margin_alerts").select("*").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(10),
    ]);
    setPnl((p as PnLRow[]) || []);
    setUsers((u as UsageRow[]) || []);
    setAlerts((a as AlertRow[]) || []);
    // Trigger threshold check on each load
    await supabase.rpc("check_margin_and_alert", { _threshold_pct: SAFE_MARGIN, _days: days });
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const totalRev = pnl.reduce((s, r) => s + Number(r.revenue_cents), 0);
  const totalCost = pnl.reduce((s, r) => s + Number(r.provider_cost_cents), 0);
  const netMargin = totalRev > 0 ? ((totalRev - totalCost) / totalRev) * 100 : 0;
  const marginColor = netMargin >= SAFE_MARGIN ? "text-emerald-400" : netMargin >= 0 ? "text-amber-400" : "text-red-400";

  const ack = async (id: string) => {
    await supabase.from("margin_alerts").update({ acknowledged_at: new Date().toISOString() }).eq("id", id);
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-500/10 to-amber-500/10 border border-emerald-500/30 rounded-2xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-foreground">Provider P&L</h3>
          </div>
          <div className="flex gap-1">
            {[1, 7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2 py-1 rounded text-[11px] font-bold ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-card/60 rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Revenue</div>
            <div className="text-lg font-bold text-foreground">{fmtUsd(totalRev)}</div>
            <div className="text-[10px] text-muted-foreground">{formatCentsAsCoins(totalRev)}</div>
          </div>
          <div className="bg-card/60 rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Provider Cost</div>
            <div className="text-lg font-bold text-foreground">{fmtUsd(totalCost)}</div>
            <div className="text-[10px] text-muted-foreground">est.</div>
          </div>
          <div className="bg-card/60 rounded-xl p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Net Margin</div>
            <div className={`text-lg font-bold ${marginColor}`}>{netMargin.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground">target ≥ {SAFE_MARGIN}%</div>
          </div>
        </div>
      </div>

      {/* Margin alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h4 className="text-sm font-bold text-red-300">Margin Alerts ({alerts.length})</h4>
          </div>
          {alerts.map((a) => (
            <div key={a.id} className="bg-card/60 rounded-lg p-2 text-xs flex items-center justify-between">
              <div>
                <span className={`font-bold ${a.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>
                  {a.margin_pct}%
                </span>{" "}
                margin · {fmtUsd(a.revenue_cents)} rev / {fmtUsd(a.est_provider_cost_cents)} cost ·{" "}
                <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => ack(a.id)} className="px-2 py-1 rounded bg-muted text-[10px] font-bold">Ack</button>
            </div>
          ))}
        </div>
      )}

      {/* Per-service breakdown */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">Breakdown by Service</h4>
        </div>
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && pnl.length === 0 && <p className="text-xs text-muted-foreground">No charges in window.</p>}
        <div className="space-y-1">
          {pnl.map((r) => (
            <div key={r.service} className="grid grid-cols-5 gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
              <div className="font-bold text-foreground truncate">{r.service}</div>
              <div className="text-muted-foreground">{r.charges_count} calls</div>
              <div className="text-emerald-400">{fmtUsd(Number(r.revenue_cents))}</div>
              <div className="text-red-400">−{fmtUsd(Number(r.provider_cost_cents))}</div>
              <div className={`font-bold text-right ${Number(r.margin_pct) >= SAFE_MARGIN ? "text-emerald-400" : "text-amber-400"}`}>
                {Number(r.margin_pct).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top users */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">Top Users by Usage</h4>
        </div>
        {users.length === 0 && <p className="text-xs text-muted-foreground">No usage in window.</p>}
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {users.map((u) => (
            <div key={u.user_id} className="text-xs py-1.5 border-b border-border/50 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate text-foreground font-mono">{u.user_email || u.user_id.slice(0, 8)}</div>
                <div className="text-emerald-400 font-bold whitespace-nowrap">{fmtUsd(Number(u.total_spent_cents))}</div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {Number(u.total_generations)} gens
                {u.services && Object.keys(u.services).length > 0 && (
                  <> · {Object.entries(u.services).map(([s, n]) => `${s}:${n}`).join(" · ")}</>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
