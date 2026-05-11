import { useEffect, useMemo, useState } from "react";
import { Loader2, Receipt, RefreshCw, Sparkles, Search } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChargeRow {
  id: string;
  service: string;
  provider_cost_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  metadata: Record<string, any> | null;
  created_at: string;
}

const fmt$ = (cents: number) => `$${(cents / 100).toFixed(4)}`;

const AdminUsageAuditPage = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyBypass, setOnlyBypass] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_charges")
        .select("id, service, provider_cost_cents, platform_fee_cents, total_cents, metadata, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows((data || []) as ChargeRow[]);
    } catch (err: any) {
      toast.error(err?.message || "Could not load usage audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (onlyBypass && !r.metadata?.unlimited_bypass) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return (
        r.service.toLowerCase().includes(needle) ||
        JSON.stringify(r.metadata || {}).toLowerCase().includes(needle)
      );
    });
  }, [rows, q, onlyBypass]);

  const totals = useMemo(() => {
    let billed = 0, free = 0, calls = filtered.length;
    for (const r of filtered) {
      if (r.metadata?.unlimited_bypass) free += r.provider_cost_cents + r.platform_fee_cents;
      else billed += r.total_cents;
    }
    return { billed, free, calls };
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Receipt className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Oracle Lunar Usage Audit</h1>
            <p className="text-muted-foreground text-xs">Every paid AI tool call on this account, with the amount that was charged or bypassed.</p>
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-primary" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Calls</p>
            <p className="text-2xl font-bold text-foreground">{totals.calls}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Billed</p>
            <p className="text-2xl font-bold text-primary">{fmt$(totals.billed)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-[10px] text-emerald-400 uppercase tracking-wide flex items-center gap-1"><Sparkles className="w-3 h-3" /> Bypassed</p>
            <p className="text-2xl font-bold text-emerald-400">{fmt$(totals.free)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search service or metadata…"
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-xl px-3 py-2">
            <input type="checkbox" checked={onlyBypass} onChange={e => setOnlyBypass(e.target.checked)} />
            Only bypassed
          </label>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No charges match.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">When</th>
                    <th className="text-left px-3 py-2 font-medium">Service</th>
                    <th className="text-right px-3 py-2 font-medium">Provider</th>
                    <th className="text-right px-3 py-2 font-medium">Fee</th>
                    <th className="text-right px-3 py-2 font-medium">Charged</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const bypassed = !!r.metadata?.unlimited_bypass;
                    return (
                      <tr key={r.id} className="border-t border-border/60 hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-foreground font-medium">{r.service}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt$(r.provider_cost_cents)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{fmt$(r.platform_fee_cents)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${bypassed ? "text-emerald-400" : "text-primary"}`}>
                          {bypassed ? "$0.0000" : fmt$(r.total_cents)}
                        </td>
                        <td className="px-3 py-2">
                          {bypassed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                              <Sparkles className="w-3 h-3" /> Unlimited
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Billed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          Bypassed entries are role-based — anyone with the admin role or an active <code>free_for_life</code> / <code>unlimited_ai</code> reward grant is charged $0 (still logged here for audit).
        </p>
      </div>
    </div>
  );
};

export default AdminUsageAuditPage;
