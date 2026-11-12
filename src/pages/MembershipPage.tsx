import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Crown, Sparkles, Lock, ArrowLeft, MessageCircle, Library, UserRound, Check, Settings2 } from "lucide-react";
import { openCheckoutGlobal } from "@/components/payments/CheckoutProvider";
import { getStripeEnvironment } from "@/lib/stripe";
import { FREE_FEATURES, PLANS, planLabel, planRank, priceIdFor, yearlySavingAud, type BillingInterval, type PaidPlan } from "@/lib/plans";

const UPGRADE_FROM_KEY = "oracle.upgradeFrom";
const aud = (n: number) => `A$${n.toFixed(2)}`;

const MembershipPage = () => {
  const { user } = useAuth();
  const { membership, plan, refresh } = useMembership();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const upgradeFrom = (location.state as any)?.upgradeFrom as string | undefined;
  const neededPlan = (location.state as any)?.plan as PaidPlan | undefined;
  useEffect(() => {
    if (upgradeFrom) try { sessionStorage.setItem(UPGRADE_FROM_KEY, upgradeFrom); } catch { /* storage blocked */ }
  }, [upgradeFrom]);
  const [billing, setBilling] = useState<BillingInterval>("month");
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toEmail, setToEmail] = useState("");

  useEffect(() => {
    supabase.rpc("public_founder_seats_left" as any).then(({ data }) => setLeft(typeof data === "number" ? data : 0));
  }, [membership]);

  useEffect(() => {
    const sid = params.get("session_id");
    if (!user || params.get("paid") !== "1" || !sid) return;
    (async () => {
      // The verified Stripe notice grants the plan; poll briefly until it lands.
      let data: any = null; let error: unknown = null;
      for (let i = 0; i < 10; i++) {
        ({ data, error } = await supabase.functions.invoke("membership", { body: { action: "verify", sessionId: sid, environment: getStripeEnvironment() } }));
        if (error || !data?.pending) break;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (error || !data?.ok) {
        toast.error(data?.error === "founder_seats_gone_refunded"
          ? "Sorry, the last seat was just taken — your $1 has been refunded."
          : "Payment still processing — refresh in a moment.");
      } else if (data.kind === "founder") {
        toast.success(`Welcome, Founding Member #${data.founder_number}!`);
      } else {
        toast.success(data.plan === "pro" ? "Welcome to Pro — everything is unlocked!" : "Welcome to Plus!");
        let back: string | null = null;
        try { back = sessionStorage.getItem(UPGRADE_FROM_KEY); sessionStorage.removeItem(UPGRADE_FROM_KEY); } catch { /* storage blocked */ }
        if (back) { const destination = back; setTimeout(() => navigate(destination, { replace: true }), 800); }
      }
      setParams({}, { replace: true });
      window.dispatchEvent(new Event("membership:updated"));
      refresh();
    })();
  }, [user, params, setParams, refresh, navigate]);

  const hasSubscription = !!membership && membership.plan !== "free" && !!membership.plan_active_until && new Date(membership.plan_active_until).getTime() > Date.now();
  const currentPriceId = hasSubscription ? priceIdFor(membership!.plan as PaidPlan, membership!.plan_interval === "year" ? "year" : "month") : null;

  const choose = async (target: PaidPlan) => {
    if (!user) return navigate("/sign-in?mode=signup&redirect=/membership");
    const priceId = priceIdFor(target, billing);
    setBusy(priceId);
    try {
      if (hasSubscription) {
        const p = PLANS[target];
        const price = billing === "year" ? `${aud(p.yearlyAud)} a year` : `${aud(p.monthlyAud)} a month`;
        if (!confirm(`Switch to ${p.name} at ${price}? The change starts now and the part-month difference is worked out fairly.`)) { setBusy(null); return; }
        const { data, error } = await supabase.functions.invoke("membership", { body: { action: "change", plan: priceId, environment: getStripeEnvironment() } });
        if (error || !data?.ok) throw new Error(data?.message || data?.error || "Could not change plan.");
        toast.success(`Switching you to ${p.name}…`);
        setTimeout(() => { window.dispatchEvent(new Event("membership:updated")); refresh(); }, 3000);
      } else {
        await openCheckoutGlobal({
          functionName: "membership",
          body: { action: "checkout", plan: priceId },
          title: `Oracle Lunar ${PLANS[target].name} — ${billing === "year" ? `${aud(PLANS[target].yearlyAud)} / year` : `${aud(PLANS[target].monthlyAud)} / month`}`,
        });
      }
    } catch (e: any) { if (e?.message) toast.error(e.message); }
    setBusy(null);
  };

  const claimFounder = async () => {
    if (!user) return navigate("/sign-in?mode=signup&redirect=/membership");
    setBusy("founder");
    try {
      await openCheckoutGlobal({ functionName: "membership", body: { action: "checkout", plan: "founder" }, title: "Founder Seat — A$1 once" });
    } catch { /* toast already shown */ }
    setBusy(null);
  };

  const manage = async () => {
    setBusy("portal");
    const { data, error } = await supabase.functions.invoke("membership", { body: { action: "portal", environment: getStripeEnvironment() } });
    setBusy(null);
    if (error || !data?.url) return toast.error(data?.message || "Could not open plan settings.");
    window.open(data.url, "_blank", "noopener");
  };

  const transfer = async () => {
    if (!confirm("Transfer your Founder seat? You will lose your seat, badge and perks for good.")) return;
    setBusy("transfer");
    const { data, error } = await supabase.functions.invoke("membership", { body: { action: "transfer", toEmail } });
    setBusy(null);
    if (error || !data?.ok) return toast.error(data?.error || "Transfer failed.");
    toast.success(`Seat #${data.founder_number} transferred.`);
    window.dispatchEvent(new Event("membership:updated"));
    refresh();
  };

  const planButton = (target: PaidPlan) => {
    const priceId = priceIdFor(target, billing);
    if (currentPriceId === priceId) return <Button disabled variant="outline" className="w-full">Your plan</Button>;
    const label = !hasSubscription ? `Get ${PLANS[target].name}`
      : planRank(target) > planRank(membership!.plan as PaidPlan) ? `Upgrade to ${PLANS[target].name}`
      : membership!.plan === target ? `Switch to ${billing === "year" ? "yearly" : "monthly"}` : `Switch to ${PLANS[target].name}`;
    return <Button onClick={() => choose(target)} disabled={!!busy} variant={target === "pro" ? "default" : "outline"} className="w-full">{busy === priceId ? "Opening…" : label}</Button>;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav aria-label="Membership navigation" className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-2">
          <Button asChild className="gap-2"><Link to="/dashboard"><ArrowLeft className="h-4 w-4 shrink-0" />Back to app</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/oracle"><MessageCircle className="h-4 w-4 shrink-0" />Oracle</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/media-library"><Library className="h-4 w-4 shrink-0" />My Library</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/my-account"><UserRound className="h-4 w-4 shrink-0" />My account</Link></Button>
        </div>
      </nav>
      <div className="max-w-5xl mx-auto space-y-8 px-4 py-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl font-bold">Choose your plan</h1>
          <p className="text-muted-foreground">Start free. Upgrade when you want Oracle's AI. Cancel any time.</p>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm">
            {membership?.founder_number && <Crown className="h-4 w-4 text-founder" />}
            You're on <strong>{planLabel(plan)}</strong>
            {membership?.founder_number ? <> · Founding Member #{membership.founder_number}</> : null}
          </p>
          {hasSubscription && membership?.plan_cancel_at_period_end && membership.plan_active_until && (
            <p className="text-sm text-destructive">Your plan ends on {new Date(membership.plan_active_until).toLocaleDateString()}. You'll go back to {membership.founder_number ? "Founder" : "Free"} after that.</p>
          )}
          {membership?.plan_status === "past_due" && <p className="text-sm text-destructive">Your last payment didn't go through. Update your card in Manage plan to keep your plan.</p>}
          {upgradeFrom && neededPlan && (
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-primary"><Lock className="h-4 w-4" />That page is part of {PLANS[neededPlan].name}.</p>
          )}
        </header>

        <div className="flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg border border-border bg-card p-1">
            {(["month", "year"] as const).map(i => (
              <button key={i} role="radio" aria-checked={billing === i} onClick={() => setBilling(i)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${billing === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {i === "month" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <section aria-label="Free plan" className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div><h2 className="font-bold text-lg">Free</h2><p className="text-sm text-muted-foreground">Get to know Oracle Lunar</p></div>
            <p className="text-4xl font-bold">A$0</p>
            <ul className="space-y-2 text-sm">{FREE_FEATURES.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
            <p className="text-xs text-muted-foreground">No AI, voice, image or video features — those cost money to run.</p>
            <Button disabled variant="outline" className="w-full">{plan === "free" ? "Your plan" : "Included"}</Button>
          </section>
          {(["plus", "pro"] as const).map(id => {
            const p = PLANS[id];
            const highlight = neededPlan ? neededPlan === id : id === "pro";
            return (
              <section key={id} aria-label={`${p.name} plan`} className={`relative rounded-2xl bg-card p-6 space-y-4 ${highlight ? "border-2 border-primary" : "border border-border"}`}>
                {id === "pro" && <span className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">Most powerful</span>}
                <div><h2 className="font-bold text-lg">{p.name}</h2><p className="text-sm text-muted-foreground">{p.tagline}</p></div>
                <div>
                  <p className="text-4xl font-bold">{aud(billing === "year" ? p.yearlyAud : p.monthlyAud)} <span className="text-base font-normal text-muted-foreground">/ {billing === "year" ? "year" : "month"}</span></p>
                  <p className="text-xs text-muted-foreground">{billing === "year" ? `Save ${aud(yearlySavingAud(id))} a year` : `or ${aud(p.yearlyAud)} a year`}</p>
                </div>
                <p className="rounded-md bg-primary/10 px-3 py-2 text-sm"><Sparkles className="mr-1 inline h-4 w-4 text-primary" />Includes {p.monthlyCreditAudLabel} of AI credit every month</p>
                <ul className="space-y-2 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}</ul>
                {plan === "owner" ? <Button disabled variant="outline" className="w-full">Owner — all included</Button> : planButton(id)}
              </section>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          When your monthly credit runs out, top up your <Link to="/wallet" className="underline">wallet</Link> and keep going. AI is charged at cost plus a small service fee.
        </p>

        {hasSubscription && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={manage} disabled={!!busy} className="gap-2"><Settings2 className="h-4 w-4" />{busy === "portal" ? "Opening…" : "Manage plan — cancel, card, invoices"}</Button>
          </div>
        )}

        {!membership?.founder_number && left !== null && left > 0 && (
          <section aria-label="Founder seat" className="rounded-2xl border-2 border-founder bg-card p-6 md:flex md:items-center md:justify-between md:gap-6 space-y-3 md:space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-founder"><Sparkles className="h-5 w-5" />Founding Member — A$1 once</div>
              <p className="text-sm text-muted-foreground">Plus-level features for life, your own numbered seat (1 of 500), gold badge and Founder's Vault. AI use is paid from your wallet. Transferable. {left} seats left.</p>
            </div>
            <Button onClick={claimFounder} disabled={!!busy} className="shrink-0 bg-founder text-founder-foreground hover:bg-founder/90">{busy === "founder" ? "Opening…" : "Claim my Founder seat"}</Button>
          </section>
        )}

        {membership?.founder_number && (
          <div className="rounded-2xl border border-border p-6 space-y-3 bg-card">
            <h2 className="font-semibold">Transfer or sell your seat</h2>
            <p className="text-sm text-muted-foreground">Enter the email of the member taking over your seat. They get seat #{membership.founder_number}, the badge and all perks. You lose them permanently. Any payment between you is your own arrangement.</p>
            <div className="flex gap-2">
              <Input type="email" placeholder="buyer@email.com" value={toEmail} onChange={(e) => setToEmail(e.target.value)} maxLength={255} />
              <Button onClick={transfer} disabled={!toEmail || !!busy} variant="destructive">Transfer</Button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Prices in Australian dollars. See the <Link to="/terms-of-service" className="underline">Terms of Service</Link> for plan and Founder seat rules.
        </p>
      </div>
    </div>
  );
};

export default MembershipPage;
