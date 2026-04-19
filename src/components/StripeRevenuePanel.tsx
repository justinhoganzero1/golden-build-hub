import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, Loader2, RefreshCw, TrendingUp, Wallet, Users } from "lucide-react";

interface RevenueData {
  gross30Cents: number;
  net30Cents: number;
  fees30Cents: number;
  refunded30Cents: number;
  count30: number;
  gross7Cents: number;
  count7: number;
  currencyTotals: Record<string, number>;
  activeSubscriptions: number;
  availableBalance: Record<string, number>;
  pendingBalance: Record<string, number>;
  recentCharges: Array<{
    id: string;
    amount: number;
    currency: string;
    created: number;
    status: string;
    description: string | null;
    receipt_url: string | null;
  }>;
  recentPayouts: Array<{
    id: string;
    amount: number;
    currency: string;
    arrival_date: number;
    status: string;
  }>;
  generatedAt: number;
}

function fmtMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

function fmtBalance(map: Record<string, number>) {
  const entries = Object.entries(map ?? {});
  if (entries.length === 0) return "$0.00";
  return entries.map(([cur, amt]) => fmtMoney(amt, cur)).join(" · ");
}

export default function StripeRevenuePanel() {
  const { user, isReady, accessToken } = useAuthReady();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!isReady || !user || !accessToken) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("stripe-revenue", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as RevenueData);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load Stripe revenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isReady || !user || !accessToken) return;
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [isReady, user?.id, accessToken]);

  const primaryCurrency =
    data && Object.keys(data.currencyTotals).length > 0
      ? Object.keys(data.currencyTotals)[0]
      : "usd";

  return (
    <Card className="p-6 border-amber-500/20 bg-card/60 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-400" />
            Live Stripe Revenue
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Pulled directly from your Stripe account. Refreshes every 60 seconds.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </header>

      {!data && loading && (
        <div className="text-sm text-muted-foreground">Loading revenue…</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat
              icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              label="Gross (30d)"
              value={fmtMoney(data.gross30Cents, primaryCurrency)}
              sub={`${data.count30} payments`}
            />
            <Stat
              icon={<DollarSign className="w-4 h-4 text-amber-400" />}
              label="Net (30d)"
              value={fmtMoney(data.net30Cents, primaryCurrency)}
              sub={`Fees ${fmtMoney(data.fees30Cents, primaryCurrency)}`}
            />
            <Stat
              icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
              label="Last 7 days"
              value={fmtMoney(data.gross7Cents, primaryCurrency)}
              sub={`${data.count7} payments`}
            />
            <Stat
              icon={<Users className="w-4 h-4 text-purple-400" />}
              label="Active Subs"
              value={String(data.activeSubscriptions)}
              sub="Recurring"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-4 bg-background/40 border-amber-500/10">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">Available balance</span>
              </div>
              <p className="text-lg font-semibold">{fmtBalance(data.availableBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pending: {fmtBalance(data.pendingBalance)}
              </p>
            </Card>

            <Card className="p-4 bg-background/40 border-amber-500/10">
              <div className="text-sm font-medium mb-2">Recent payouts</div>
              {data.recentPayouts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payouts yet.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.recentPayouts.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>
                        {new Date(p.arrival_date * 1000).toLocaleDateString()}{" "}
                        <Badge variant="outline" className="ml-1">
                          {p.status}
                        </Badge>
                      </span>
                      <span>{fmtMoney(p.amount, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Recent charges</div>
            {data.recentCharges.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No charges in the last 30 days yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3">Date</th>
                      <th className="py-1 pr-3">Description</th>
                      <th className="py-1 pr-3 text-right">Amount</th>
                      <th className="py-1 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCharges.map((c) => (
                      <tr key={c.id} className="border-t border-amber-500/10">
                        <td className="py-1 pr-3">
                          {new Date(c.created * 1000).toLocaleDateString()}
                        </td>
                        <td className="py-1 pr-3 truncate max-w-[14rem]">
                          {c.description ?? c.id}
                        </td>
                        <td className="py-1 pr-3 text-right">
                          {fmtMoney(c.amount, c.currency)}
                        </td>
                        <td className="py-1 pr-3">
                          <Badge
                            variant={c.status === "succeeded" ? "default" : "secondary"}
                          >
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Updated {new Date(data.generatedAt * 1000).toLocaleTimeString()}
          </p>
        </>
      )}
    </Card>
  );
}

const Stat = React.forwardRef<HTMLDivElement, {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}>(({ icon, label, value, sub }, ref) => (
  <Card ref={ref} className="p-3 bg-background/40 border-amber-500/10">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {icon}
      {label}
    </div>
    <p className="text-lg font-semibold mt-1">{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </Card>
));
Stat.displayName = "Stat";
