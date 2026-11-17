import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getWalletBalanceCents } from "@/lib/walletGate";
import { getCurrentPlan } from "@/lib/walletPaywall";
import { shouldRemindLowBalance } from "@/lib/lowBalance";

/** Gentle once-a-day pop-up when a paying member's wallet is nearly empty. */
export function LowBalanceReminder() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    const key = `oracle-low-balance-reminded:${user.id}`;
    let cancelled = false;

    const check = async () => {
      try {
        if (getCurrentPlan() === "free") return;
        if (window.location.pathname.startsWith("/wallet")) return;
        const { data: unlimited } = await supabase.rpc("has_unlimited_ai", { _user_id: user.id });
        if (unlimited || cancelled) return;
        const balance = await getWalletBalanceCents(user.id);
        const last = Number(localStorage.getItem(key)) || null;
        if (cancelled || !shouldRemindLowBalance(balance, last, Date.now())) return;
        localStorage.setItem(key, String(Date.now()));
        toast("Your wallet is running low", {
          description: `A$${(balance / 100).toFixed(2)} left. Top up now so Oracle's replies, pictures and spelling checks keep going.`,
          duration: 12000,
          action: { label: "Top up", onClick: () => navigate("/wallet") },
        });
      } catch { /* a reminder is never worth an error */ }
    };

    const first = setTimeout(check, 8000);
    const every = setInterval(check, 10 * 60 * 1000);
    const onUpdate = () => { void check(); };
    window.addEventListener("wallet:updated", onUpdate);
    return () => { cancelled = true; clearTimeout(first); clearInterval(every); window.removeEventListener("wallet:updated", onUpdate); };
  }, [user?.id, navigate]);

  return null;
}
