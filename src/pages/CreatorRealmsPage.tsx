/**
 * CreatorRealmsPage — the creator's Stripe Connect earnings dashboard for
 * realms they've listed. Shows current balance, recent payouts, and per-realm
 * sales/payout breakdown pulled from `realm-creator-earnings`.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, DollarSign, TrendingUp, Wallet, Wand2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { toast } from "sonner";

interface PerRealm {
  realm_id: string;
  title?: string;
  view_count?: number;
  download_count?: number;
  shop_price_cents?: number;
  sales_count: number;
  gross_cents: number;
  payout_cents: number;
  platform_fee_cents: number;
  last_sale_at: string | null;
}
interface Payout {
  id: string; amount: number; currency: string; status: string;
  arrival_date: number; method: string; created: number;
}
interface EarningsResp {
  totals: { sales_count: number; gross_cents: number; payout_cents: number; platform_fee_cents: number };
  per_realm: PerRealm[];
  stripe_account_id: string | null;
  stripe_balance: { available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] } | null;
  payouts: Payout[];
}

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export default function CreatorRealmsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<EarningsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: resp, error } = await supabase.functions.invoke("realm-creator-earnings", { body: {} });
        if (error) throw error;
        setData(resp as EarningsResp);
      } catch (e: any) {
        toast.error("Could not load earnings", { description: e?.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  async function openConnect() {
    setLinking(true);
    try {
      const action = data?.stripe_account_id ? "link" : "create";
      if (action === "create") {
        await supabase.functions.invoke("connect-account", { body: { action: "create" } });
      }
      const { data: linkResp, error } = await supabase.functions.invoke("connect-account", { body: { action: "link" } });
      if (error) throw error;
      if ((linkResp as any)?.url) window.location.href = (linkResp as any).url;
    } catch (e: any) {
      toast.error("Stripe Connect error", { description: e?.message });
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-white">
      <SEO title="Creator Earnings — Realms" description="Track your realm sales, Stripe Connect payouts, and current balance." />
      <header className="border-b border-white/10 bg-black/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button asChild size="sm" variant="ghost" className="text-white/70"><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link></Button>
          <h1 className="text-lg font-semibold flex items-center gap-2"><Wallet className="w-5 h-5 text-amber-400" /> Creator Earnings — Realms</h1>
          <Button asChild size="sm" className="ml-auto bg-amber-500 hover:bg-amber-400 text-black">
            <Link to="/realm-builder"><Wand2 className="w-4 h-4 mr-1" /> Build a realm</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
        ) : !data ? (
          <Card className="p-10 text-center bg-neutral-900/70 border-white/10">No data yet.</Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total sales" value={String(data.totals.sales_count)} />
              <StatCard icon={<DollarSign className="w-4 h-4" />} label="Gross revenue" value={money(data.totals.gross_cents)} />
              <StatCard icon={<Wallet className="w-4 h-4" />} label="Your payouts (70%)" value={money(data.totals.payout_cents)} highlight />
              <StatCard icon={<DollarSign className="w-4 h-4" />} label="Platform fee (30%)" value={money(data.totals.platform_fee_cents)} />
            </div>

            <Card className="p-4 bg-neutral-900/70 border-white/10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/60">Stripe Connect balance</div>
                  <div className="text-sm text-white/50">
                    {data.stripe_account_id ? <>Account: <code className="text-amber-300">{data.stripe_account_id}</code></> : "Not connected yet"}
                  </div>
                </div>
                <Button onClick={openConnect} disabled={linking} size="sm" className="bg-white/10 hover:bg-white/20 border border-white/20" variant="secondary">
                  {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{data.stripe_account_id ? "Open Stripe dashboard" : "Connect Stripe"} <ExternalLink className="w-3 h-3 ml-1" /></>}
                </Button>
              </div>
              {data.stripe_balance ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-emerald-400/30 bg-emerald-500/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300">Available now</div>
                    <div className="text-lg font-semibold">
                      {data.stripe_balance.available.length === 0 ? "$0.00" : data.stripe_balance.available.map(b => money(b.amount, b.currency)).join(" · ")}
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-400/30 bg-amber-500/5 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-amber-300">Pending clearance</div>
                    <div className="text-lg font-semibold">
                      {data.stripe_balance.pending.length === 0 ? "$0.00" : data.stripe_balance.pending.map(b => money(b.amount, b.currency)).join(" · ")}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/50">Connect your Stripe account to receive payouts. Creators keep 70% on every sale.</p>
              )}
            </Card>

            <Card className="p-4 bg-neutral-900/70 border-white/10">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-3">Recent payouts</div>
              {data.payouts.length === 0 ? (
                <p className="text-sm text-white/50">No payouts yet. Payouts appear here once Stripe transfers funds to your bank.</p>
              ) : (
                <div className="space-y-1">
                  {data.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-white/5 text-sm">
                      <div>
                        <div className="font-medium">{money(p.amount, p.currency)}</div>
                        <div className="text-[10px] text-white/40">Arrives {new Date(p.arrival_date * 1000).toLocaleDateString()} · {p.method}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${p.status === "paid" ? "border-emerald-400/40 text-emerald-300" : "border-amber-400/40 text-amber-300"}`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 bg-neutral-900/70 border-white/10">
              <div className="text-xs uppercase tracking-wider text-white/60 mb-3">Per-realm sales</div>
              {data.per_realm.length === 0 ? (
                <p className="text-sm text-white/50">No sales yet. Publish a realm and list it in the Public Library to start earning.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] uppercase text-white/40">
                      <tr className="text-left">
                        <th className="py-2 pr-3">Realm</th>
                        <th className="py-2 pr-3">Views</th>
                        <th className="py-2 pr-3">Sales</th>
                        <th className="py-2 pr-3">Gross</th>
                        <th className="py-2 pr-3">Your 70%</th>
                        <th className="py-2 pr-3">Last sale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.per_realm.map((r) => (
                        <tr key={r.realm_id} className="border-t border-white/5">
                          <td className="py-2 pr-3 font-medium truncate max-w-[220px]">{r.title ?? r.realm_id}</td>
                          <td className="py-2 pr-3 text-white/60">{r.view_count ?? 0}</td>
                          <td className="py-2 pr-3">{r.sales_count}</td>
                          <td className="py-2 pr-3">{money(r.gross_cents)}</td>
                          <td className="py-2 pr-3 text-emerald-300 font-semibold">{money(r.payout_cents)}</td>
                          <td className="py-2 pr-3 text-white/50">{r.last_sale_at ? new Date(r.last_sale_at).toLocaleDateString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={`p-3 bg-neutral-900/70 border-white/10 ${highlight ? "ring-1 ring-amber-400/40" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1">{icon}{label}</div>
      <div className={`text-xl font-semibold mt-1 ${highlight ? "text-amber-300" : ""}`}>{value}</div>
    </Card>
  );
}
