import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { openCheckoutGlobal } from "@/components/payments/CheckoutProvider";
import { getTrialDeviceId } from "@/lib/trialDevice";

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
  /** True when this person's email, device, card or connection already had a free trial on another account. */
  trial_blocked?: boolean;
  trial_blocked_message?: string | null;
};

/** Opens Stripe's card form. $0.00 is charged; the card only proves one trial per person. */
export async function startTrialCardCheck(): Promise<void> {
  const device_id = await getTrialDeviceId();
  return openCheckoutGlobal({
    functionName: "trial-card-setup",
    body: { action: "start", device_id },
    title: "Card check — $0.00 today",
  });
}

async function call(body: Record<string, unknown>): Promise<TrialStatus & { ok?: boolean }> {
  const device_id = await getTrialDeviceId();
  const { data, error } = await supabase.functions.invoke("trial-card-setup", { body: { ...body, device_id } });
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

/** Once a day per device, let a signed-in account check in so a trial account's devices are remembered. */
export function noteTrialDevice(userId: string): void {
  try {
    const key = `oracle-trial-checkin:${userId}`;
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 86_400_000) return;
    localStorage.setItem(key, String(Date.now()));
    void call({ action: "status" }).catch(() => undefined);
  } catch { /* ignore */ }
}
