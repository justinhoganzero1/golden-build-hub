// Global wallet paywall event bus.
// Any code that gets `{ insufficient: true }` back from wallet_charge_ai
// should call notifyWalletInsufficient() to raise the top-up modal.

export type WalletInsufficientDetail = {
  service?: string;
  requiredCents?: number;
  balanceCents?: number;
};

export const WALLET_INSUFFICIENT_EVENT = "wallet:insufficient";

// A burst of parallel paid calls all fail at once when the wallet runs dry.
// Only the first one should raise the modal, or it flickers and resets.
let lastFiredAt = 0;

export function notifyWalletInsufficient(detail: WalletInsufficientDetail = {}) {
  const now = Date.now();
  if (now - lastFiredAt < 4000) return;
  lastFiredAt = now;
  try {
    window.dispatchEvent(new CustomEvent(WALLET_INSUFFICIENT_EVENT, { detail }));
  } catch {
    /* noop (SSR / non-browser) */
  }
}

/**
 * Pass any error thrown by supabase.functions.invoke (or a parsed JSON body).
 * If it is an insufficient-coins / 402 response, the top-up modal is raised and
 * true is returned so the caller can skip its own error toast.
 */
export async function handleEdgeInsufficient(err: any): Promise<boolean> {
  try {
    const res: Response | undefined = err?.context;
    let body: any = null;
    if (res && typeof res.clone === "function") {
      body = await res.clone().json().catch(() => null);
      if (!body && res.status !== 402) return false;
    } else if (err && typeof err === "object") {
      body = err;
    }
    const insufficient =
      body?.error === "insufficient_coins" ||
      res?.status === 402 ||
      body?.insufficient === true;
    if (!insufficient) return false;
    notifyWalletInsufficient({
      requiredCents: body?.needed_cents ?? body?.total_billed_cents,
      balanceCents: body?.balance_cents ?? body?.new_balance_cents,
    });
    return true;
  } catch {
    return false;
  }
}

// Convenience wrapper: pass the response from wallet_charge_ai. Returns true
// if the modal was raised (i.e. call was blocked by low balance).
export function handleChargeResult(res: any): boolean {
  const row = Array.isArray(res) ? res[0] : res;
  if (row && row.insufficient) {
    notifyWalletInsufficient({
      requiredCents: row.total_billed_cents,
      balanceCents: row.new_balance_cents,
    });
    return true;
  }
  return false;
}
