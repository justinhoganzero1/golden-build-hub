import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { openCheckoutGlobal } from "@/components/payments/CheckoutProvider";

export type TrialStatus = {
  plan: string;
  card_verified: boolean;
  card_brand: string | null;
  card_last4: string | null;
  trial_ends_at: string | null;
  trial_open: boolean;
  images_left: number;
  videos_left: number;
  trial_days: number;
};

/** Opens Stripe's card form. $0.00 is charged; the card only proves one trial per person. */
export function startTrialCardCheck(): Promise<void> {
  return openCheckoutGlobal({
    functionName: "trial-card-setup",
    body: { action: "start" },
    title: "Card check — $0.00 today",
  });
}

async function call(body: Record<string, unknown>): Promise<TrialStatus & { ok?: boolean }> {
  const { data, error } = await supabase.functions.invoke("trial-card-setup", { body });
  if (error) {
    const res: Response | undefined = (error as any)?.context;
    const detail = res && typeof res.clone === "function" ? await res.clone().json().catch(() => null) : null;
    throw Object.assign(new Error(detail?.message || "The card check isn't available right now."), { code: detail?.error });
  }
  return data;
}

export const getTrialStatus = () => call({ action: "status" });
export const confirmTrialCard = (sessionId: string) =>
  call({ action: "confirm", session_id: sessionId, environment: getStripeEnvironment() });
