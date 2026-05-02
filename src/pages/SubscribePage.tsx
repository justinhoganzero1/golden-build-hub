import { useState } from "react";
import { Coins, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COINS_PER_DOLLAR = 5.37;
const coinPacks = [
  { dollars: 5, label: "Starter Top Up" },
  { dollars: 10, label: "Creator Pack" },
  { dollars: 20, label: "Builder Pack" },
  { dollars: 50, label: "Power Pack" },
  { dollars: 100, label: "Studio Pack" },
];

const formatCoins = (dollars: number) => (dollars * COINS_PER_DOLLAR).toFixed(2);

const SubscribePage = () => {
  const { user } = useAuth();
  const [checkingOut, setCheckingOut] = useState<number | null>(null);

  const buyCoins = async (dollars: number) => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    setCheckingOut(dollars);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { coinPackDollars: dollars },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Checkout did not return a payment link.");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err?.message || "Could not open coin checkout.");
      setCheckingOut(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-xl bg-primary/10">
            <Coins className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-primary">Buy Coins</h1>
            <p className="text-muted-foreground text-xs">$1 buys 5.37 coins. Subscriptions and tiers are gone.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-card p-5 mb-5 shadow-[0_0_40px_hsl(var(--primary)/0.12)]">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Coin economy active</h2>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                You only see dollars when buying coins. Inside ORACLE LUNAR, paid AI actions spend coins server-side and free/safety tools stay accessible.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coinPacks.map((pack) => (
            <button
              key={pack.dollars}
              onClick={() => buyCoins(pack.dollars)}
              disabled={checkingOut === pack.dollars}
              className="text-left rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(var(--primary)/0.14)] transition disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-primary rounded-full bg-primary/10 px-2 py-1">
                  ${pack.dollars}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">{pack.label}</h3>
              <p className="text-2xl font-bold text-primary mt-2">{formatCoins(pack.dollars)} coins</p>
              <p className="text-xs text-muted-foreground mt-2">Added to your wallet after payment clears.</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {checkingOut === pack.dollars ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {checkingOut === pack.dollars ? "Opening checkout…" : "Buy coins"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
