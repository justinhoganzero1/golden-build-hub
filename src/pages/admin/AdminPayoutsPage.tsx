import { useCallback, useEffect, useState } from "react";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Banknote, Check, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PayoutRequest = {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  destination: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

const AdminPayoutsPage = () => {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payouts", { body: { action: "list_all" } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setRequests(data?.requests ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Could not load payout requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mark = async (id: string, status: "paid" | "rejected") => {
    setBusy(id);
    try {
      const note = status === "rejected" ? window.prompt("Reason for declining (shown to the member):") : null;
      const { data, error } = await supabase.functions.invoke("payouts", {
        body: { action: "mark", id, status, note },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(status === "paid" ? "Marked as paid." : "Request declined.");
      await load();
    } catch (err: any) {
      toast.error(err?.message || "Could not update request.");
    } finally {
      setBusy(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Seller Payouts — Oracle Lunar Admin" description="Review and pay seller payout requests." path="/admin/payouts" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Banknote className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Seller Payouts</h1>
            <p className="text-muted-foreground text-xs">Send the money, then mark the request paid.</p>
          </div>
          <button onClick={load} className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-primary" aria-label="Refresh payouts">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mt-10" />
        ) : (
          <>
            <h2 className="text-sm font-bold text-foreground mb-2">Waiting ({pending.length})</h2>
            {pending.length === 0 && <p className="text-xs text-muted-foreground mb-5">No payout requests waiting.</p>}
            <div className="space-y-3 mb-6">
              {pending.map((r) => (
                <div key={r.id} className="rounded-2xl border border-primary/30 bg-card p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-lg font-bold text-primary">${(r.amount_cents / 100).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <p className="text-xs text-foreground"><span className="font-semibold">{r.method.toUpperCase()}:</span> {r.destination}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 break-all">Member: {r.user_id}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => mark(r.id, "paid")}
                      disabled={busy === r.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold py-2 disabled:opacity-60"
                    >
                      {busy === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Mark paid
                    </button>
                    <button
                      onClick={() => mark(r.id, "rejected")}
                      disabled={busy === r.id}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-destructive/40 text-destructive text-xs font-bold py-2 disabled:opacity-60"
                    >
                      <X className="w-3 h-3" />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {done.length > 0 && (
              <>
                <h2 className="text-sm font-bold text-foreground mb-2">History</h2>
                <div className="space-y-2">
                  {done.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-foreground">${(r.amount_cents / 100).toFixed(2)} via {r.method}</p>
                        {r.admin_note && <p className="text-[10px] text-muted-foreground">{r.admin_note}</p>}
                      </div>
                      <span className={`text-xs font-bold ${r.status === "paid" ? "text-primary" : "text-destructive"}`}>
                        {r.status === "paid" ? "Paid" : "Declined"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPayoutsPage;
