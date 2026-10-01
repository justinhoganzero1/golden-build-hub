import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getWalletBalanceCents } from "@/lib/walletGate";

const COINS_PER_DOLLAR = 5.37;

export default function WalletBalanceBadge() {
  const { user } = useAuth();
  const [cents, setCents] = useState<number | null>(null);
  useEffect(() => {
    if (!user) return;
    const load = () => getWalletBalanceCents(user.id).then(setCents);
    load();
    const t = setInterval(load, 30_000);
    window.addEventListener("wallet:updated", load);
    return () => { clearInterval(t); window.removeEventListener("wallet:updated", load); };
  }, [user]);
  if (!user) return null;
  return (
    <Link to="/wallet" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary hover:bg-primary/20">
      <Coins className="h-4 w-4" />
      <span>{cents === null ? "…" : ((cents / 100) * COINS_PER_DOLLAR).toFixed(2)} coins</span>
      <span className="text-xs text-muted-foreground">Top up</span>
    </Link>
  );
}
