import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import { Button } from "@/components/ui/button";
import { Coins, Loader2, RefreshCw, Clock, Wallet, Infinity as InfinityIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TRIAL_DAYS } from "@/lib/apiKeyReminderLogic";
import {
  FEATURE_PRICES,
  FEATURE_GROUPS,
  chargedCents,
  centsToCoins,
  COINS_PER_DOLLAR,
} from "@/lib/featurePrices";

const money = (cents: number) =>
  cents >= 100 ? `$${(cents / 100).toFixed(2)}` : `${cents}c`;

const CreditDashboardPage = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [balanceCents, setBalanceCents] = useState(0);
  const [spentCents, setSpentCents] = useState(0);
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [balRes, ownerRes, unlimitedRes, rewardRes, spendRes] = await Promise.all([
        supabase.from("wallet_balances").select("balance_cents").eq("user_id", user.id).maybeSingle(),
        supabase.rpc("is_owner"),
        supabase.rpc("has_unlimited_ai"),
        supabase.rpc("has_active_reward", { _user_id: user.id }),
        supabase.from("ai_charges").select("total_cents").eq("user_id", user.id).limit(500),
      ]);
      setBalanceCents(balRes.data?.balance_cents ?? 0);
      setUnlimited(ownerRes.data === true || unlimitedRes.data === true || rewardRes.data === true);
      const rows = (spendRes.data ?? []) as { total_cents: number | null }[];
      setSpentCents(rows.reduce((a, r) => a + (r.total_cents ?? 0), 0));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load your credit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const trial = useMemo(() => {
    const createdAt = (user as { created_at?: string } | null)?.created_at;
    if (!createdAt) return null;
    const endMs = new Date(createdAt).getTime() + TRIAL_DAYS * 86_400_000;
    const daysLeft = Math.max(0, Math.ceil((endMs - Date.now()) / 86_400_000));
    return { endDate: new Date(endMs), daysLeft };
  }, [user]);

  const topUp = async () => {
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { coinPackDollars: 10, returnTo: "/credit" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout did not return a payment page.");
      window.location.href = data.url as string;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the payment page.");
      setBuying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="Your credit, trial and prices | Oracle Lunar"
        description="See your Oracle Lunar credit balance, when your free trial ends, and exactly what each feature costs per use."
      />
      <UniversalBackButton />

      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Your credit &amp; costs</h1>
            <p className="text-sm text-muted-foreground">
              What you have, when your trial ends, and what each thing costs to make.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Coins className="h-4 w-4" /> Credit balance
            </div>
            <p className="mt-2 text-3xl font-bold">${(balanceCents / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {centsToCoins(balanceCents).toFixed(1)} coins · $1 = {COINS_PER_DOLLAR} coins
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock className="h-4 w-4" /> Free trial
            </div>
            {unlimited ? (
              <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-primary">
                <InfinityIcon className="h-5 w-5" /> No limit on this account
              </p>
            ) : trial ? (
              <>
                <p className="mt-2 text-3xl font-bold">
                  {trial.daysLeft === 0 ? "Ended" : `${trial.daysLeft} day${trial.daysLeft === 1 ? "" : "s"}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trial.daysLeft === 0 ? "Ended " : "Ends "}
                  {trial.endDate.toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Sign in to see your trial.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Wallet className="h-4 w-4" /> Spent so far
            </div>
            <p className="mt-2 text-3xl font-bold">${(spentCents / 100).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Across your recent creations</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => void topUp()} disabled={buying}>
            {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Coins className="mr-2 h-4 w-4" />}
            Add $10 credit
          </Button>
          <button
            type="button"
            onClick={() => nav("/wallet")}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary"
          >
            Other amounts and payment history
          </button>
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">What each feature costs</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            You pay exactly what the AI costs, plus a flat 20%. Nothing else.
          </p>

          <div className="space-y-5">
            {FEATURE_GROUPS.map((group) => (
              <div key={group}>
                <h3 className="mb-2 text-sm font-semibold text-primary">{group}</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {FEATURE_PRICES.filter((p) => p.group === group).map((p) => {
                    const cents = chargedCents(p.providerCents);
                    return (
                      <li key={p.feature} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span>
                          {p.feature}
                          <span className="ml-2 text-xs text-muted-foreground">{p.unit}</span>
                        </span>
                        <span className="whitespace-nowrap font-semibold">
                          {money(cents)}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {centsToCoins(cents).toFixed(2)} coins
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CreditDashboardPage;
