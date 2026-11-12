import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PLAN_REQUIRED_EVENT, type PlanRequiredDetail } from "@/lib/walletPaywall";
import { PLANS } from "@/lib/plans";

/** Global pop-up shown when a Free (or Plus) member tries something their plan doesn't include. */
export default function PlanUpgradeModal() {
  const [detail, setDetail] = useState<PlanRequiredDetail | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: Event) => setDetail(prev => prev ?? ((e as CustomEvent<PlanRequiredDetail>).detail || { requiredPlan: "plus" }));
    window.addEventListener(PLAN_REQUIRED_EVENT, handler);
    return () => window.removeEventListener(PLAN_REQUIRED_EVENT, handler);
  }, []);

  const plan = PLANS[detail?.requiredPlan ?? "plus"];
  return (
    <Dialog open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-primary" />Part of {plan.name}</DialogTitle>
          <DialogDescription>{detail?.message || `This needs the ${plan.name} plan.`}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-bold">A${plan.monthlyAud.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
          <p className="text-xs text-muted-foreground">or A${plan.yearlyAud.toFixed(2)} a year (2 months free) · includes {plan.monthlyCreditAudLabel} of AI credit every month</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {plan.features.slice(0, 4).map(f => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}
          </ul>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => { const from = location.pathname; setDetail(null); navigate("/membership", { state: { upgradeFrom: from, plan: plan.id } }); }}>See plans</Button>
          <Button variant="outline" className="flex-1" onClick={() => setDetail(null)}>Not now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
