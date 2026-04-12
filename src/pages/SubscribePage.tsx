import { useState, useEffect } from "react";
import { Star, Check, Zap, Crown, Sparkles, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, SUBSCRIPTION_TIERS } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Oracle AI chat", "1 AI companion", "5 basic features", "Limited storage"],
    icon: <Star className="w-6 h-6" />,
    badge: null,
    priceId: null,
    mode: null as "subscription" | "payment" | null,
  },
  {
    key: "starter",
    name: "Starter",
    price: "$5",
    period: "/month",
    features: ["Unlimited Oracle chat", "AI Partner experience", "All 42 features", "5GB storage"],
    icon: <Zap className="w-6 h-6" />,
    badge: null,
    priceId: "price_1TJzBGLM75X0snyCdM2ikY1r",
    mode: "subscription" as const,
  },
  {
    key: "monthly",
    name: "Full Access",
    price: "$10",
    period: "/month",
    features: ["Everything in Starter", "3 AI companions", "10GB storage", "Priority support", "Voice studio access"],
    icon: <Zap className="w-6 h-6" />,
    badge: "POPULAR",
    priceId: "price_1T1KasLM75X0snyCZxP450ZO",
    mode: "subscription" as const,
  },
  {
    key: "quarterly",
    name: "Pro (3 Months)",
    price: "$20",
    period: "one-time",
    features: ["Everything in Full Access", "5 AI companions", "AI video generation", "50GB storage", "24/7 VIP support"],
    icon: <Crown className="w-6 h-6" />,
    badge: "BEST VALUE",
    priceId: "price_1T1Kc9LM75X0snyC3HMqFPm7",
    mode: "payment" as const,
  },
  {
    key: "golden",
    name: "Golden Heart",
    price: "$1,200",
    period: "/year",
    features: ["Everything unlimited", "Unlimited AI companions", "Unlimited storage", "Early access to all features", "Custom AI personalities", "White-glove support"],
    icon: <Sparkles className="w-6 h-6" />,
    badge: "ULTIMATE",
    priceId: "price_1T0e8lLM75X0snyC9PVHfil2",
    mode: "subscription" as const,
  },
];

const addons = [
  { name: "Extra AI Avatar", price: "$1", priceId: "price_1TJzArLM75X0snyCtNnu2Xqy", description: "Generate one custom AI avatar (one-time)" },
  { name: "Service Credits ($20)", price: "$20", priceId: "price_1T1KcwLM75X0snyC7RESW7pN", description: "Credits for Video Studio, Photography, Marketing AI" },
];

const SubscribePage = () => {
  const { user } = useAuth();
  const { subscribed, tier, subscriptionEnd, loading, checkSubscription, startCheckout, openPortal } = useSubscription();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Payment successful! Refreshing subscription...");
      setTimeout(() => checkSubscription(), 2000);
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Payment was canceled.");
    }
  }, [searchParams]);

  const handleCheckout = async (priceId: string, mode: "subscription" | "payment") => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }
    setCheckingOut(priceId);
    try {
      await startCheckout(priceId, mode);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setCheckingOut(null);
    }
  };

  const handlePortal = async () => {
    try {
      await openPortal();
    } catch (err: any) {
      toast.error(err.message || "Could not open subscription management");
    }
  };

  const currentPlanKey = tier;

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10"><Star className="w-7 h-7 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold text-primary">Subscribe</h1>
            <p className="text-muted-foreground text-xs">Unlock premium features & AI companions</p>
          </div>
        </div>

        {/* Current subscription status */}
        {user && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current Plan</p>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary mt-1" />
              ) : (
                <>
                  <p className="text-sm font-bold text-foreground capitalize">{tier === "free" ? "Free" : tier}</p>
                  {subscriptionEnd && (
                    <p className="text-[10px] text-muted-foreground">Renews: {new Date(subscriptionEnd).toLocaleDateString()}</p>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => checkSubscription()} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/80">
                <RefreshCw className="w-4 h-4" />
              </button>
              {subscribed && (
                <button onClick={handlePortal} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  <ExternalLink className="w-3 h-3" /> Manage
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plans */}
        <div className="space-y-4">
          {plans.map(p => {
            const isCurrent = currentPlanKey === p.key;
            return (
              <div key={p.key} className={`bg-card border rounded-2xl p-5 ${isCurrent ? "border-primary ring-1 ring-primary/30" : p.key === "golden" ? "border-[hsl(var(--gold,45_100%_50%))]" : "border-border"}`}>
                {p.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.key === "golden" ? "bg-[hsl(var(--gold,45_100%_50%))] text-black" : "bg-primary text-primary-foreground"}`}>
                    {p.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[hsl(var(--status-active))]/20 text-[hsl(var(--status-active))] ml-1">YOUR PLAN</span>
                )}
                <div className="flex items-center gap-3 mt-2 mb-3">
                  <div className={p.key === "golden" ? "text-[hsl(var(--gold,45_100%_50%))]" : "text-primary"}>{p.icon}</div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                    <p className="text-xs text-muted-foreground"><span className="text-xl font-bold text-primary">{p.price}</span> {p.period}</p>
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {p.features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[hsl(var(--status-active))]" />
                      <span className="text-xs text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                {isCurrent ? (
                  <button className="w-full py-3 rounded-xl text-sm font-semibold bg-secondary text-muted-foreground border border-border" disabled>
                    Current Plan
                  </button>
                ) : p.priceId && p.mode ? (
                  <button
                    onClick={() => handleCheckout(p.priceId!, p.mode!)}
                    disabled={checkingOut === p.priceId}
                    className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${p.key === "golden" ? "bg-[hsl(var(--gold,45_100%_50%))] text-black" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
                  >
                    {checkingOut === p.priceId ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : "Upgrade"}
                  </button>
                ) : (
                  <button className="w-full py-3 rounded-xl text-sm font-semibold bg-secondary text-muted-foreground border border-border" disabled>
                    Free Tier
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add-ons */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-3">Add-ons</h2>
          {addons.map(a => (
            <div key={a.name} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 mb-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">{a.name} — {a.price}</h3>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
              <button
                onClick={() => handleCheckout(a.priceId, "payment")}
                disabled={checkingOut === a.priceId}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
              >
                {checkingOut === a.priceId ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buy"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscribePage;
