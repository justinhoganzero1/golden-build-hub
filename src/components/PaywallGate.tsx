import { ReactNode } from "react";

interface PaywallGateProps {
  children: ReactNode;
  requiredTier?: string;
  featureName?: string;
  teaser?: boolean;
}

export function hasAccess(_currentTier?: string, _requiredTier?: string): boolean {
  return true;
}

const PaywallGate = ({ children }: PaywallGateProps) => {
  // Coin economy: feature viewing is no longer tier-gated.
  // Paid AI usage is charged in coins by backend functions.
  return <>{children}</>;
};

export default PaywallGate;

export const TileLockBadge = () => null;
