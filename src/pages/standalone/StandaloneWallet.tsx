import { useEffect, useState } from "react";
import { Wallet, Loader2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Simplified Wallet: balance + link to top-up in full app. */
const StandaloneWallet = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("wallet_balances").select("balance_cents, currency").eq("user_id", user.id).maybeSingle();
      setBalance(data?.balance_cents ?? 0);
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-12 space-y-4">
        <Wallet className="w-12 h-12 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Sign in to see your wallet balance.</p>
        <Link to="/sign-in" className="inline-block px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-primary/30 to-amber-500/10 border border-primary/30 p-8 text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your balance</div>
        {loading ? (
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        ) : (
          <div className="text-5xl font-bold">${((balance ?? 0) / 100).toFixed(2)}</div>
        )}
        <div className="text-xs text-muted-foreground mt-2">USD · for calls & premium AI</div>
      </div>
      <Link to="/wallet" className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-primary text-primary-foreground font-medium">
        <ExternalLink className="w-4 h-4" /> Top up in full app
      </Link>
      <p className="text-xs text-muted-foreground text-center">Top-ups, BPAY, PayID and call charges are managed in the full SOLACE app.</p>
    </div>
  );
};

export default StandaloneWallet;
