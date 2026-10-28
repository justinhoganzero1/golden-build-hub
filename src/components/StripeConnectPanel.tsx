import { Banknote, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Seller payouts panel — replaces the old Stripe Connect onboarding.
 * Sellers no longer connect a bank through Stripe; their 70% Creator Shop
 * share and seat resale proceeds are tracked automatically and paid out
 * via payout requests on the Wallet page.
 */
const StripeConnectPanel = () => {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <Banknote className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Getting paid as a seller</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        No bank setup needed. Your share of every sale is tracked automatically — request a
        payout to your PayID, bank account or PayPal whenever you have $5 or more.
      </p>
      <Link
        to="/wallet"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        Open your Wallet <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
};

export default StripeConnectPanel;
