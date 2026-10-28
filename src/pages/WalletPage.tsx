import { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import { Banknote, Coins, Loader2, RefreshCw, ShoppingCart, Sparkles, Wallet } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackAiDiscovery } from "@/lib/aiDiscovery";
import { openCheckoutGlobal } from "@/components/payments/CheckoutProvider";
import { getStripeEnvironment } from "@/lib/stripe";

const COINS_PER_DOLLAR = 5.37;
const coinPacks = [5, 10, 20, 50, 100];

const WalletPage = () => {
  const { user } = useAuth();
  const [balanceCents, setBalanceCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<number | null>(null);
  const [earnings, setEarnings] = useState({ shopCents: 0, seatCents: 0, availableCents: 0 });
  const [myPayouts, setMyPayouts] = useState<any[]>([]);
  const [payoutMethod, setPayoutMethod] = useState("payid");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [requestingPayout, setRequestingPayout] = useState(false);

  const loadEarnings = async () => {
    if (!user) return;
    try {
      const [{ data: bal }, { data: reqs }] = await Promise.all([
        supabase.functions.invoke("payouts", { body: { action: "balance" } }),
        supabase.functions.invoke("payouts", { body: { action: "my_requests" } }),
      ]);
      if (bal) setEarnings({ shopCents: bal.shopCents ?? 0, seatCents: bal.seatCents ?? 0, availableCents: bal.availableCents ?? 0 });
      if (reqs?.requests) setMyPayouts(reqs.requests);
    } catch { /* earnings section stays at zero */ }
  };

  const requestPayout = async () => {
    setRequestingPayout(true);
    try {
      const { data, error } = await supabase.functions.invoke("payouts", {
        body: { action: "request", amountCents: earnings.availableCents, method: payoutMethod, destination: payoutDestination },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Could not request payout.");
      toast.success("Payout requested! We'll review it shortly.");
      setPayoutDestination("");
      await loadEarnings();
    } catch (err: any) {
      toast.error(err?.message || "Could not request payout.");
    } finally {
      setRequestingPayout(false);
    }
  };

  const coinBalance = useMemo(() => (balanceCents / 100) * COINS_PER_DOLLAR, [balanceCents]);

  const loadWallet = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("wallet_balances")
        .select("balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      setBalanceCents(data?.balance_cents ?? 0);
    } catch (err: any) {
      toast.error(err?.message || "Could not load wallet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
    loadEarnings();
    const h = () => loadWallet();
    window.addEventListener("wallet:updated", h);
    return () => window.removeEventListener("wallet:updated", h);
  }, [user]);

  // After checkout returns with ?coins=success, poll until the verified
  // webhook credit lands, then refresh the balance.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("coins") !== "success" || !sessionId || !user) return;
    let cancelled = false;
    let attempts = 0;
    toast.info("Payment received — adding your coins…");
    const poll = async () => {
      while (!cancelled && attempts < 15) {
        attempts++;
        try {
          const { data } = await supabase.functions.invoke("verify-coin-topup", {
            body: { sessionId, environment: getStripeEnvironment() },
          });
          if (data?.credited) {
            if (!cancelled) {
              toast.success("Coins added to your wallet!");
              window.dispatchEvent(new Event("wallet:updated"));
              window.history.replaceState({}, "", "/wallet");
            }
            return;
          }
        } catch { /* keep polling */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        toast.info("Still processing — your coins will appear shortly.");
        window.dispatchEvent(new Event("wallet:updated"));
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [user]);

  const buyCoins = async (dollars: number) => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }
    setCheckingOut(dollars);
    try {
      await trackAiDiscovery("topup_started", { amount_cents: Math.round(dollars * 100) });
      await openCheckoutGlobal({
        functionName: "create-checkout",
        body: { coinPackDollars: dollars },
        title: `Top up — $${dollars} coin pack`,
      });
    } catch (err: any) {
      toast.error(err?.message || "Could not open coin checkout.");
      setCheckingOut(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Wallet & Credits — Oracle Lunar" description="View your Oracle Lunar credit balance, top-up history and creator payouts." path="/wallet" />
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <Wallet className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary">Coin Wallet</h1>
            <p className="text-muted-foreground text-xs">$1 = 5.37 coins when topping up.</p>
          </div>
          <button onClick={loadWallet} className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-primary" aria-label="Refresh wallet">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-5">
          <p className="text-xs text-muted-foreground mb-1">Available Coins</p>
          {loading ? (
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          ) : (
            <h2 className="text-4xl font-bold text-primary">{coinBalance.toFixed(2)}</h2>
          )}
          <p className="text-xs text-muted-foreground mt-3">Paid AI tools deduct coins automatically. Admin bypasses charges.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Top up coins</h2>
          </div>
          <p className="text-xs text-muted-foreground">Dollars appear only at checkout. Your app balance is shown as coins.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {coinPacks.map((dollars) => {
            const coins = dollars * COINS_PER_DOLLAR;
            return (
              <button
                key={dollars}
                onClick={() => buyCoins(dollars)}
                disabled={checkingOut === dollars}
                className="rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/50 transition disabled:opacity-60"
              >
                <Coins className="w-5 h-5 text-primary mb-3" />
                <p className="text-lg font-bold text-foreground">{coins.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">coins</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {checkingOut === dollars ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                  ${dollars}
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mt-5">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Your seller earnings</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Money from your Creator Shop sales (your 70% share) and founder seat resales.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-sm font-bold text-foreground">${(earnings.shopCents / 100).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Shop sales</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-sm font-bold text-foreground">${(earnings.seatCents / 100).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Seat resales</p>
            </div>
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
              <p className="text-sm font-bold text-primary">${(earnings.availableCents / 100).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Available</p>
            </div>
          </div>
          {earnings.availableCents >= 500 ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
                >
                  <option value="payid">PayID</option>
                  <option value="bank">Bank account</option>
                  <option value="paypal">PayPal</option>
                </select>
                <input
                  value={payoutDestination}
                  onChange={(e) => setPayoutDestination(e.target.value)}
                  placeholder={payoutMethod === "paypal" ? "Your PayPal email" : payoutMethod === "payid" ? "Your PayID (phone/email)" : "BSB + account number"}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground"
                />
              </div>
              <button
                onClick={requestPayout}
                disabled={requestingPayout}
                className="w-full rounded-xl bg-primary text-primary-foreground text-xs font-bold py-2.5 disabled:opacity-60"
              >
                {requestingPayout ? "Requesting…" : `Request payout of $${(earnings.availableCents / 100).toFixed(2)}`}
              </button>
              <p className="text-[10px] text-muted-foreground">Payouts are reviewed and sent by the Oracle Lunar team, usually within a few business days.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">You need at least $5.00 in earnings to request a payout.</p>
          )}
          {myPayouts.length > 0 && (
            <div className="mt-3 space-y-1">
              {myPayouts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>${(p.amount_cents / 100).toFixed(2)} via {p.method}</span>
                  <span className={p.status === "paid" ? "text-primary font-semibold" : p.status === "rejected" ? "text-destructive" : ""}>
                    {p.status === "paid" ? "Paid" : p.status === "rejected" ? "Declined" : "Waiting"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 mt-5 space-y-2">
          <h2 className="text-sm font-bold text-foreground">What uses coins</h2>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li>Oracle AI chat replies, voice, images, video, narration and phone calls.</li>
            <li>You pay the real service cost plus 20%. Nothing else.</li>
            <li>Free tools (planners, trackers, diary, calendar, games) never use coins.</li>
          </ul>
          <a href="/get-started" className="inline-block text-xs font-semibold text-primary underline">New here? See the step-by-step guide</a>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
