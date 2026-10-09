import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership, membershipActive } from "@/hooks/useMembership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Crown, Sparkles, Lock, Unlock } from "lucide-react";

const UPGRADE_FROM_KEY = "oracle.upgradeFrom";

const MembershipPage = () => {
  const { user } = useAuth();
  const { membership, exempt, refresh } = useMembership();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const upgradeFrom = (location.state as any)?.upgradeFrom as string | undefined;
  useEffect(() => {
    if (upgradeFrom) try { sessionStorage.setItem(UPGRADE_FROM_KEY, upgradeFrom); } catch {}
  }, [upgradeFrom]);
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
      const { data, error } = await supabase.functions.invoke("membership", { body: { action: "verify", sessionId: sid } });
      if (error || !data?.ok) {
        toast.error(data?.error === "founder_seats_gone_refunded"
          ? "Sorry, the last seat was just taken — your $1 has been refunded."
          : "Payment still processing — refresh in a moment.");
      } else if (data.kind === "founder") {
        toast.success(`Welcome, Founding Member #${data.founder_number}!`);
      } else {
        toast.success("Full app unlocked — welcome!");
        let back: string | null = null;
        try { back = sessionStorage.getItem(UPGRADE_FROM_KEY); sessionStorage.removeItem(UPGRADE_FROM_KEY); } catch {}
        if (back) setTimeout(() => navigate(back!, { replace: true }), 800);
      }
      setParams({}, { replace: true });
      window.dispatchEvent(new Event("membership:updated"));
      refresh();
    })();
  }, [user, params, setParams, refresh]);

  const checkout = async (plan: "founder" | "monthly") => {
    if (!user) return navigate("/sign-in?mode=signup&redirect=/membership");
    setBusy(plan);
    const { data, error } = await supabase.functions.invoke("membership", { body: { action: "checkout", plan } });
    setBusy(null);
    if (error || !data?.url) return toast.error(data?.error === "founder_seats_gone" ? "All 500 founder seats are taken." : "Couldn't open checkout.");
    window.location.href = data.url;
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

  const active = exempt || membershipActive(membership);
  const trialLeft = membership && !membership.founder_number && membership.kind === "trial"
    ? Math.max(0, Math.ceil((new Date(membership.trial_ends_at).getTime() - Date.now()) / 3600000)) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Oracle Lunar Membership</h1>
          {membership?.founder_number ? (
            <p className="text-primary font-semibold flex items-center justify-center gap-2"><Crown className="w-5 h-5" /> Founding Member #{membership.founder_number}</p>
          ) : trialLeft > 0 ? (
            <p className="text-muted-foreground">Free trial: about {trialLeft} hours left. AI, voice and images are paid from your own wallet credit.</p>
          ) : !active ? (
            <p className="text-destructive font-medium">Your 3-day free trial has ended. Choose a membership to keep using the app.</p>
          ) : null}
        </header>

        {!membership?.founder_number && (
          <div className="grid md:grid-cols-2 gap-6">
            {left !== null && left > 0 && (
              <div className="rounded-2xl border-2 border-founder p-6 space-y-4 bg-card">
                <div className="flex items-center gap-2 text-founder font-bold"><Sparkles className="w-5 h-5" /> Founding Member</div>
                <p className="text-4xl font-bold">$1 <span className="text-base font-normal text-muted-foreground">AUD once</span></p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Free membership for life</li>
                  <li>• Your own numbered seat (1 of 500)</li>
                  <li>• Gold Founder badge, forever</li>
                  <li>• Founder's Vault: exclusive gold theme and first access to new modules</li>
                  <li>• Transferable to another member</li>
                </ul>
                <p className="text-xs text-muted-foreground">{left} seats left. Never offered again once gone.</p>
                <Button onClick={() => checkout("founder")} disabled={!!busy} className="w-full bg-founder text-founder-foreground hover:bg-founder/90">
                  {busy === "founder" ? "Opening…" : "Claim my Founder seat"}
                </Button>
              </div>
            )}
            <div className="rounded-2xl border border-border p-6 space-y-4 bg-card">
              <div className="font-bold">Monthly Membership</div>
              <p className="text-4xl font-bold">$19.99 <span className="text-base font-normal text-muted-foreground">AUD / month</span></p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Unlocks every feature</li>
                <li>• Cancel any time</li>
                <li>• AI, voice and images paid from your wallet credit</li>
              </ul>
              <Button onClick={() => checkout("monthly")} disabled={!!busy || membership?.kind === "monthly" && active} variant="outline" className="w-full">
                {membership?.kind === "monthly" && active ? "Active" : busy === "monthly" ? "Opening…" : "Join monthly"}
              </Button>
            </div>
          </div>
        )}

        {membership?.founder_number && !(membership.monthly_active_until && new Date(membership.monthly_active_until).getTime() > Date.now()) && (
          <div className="rounded-2xl border-2 border-primary p-6 space-y-4 bg-card">
            {upgradeFrom && (
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Lock className="w-4 h-4" /> That page is part of the full app. Upgrade to open it.
              </p>
            )}
            <div className="flex items-center gap-2 font-bold text-lg"><Unlock className="w-5 h-5 text-primary" /> Unlock the full app</div>
            <p className="text-4xl font-bold">$19.99 <span className="text-base font-normal text-muted-foreground">AUD / month</span></p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Opens every page: video, voice, photo studio, app builder and more</li>
              <li>• You keep your Founder seat #{membership.founder_number} and gold badge</li>
              <li>• Cancel any time — you drop back to your Founder pages</li>
              <li>• AI, voice and images are still paid from your wallet credit</li>
            </ul>
            <Button onClick={() => checkout("monthly")} disabled={!!busy} className="w-full">
              {busy === "monthly" ? "Opening…" : "Upgrade to the full app"}
            </Button>
          </div>
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
          See the <Link to="/terms-of-service" className="underline">Terms of Service</Link> for Founder seat rules.
          {active && <> · <Link to="/dashboard" className="underline">Back to the app</Link></>}
        </p>
      </div>
    </div>
  );
};

export default MembershipPage;
