import { useState } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";
import FounderBadge from "@/components/FounderBadge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Palette, ScrollText, Gamepad2 } from "lucide-react";
import { useMembership } from "@/hooks/useMembership";
import { goldThemeOn, setGoldTheme } from "@/lib/goldTheme";

const FounderVaultPage = () => {
  const { membership, exempt, loading } = useMembership();
  const [gold, setGold] = useState(goldThemeOn());
  const monthly = !!membership?.monthly_active_until && new Date(membership.monthly_active_until) > new Date();
  const founder = membership?.founder_number ?? null;
  const allowed = exempt || !!founder || monthly;

  if (loading) return null;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-3">
        <UniversalBackButton />
        <Lock className="w-10 h-10 text-primary" />
        <h1 className="text-xl font-bold text-foreground">The Member Vault is for paying members</h1>
        <p className="text-sm text-muted-foreground">Become a Founder or monthly member to unlock your badge and gold theme.</p>
        <Button asChild><Link to="/membership">See memberships</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <SEO title="Member Vault — Oracle Lunar" description="Founder badge, gold theme and member rewards." path="/founder-vault" />
      <UniversalBackButton />
      <div className="px-4 pt-14 max-w-3xl mx-auto space-y-5">
        <div className="text-center space-y-3">
          <Crown className="w-12 h-12 mx-auto" style={{ color: "hsl(var(--gold))" }} />
          <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--gold-light))" }}>Member Vault</h1>
          {founder ? <FounderBadge number={founder} size="lg" /> : <p className="text-sm text-muted-foreground">Monthly member</p>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <Palette className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="font-bold text-foreground">Gold theme</p>
            <p className="text-xs text-muted-foreground">Turns the whole app gold, on this device.</p>
          </div>
          <Switch checked={gold} onCheckedChange={(v) => { setGold(v); setGoldTheme(v); }} aria-label="Gold theme" />
        </div>

        {founder && (
          <div className="rounded-2xl p-6 text-center border-2" style={{ borderColor: "hsl(var(--gold))" }}>
            <ScrollText className="w-6 h-6 mx-auto mb-2" style={{ color: "hsl(var(--gold))" }} />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate</p>
            <p className="text-lg font-bold text-foreground">Founding Member #{founder} of 500</p>
            <p className="text-xs text-muted-foreground">Lifetime membership to Oracle Lunar. AI usage is still paid from your own coins.</p>
          </div>
        )}

        <Link to="/founder-seats" className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
          <Crown className="w-5 h-5 text-primary mb-1" />
          <p className="font-bold text-foreground">Founder Seats market</p>
          <p className="text-xs text-muted-foreground">See seats left, or sell your seat (you keep 80%).</p>
        </Link>

        <Link to="/free-zone" className="block rounded-2xl border border-border bg-card p-4 hover:border-primary/50">
          <Gamepad2 className="w-5 h-5 text-primary mb-1" />
          <p className="font-bold text-foreground">Free Zone</p>
          <p className="text-xs text-muted-foreground">Games, planners and trackers.</p>
        </Link>
      </div>
    </div>
  );
};

export default FounderVaultPage;
