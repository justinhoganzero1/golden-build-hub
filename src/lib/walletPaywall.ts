// Global wallet paywall event bus.
// Any code that gets `{ insufficient: true }` back from wallet_charge_ai
// should call notifyWalletInsufficient() to raise the top-up modal.

export type WalletInsufficientDetail = {
  service?: string;
  requiredCents?: number;
  balanceCents?: number;
};

export const WALLET_INSUFFICIENT_EVENT = "wallet:insufficient";

export function notifyWalletInsufficient(detail: WalletInsufficientDetail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(WALLET_INSUFFICIENT_EVENT, { detail }));
  } catch {
    /* noop (SSR / non-browser) */
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
