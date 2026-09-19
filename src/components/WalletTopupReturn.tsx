import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const WALLET_TOPPED_UP_EVENT = "wallet:toppedup";

/**
 * Stripe sends the user straight back to the page they were working on with
 * ?coins=success, but the wallet is credited by the webhook a moment later.
 * This polls the balance for a few seconds so the user sees their new credit
 * land instead of a stale balance, then cleans the URL.
 */
const WalletTopupReturn = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const running = useRef(false);

  useEffect(() => {
    const status = params.get("coins");
    if (!status || !user || running.current) return;
    running.current = true;

    const clean = () => {
      const next = new URLSearchParams(params);
      next.delete("coins");
      setParams(next, { replace: true });
    };

    if (status !== "success") {
      clean();
      running.current = false;
      return;
    }

    const readBalance = async () => {
      const { data } = await supabase
        .from("wallet_balances")
        .select("balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.balance_cents ?? 0;
    };

    let cancelled = false;
    let settled = false;
    const toastId = toast.loading("Adding your credit…");

    (async () => {
      const start = await readBalance();
      for (let i = 0; i < 15 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const now = await readBalance();
        if (now > start) {
          settled = true;
          toast.success(`Credit added — $${(now / 100).toFixed(2)} ready to use.`, { id: toastId, duration: 8000 });
          window.dispatchEvent(new CustomEvent(WALLET_TOPPED_UP_EVENT, { detail: { balanceCents: now } }));
          clean();
          running.current = false;
          return;
        }
      }
      if (!cancelled) {
        settled = true;
        toast.success("Payment received — your credit will appear in a moment.", { id: toastId, duration: 8000 });
        clean();
        running.current = false;
      }
    })();

    return () => {
      cancelled = true;
      // Only clear the spinner if the payment never resolved — dismissing here
      // after success would wipe the confirmation the moment the URL is cleaned.
      if (!settled) toast.dismiss(toastId);
    };
  }, [params, user, setParams]);

  return null;
};

export default WalletTopupReturn;
