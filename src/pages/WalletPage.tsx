import { useEffect, useMemo, useState } from "react";
import SEO from "@/components/SEO";
import { Coins, Loader2, RefreshCw, ShoppingCart, Sparkles, Wallet } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COINS_PER_DOLLAR = 5.37;
const coinPacks = [5, 10, 20, 50, 100];

const WalletPage = () => {
  const { user } = useAuth();
  const [balanceCents, setBalanceCents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<number | null>(null);

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
  }, [user]);

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
      </div>
    </div>
  );
};

export default WalletPage;
