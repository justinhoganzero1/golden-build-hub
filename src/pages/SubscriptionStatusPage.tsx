import { useEffect, useState } from "react";
import { Crown, Calendar, CreditCard, Download, RefreshCw, AlertTriangle, ExternalLink, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import OracleMoonHeader from "@/components/OracleMoonHeader";

interface Plan { name: string; amount_cents: number; interval: string | null; product_id: string; price_id: string; }
interface Invoice { id: string; number: string | null; amount_paid: number; currency: string; status: string | null; created: number; hosted_invoice_url: string | null; pdf: string | null; }
interface SubData {
  subscribed: boolean;
  status: string | null;
  plan: Plan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  customer: { id: string; email: string } | null;
  invoices: Invoice[];
}

const fmtMoney = (cents: number, ccy = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: ccy.toUpperCase() }).format(cents / 100);

export default function SubscriptionStatusPage() {
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("subscription-status");
      if (error) throw error;
      setData(res as SubData);
    } catch (e) {
      toast.error("Could not load subscription", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      const url = (res as { url?: string })?.url;
      if (url) window.open(url, "_blank");
      else throw new Error("No portal URL returned");
    } catch (e) {
      toast.error("Could not open billing portal", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Subscription Status — Oracle Lunar"
        description="View your active plan, renewal date, cancellation status, and recent invoices."
        path="/subscription"
      />
      <OracleMoonHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-amber-200 flex items-center gap-2">
            <Crown className="h-6 w-6" /> Subscription Status
          </h1>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </header>

        {loading && <p className="text-muted-foreground">Loading…</p>}

        {!loading && data && !data.subscribed && (
          <div className="rounded-2xl border border-border/40 bg-card/60 p-6 text-center">
            <p className="text-lg mb-3">You're on the free plan.</p>
            <p className="text-sm text-muted-foreground mb-4">Upgrade for unlimited AI, premium voices, and more.</p>
            <Button onClick={() => (window.location.href = "/subscribe")}>View plans</Button>
          </div>
        )}

        {!loading && data?.subscribed && data.plan && (
          <>
            <section className="rounded-2xl border border-amber-500/30 bg-card/60 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <h2 className="text-xl font-semibold">{data.plan.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {fmtMoney(data.plan.amount_cents)}{data.plan.interval ? ` / ${data.plan.interval}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${data.status === "active" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>
                  {data.status}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-4 w-4" /> Renewal</div>
                  <div className="mt-1 font-medium">
                    {data.current_period_end ? new Date(data.current_period_end).toLocaleDateString() : "—"}
                  </div>
                </div>
                <div className="rounded-lg bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground"><CreditCard className="h-4 w-4" /> Customer</div>
                  <div className="mt-1 font-medium truncate">{data.customer?.email ?? "—"}</div>
                </div>
              </div>

              {data.cancel_at_period_end && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div>
                    Your subscription is set to cancel
                    {data.cancel_at ? ` on ${new Date(data.cancel_at).toLocaleDateString()}` : " at the end of the billing period"}.
                    You'll keep access until then.
                  </div>
                </div>
              )}

              <Button onClick={openPortal} disabled={portalLoading} className="w-full sm:w-auto">
                <ExternalLink className="h-4 w-4 mr-2" />
                {portalLoading ? "Opening…" : "Manage billing & cancel"}
              </Button>
            </section>

            <section className="rounded-2xl border border-border/40 bg-card/60 p-6">
              <h3 className="text-lg font-semibold mb-3">Recent invoices</h3>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invoices yet.</p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {data.invoices.map((i) => (
                    <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium">{i.number ?? i.id}</div>
                        <div className="text-muted-foreground">{new Date(i.created * 1000).toLocaleDateString()} · {i.status}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{fmtMoney(i.amount_paid, i.currency)}</span>
                        {i.pdf && (
                          <a href={i.pdf} target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:underline inline-flex items-center gap-1">
                            <Download className="h-4 w-4" />PDF
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
