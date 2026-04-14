import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, Star, Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";

interface PaywallGateProps {
  children: ReactNode;
  /** Minimum tier required: "starter" | "monthly" | "quarterly" | "golden" */
  requiredTier?: string;
  /** Feature name shown on the paywall overlay */
  featureName?: string;
  /** If true, show a teaser (blurred content) instead of full block */
  teaser?: boolean;
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  monthly: 2,
  quarterly: 3,
  biannual: 4,
  annual: 5,
  golden: 6,
};

const TIER_LABELS: Record<string, string> = {
  starter: "Starter ($5/mo)",
  monthly: "Full Access ($10/mo)",
  quarterly: "Pro ($20)",
  golden: "Golden Heart ($1,200/yr)",
};

export function hasAccess(currentTier: string, requiredTier: string): boolean {
  return (TIER_RANK[currentTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0);
}

const PaywallGate = ({
  children,
  requiredTier = "starter",
  featureName = "This feature",
  teaser = false,
}: PaywallGateProps) => {
  const navigate = useNavigate();
  const { tier, loading } = useSubscription();
  const { user } = useAuth();

  // Admin bypass
  const isAdmin = user?.email === "justinbretthogan@gmail.com";

  if (loading) return <>{children}</>;
  if (isAdmin || hasAccess(tier, requiredTier)) return <>{children}</>;

  return (
    <div className="relative">
      {teaser && (
        <div className="blur-sm pointer-events-none select-none opacity-50">
          {children}
        </div>
      )}
      <div className={`${teaser ? "absolute inset-0" : ""} flex flex-col items-center justify-center py-12 px-6 text-center`}>
        <div className="holo-tile p-8 rounded-2xl max-w-sm w-full space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground">
            🔒 {featureName}
          </h3>
          <p className="text-muted-foreground text-sm">
            Unlock this premium feature with a {TIER_LABELS[requiredTier] || "paid"} plan or higher.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => navigate("/subscribe")}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Upgrade Now
            </button>
            <p className="text-xs text-muted-foreground">
              💡 Or submit a winning idea in the Suggestion Box for <span className="text-primary font-semibold">FREE lifetime access!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaywallGate;

/** Tile-level lock badge for the dashboard grid */
export const TileLockBadge = ({ requiredTier = "starter" }: { requiredTier?: string }) => {
  const { tier, loading } = useSubscription();
  const { user } = useAuth();
  const isAdmin = user?.email === "justinbretthogan@gmail.com";

  if (loading || isAdmin || hasAccess(tier, requiredTier)) return null;

  return (
    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center z-10">
      <Lock className="w-3 h-3 text-primary-foreground" />
    </div>
  );
};
