// Who the member is building for. Pure helper (no Deno imports) so vitest can test it.
// "personal" = an app for the member's own use (no prices, paywalls or store listing).
// "sell"     = an app to sell (pricing, paywall, store listing, competitor wedge).
export type BuildPurpose = "personal" | "sell";

const SELL_HINT = /(\$\s?\d|\bsell(ing)?\b|\bsubscriptions?\b|\bpaid\b|\bpaywall\b|\bmonetis|\bmonetiz|\bcustomers?\b|\bplay store\b|\bapp store\b|\bper month\b|\/mo\b)/i;

/** Uses the member's explicit choice; otherwise own-use unless the request clearly talks about selling. */
export function resolvePurpose(purpose: unknown, prompt: string): BuildPurpose {
  if (purpose === "personal" || purpose === "sell") return purpose;
  return SELL_HINT.test(String(prompt || "")) ? "sell" : "personal";
}
