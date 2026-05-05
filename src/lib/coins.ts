// Oracle Lunar coin economy.
// Conversion: 5.3 coins = $1 USD  ⇒  1 USD cent = 0.053 coins.
// Use these helpers EVERYWHERE in the UI instead of showing dollars.
// The only place dollars should be visible is the Stripe top-up screen
// (where the user is exchanging real money for coins).

export const COINS_PER_USD = 5.3;
export const USD_PER_COIN = 1 / COINS_PER_USD; // ≈ 0.1887

export const centsToCoins = (cents: number | null | undefined): number => {
  const c = Number(cents ?? 0);
  return (c / 100) * COINS_PER_USD;
};

export const usdToCoins = (usd: number | null | undefined): number => {
  return Number(usd ?? 0) * COINS_PER_USD;
};

/** Format a coin amount for display, e.g. "🪙 21.7" */
export const formatCoins = (coins: number, opts: { withIcon?: boolean; decimals?: number } = {}): string => {
  const { withIcon = true, decimals = coins >= 100 ? 0 : 1 } = opts;
  const n = Number.isFinite(coins) ? coins : 0;
  const num = n.toFixed(decimals);
  return withIcon ? `🪙 ${num}` : num;
};

/** Convert cents and format in one go. */
export const formatCentsAsCoins = (cents: number | null | undefined, opts?: { withIcon?: boolean; decimals?: number }) =>
  formatCoins(centsToCoins(cents), opts);

/** Convert a USD amount and format in one go. */
export const formatUsdAsCoins = (usd: number | null | undefined, opts?: { withIcon?: boolean; decimals?: number }) =>
  formatCoins(usdToCoins(usd), opts);
