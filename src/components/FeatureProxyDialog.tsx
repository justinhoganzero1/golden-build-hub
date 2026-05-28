// In-app, Oracle Lunar themed unlock dialog. Replaces outbound affiliate links
// with: pay coins (provider + 50% markup) → drop user inside our own page.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Coins, ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCoins } from "@/lib/coins";
import { featureCoinCost, FeatureSpec } from "@/lib/featureProxy";
import { trackAffiliateClick } from "@/lib/affiliateLinks";

interface Props {
  open: boolean;
  spec: FeatureSpec | null;
  placement: string;
  onOpenChange: (v: boolean) => void;
}

export default function FeatureProxyDialog({ open, spec, placement, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!spec) return null;

  const coinCost = featureCoinCost(spec);
  const unlockedKey = `oracle_unlocked_${spec.id}`;
  const alreadyUnlocked = typeof window !== "undefined" && !!localStorage.getItem(unlockedKey);

  const goInternal = () => {
    onOpenChange(false);
    navigate(spec.internalRoute);
  };

  const handleUnlock = async () => {
    if (spec.comingSoon) {
      try { localStorage.setItem(`oracle_waitlist_${spec.id}`, new Date().toISOString()); } catch { /* noop */ }
      toast.success("You're on the early-access list — we'll ping you the moment it's live.");
      onOpenChange(false);
      return;
    }
    if (alreadyUnlocked) {
      goInternal();
      return;
    }
    if (!user) {
      toast.error("Please sign in to unlock this feature.");
      navigate("/welcome");
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("feature-unlock", {
        body: { feature_id: spec.id, placement },
      });

      // supabase-js throws on non-2xx — peek into the response body to detect
      // the friendly insufficient_coins case before treating it as a hard error.
      let payload: any = data;
      if (error) {
        try {
          const resp = (error as any)?.context?.response;
          if (resp && typeof resp.json === "function") {
            payload = await resp.clone().json();
          }
        } catch { /* fall through to generic error */ }
        if (payload?.error !== "insufficient_coins") throw error;
      }

      if (payload?.error === "insufficient_coins") {
        const need = Number(payload?.needed_cents ?? 0) / 100;
        const have = Number(payload?.balance_cents ?? 0) / 100;
        toast.error(
          `Not enough coins — need $${need.toFixed(2)}, you have $${have.toFixed(2)}. Top up to unlock.`
        );
        navigate("/wallet");
        onOpenChange(false);
        return;
      }
      try { localStorage.setItem(unlockedKey, new Date().toISOString()); } catch { /* noop */ }
      trackAffiliateClick(spec.partner, `proxy_unlock_${placement}_${spec.id}`);
      toast.success(`Unlocked! ${formatCoins(coinCost)} debited.`);
      goInternal();
    } catch (e: any) {
      console.error("[FeatureProxy] unlock failed", e);
      toast.error(e?.message || "Unlock failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-background via-background to-amber-950/20 border-amber-500/30 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-400/80 font-bold">
              Oracle Lunar · Premium Feature
            </span>
          </div>
          <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            {spec.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {spec.blurb}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-amber-400/80">One-tap unlock</p>
              <p className="text-2xl font-bold text-amber-200 flex items-center gap-1">
                <Coins className="w-5 h-5" />
                {coinCost.toFixed(1)}
              </p>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              <p>Charged to your</p>
              <p className="font-semibold text-foreground">Oracle wallet</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              You stay inside Oracle Lunar the whole time. No third-party sign-ups, no logins,
              no surveillance. We handle the heavy lifting in the background.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {spec.comingSoon ? (
            <Button onClick={handleUnlock} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-background font-semibold">
              <Lock className="mr-2 h-4 w-4" />
              Join early-access waitlist
            </Button>
          ) : (
            <Button onClick={handleUnlock} disabled={busy} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-background font-semibold">
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Unlocking…</>
              ) : alreadyUnlocked ? (
                <>Open now<ArrowRight className="ml-2 h-4 w-4" /></>
              ) : (
                <>Unlock for {coinCost.toFixed(1)} 🪙<ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
