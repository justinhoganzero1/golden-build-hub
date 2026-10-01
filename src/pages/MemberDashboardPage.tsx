import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import FounderBadge from "@/components/FounderBadge";
import { Button } from "@/components/ui/button";
import { Coins, Gamepad2, Gem, Loader2, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { supabase } from "@/integrations/supabase/client";

const COINS_PER_DOLLAR = 5.37;

interface Topup { id: string; amount_cents: number; gross_cents: number | null; source: string | null; created_at: string }

const MemberDashboardPage = () => {
  const { user } = useAuth();
  const { membership } = useMembership();
  const [balance, setBalance] = useState<number | null>(null);
  const [topups, setTopups] = useState<Topup[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, t] = await Promise.all([
        supabase.from("wallet_balances").select("balance_cents").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_topups").select("id,amount_cents,gross_cents,source,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setBalance(b.data?.balance_cents ?? 0);
      setTopups((t.data as Topup[]) ?? []);
    })();
  }, [user]);

  const isPaid = !!membership?.founder_number || (membership?.monthly_active_until && new Date(membership.monthly_active_until) > new Date());

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="My Account — Oracle Lunar" description="Your coin balance, top-up history and member rewards." path="/my-account" />
      <UniversalBackButton />
      <div className="px-4 pt-14 max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-primary">My Account</h1>
          {membership?.founder_number && <FounderBadge number={membership.founder_number} />}
        </div>

        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 to-primary/5 p-6">
          <p className="text-xs text-muted-foreground">Coins left</p>
          {balance === null ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
            <p className="text-4xl font-bold text-primary">{((balance / 100) * COINS_PER_DOLLAR).toFixed(2)}</p>
          )}
          <Button asChild className="mt-4"><Link to="/wallet"><Coins className="w-4 h-4 mr-2" /> Buy more coins</Link></Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Link to={isPaid ? "/founder-vault" : "/membership"} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
            <Gem className="w-5 h-5 text-primary mb-2" />
            <p className="font-bold text-foreground">Member Vault</p>
            <p className="text-xs text-muted-foreground">{isPaid ? "Your badge, gold theme and rewards." : "Become a member to unlock."}</p>
          </Link>
          <Link to="/free-zone" className="rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
            <Gamepad2 className="w-5 h-5 text-primary mb-2" />
            <p className="font-bold text-foreground">Free Zone</p>
            <p className="text-xs text-muted-foreground">Games, planners and trackers — never cost coins.</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="font-bold text-foreground flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Top-up history</p>
          {topups.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-2">No top-ups yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {topups.map((t) => (
                <li key={t.id} className="py-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                  <span className="text-foreground font-semibold">
                    +{((t.amount_cents / 100) * COINS_PER_DOLLAR).toFixed(2)} coins
                    {t.gross_cents ? ` · paid $${(t.gross_cents / 100).toFixed(2)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberDashboardPage;
