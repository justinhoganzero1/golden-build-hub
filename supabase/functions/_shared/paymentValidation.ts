// Server-owned checkout prices and strict payment-to-purchase bindings.
export const COIN_PACK_DOLLARS = [5, 10, 20, 50, 100] as const;
export const MOVIE_PAYMENTS: Record<string, { price: string; amount_cents: number; label: string }> = {
  sd: { price: "movie_sd_once", amount_cents: 900, label: "SD Quality" },
  hd: { price: "movie_hd_once", amount_cents: 2900, label: "HD Quality" },
  "4k": { price: "movie_4k_once", amount_cents: 7900, label: "4K Quality" },
  "4k_ultimate": { price: "movie_4k_ultimate_once", amount_cents: 19900, label: "4K Ultimate" },
};
export const APP_PAYMENTS: Record<string, { price: string; label: string; amount_cents: number }> = {
  app_wrapper: { price: "app_wrapper_once", label: "App Wrapper", amount_cents: 500 },
  app_maker: { price: "app_maker_once", label: "App Maker", amount_cents: 2000 },
  movie_studio: { price: "movie_studio_pro_once", label: "Movie Studio Pro", amount_cents: 100 },
  photo_templates: { price: "photo_templates_once", label: "Unlimited Photo Templates", amount_cents: 100 },
};
export interface PaidSession {
  id: string;
  payment_status: string;
  status?: string | null;
  mode: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
}
export function coinPackCents(value: unknown): number {
  if (typeof value !== "number" || !COIN_PACK_DOLLARS.some(v => v === value)) throw new Error("invalid coin pack");
  return value * 100;
}
function assertPaid(s: PaidSession, amount: number, currency = "usd") {
  if (s.payment_status !== "paid" || s.status !== "complete" || s.mode !== "payment") throw new Error("payment not complete");
  if (s.amount_total !== amount || s.currency?.toLowerCase() !== currency.toLowerCase()) throw new Error("payment amount or currency mismatch");
}
export function validateCoinPayment(s: PaidSession, userId: string): number {
  const m = s.metadata;
  if (!m || m.purchase_type !== "coin_topup" || m.user_id !== userId) throw new Error("not your top-up");
  const cents = coinPackCents(Number(m.coin_pack_dollars));
  if (Number(m.wallet_cents) !== cents || m.visitor_multiplier !== "1") throw new Error("invalid top-up credit");
  assertPaid(s, cents);
  return cents;
}
export function validateAppPayment(s: PaidSession, userId: string, appKey: string) {
  const p = APP_PAYMENTS[appKey];
  if (s.metadata?.purchase_type && s.metadata.purchase_type !== "app_unlock") throw new Error("not an app payment");
  if (!p || s.metadata?.user_id !== userId || s.metadata?.app_key !== appKey) throw new Error("app payment mismatch");
  assertPaid(s, p.amount_cents);
}
export function validateMoviePayment(s: PaidSession, project: { id: string; user_id: string; stripe_session_id: string | null; quality_tier: string }) {
  const p = MOVIE_PAYMENTS[project.quality_tier];
  if (!p || s.metadata?.project_id !== project.id || s.metadata?.user_id !== project.user_id || s.metadata?.quality_tier !== project.quality_tier || s.id !== project.stripe_session_id) throw new Error("movie payment mismatch");
  assertPaid(s, p.amount_cents);
}