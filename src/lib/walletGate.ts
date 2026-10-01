// Pay-first gate: call before starting any long paid job (rewrite, narration).
// Returns true when the signed-in member has enough paid credit (or is exempt).
import { supabase } from "@/integrations/supabase/client";
import { notifyWalletInsufficient } from "@/lib/walletPaywall";
import { toast } from "sonner";

export async function getWalletBalanceCents(userId: string): Promise<number> {
  const { data } = await supabase.from("wallet_balances").select("balance_cents").eq("user_id", userId).maybeSingle();
  return data?.balance_cents ?? 0;
}

export async function ensureCredit(minCents: number, service: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) { toast.error("Please sign in first."); return false; }
  const { data: unlimited } = await supabase.rpc("has_unlimited_ai", { _user_id: uid });
  if (unlimited) return true;
  const bal = await getWalletBalanceCents(uid);
  if (bal >= minCents) return true;
  notifyWalletInsufficient({ service, requiredCents: minCents, balanceCents: bal });
  toast.error("Top up your wallet first — this job is paid from your own credit.");
  return false;
}

// After Stripe checkout returns (?coins=success&session_id=...), confirm and credit.
export async function confirmTopupFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    const sid = p.get("session_id");
    if (p.get("coins") !== "success" || !sid) return;
    const key = `topup-verified-${sid}`;
    if (sessionStorage.getItem(key)) return;
    const { data, error } = await supabase.functions.invoke("verify-coin-topup", { body: { sessionId: sid } });
    if (error) throw error;
    if (data?.credited) {
      sessionStorage.setItem(key, "1");
      toast.success("Payment received — your credit is in your wallet.");
      window.dispatchEvent(new Event("wallet:updated"));
    } else {
      toast.message("Payment is still processing — your wallet updates shortly.");
    }
  } catch {
    toast.error("We couldn't confirm the payment yet. Refresh your wallet in a moment.");
  }
}
