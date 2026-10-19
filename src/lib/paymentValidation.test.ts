import { describe, it, expect } from "vitest";
import { coinPackCents, validateAppPayment, validateCoinPayment, validateMoviePayment, type PaidSession } from "../../supabase/functions/_shared/paymentValidation";
const paid = (metadata: Record<string, string>, amount = 500): PaidSession => ({ id: "cs_paid", status: "complete", mode: "payment", payment_status: "paid", currency: "usd", amount_total: amount, metadata });
describe("server-owned payment fulfillment", () => {
  it("accepts only existing coin packs", () => {
    for (const dollars of [5, 10, 20, 50, 100]) expect(coinPackCents(dollars)).toBe(dollars * 100);
    for (const invalid of [0, -5, 0.01, 7, 1000, "5", null]) expect(() => coinPackCents(invalid)).toThrow();
  });
  it("credits only the paid member pack amount", () => {
    const s = paid({ purchase_type: "coin_topup", user_id: "member", wallet_cents: "500", coin_pack_dollars: "5", visitor_multiplier: "1" });
    expect(validateCoinPayment(s, "member")).toBe(500);
    expect(() => validateCoinPayment(s, "other")).toThrow();
    expect(() => validateCoinPayment({ ...s, amount_total: 1 }, "member")).toThrow();
    expect(() => validateCoinPayment({ ...s, payment_status: "unpaid" }, "member")).toThrow();
  });
  it("cannot use a wallet purchase to unlock an app", () => {
    const s = paid({ purchase_type: "app_unlock", app_key: "app_wrapper", user_id: "member" });
    expect(() => validateAppPayment(s, "member", "app_wrapper")).not.toThrow();
    expect(() => validateAppPayment(s, "member", "app_maker")).toThrow();
    expect(() => validateAppPayment({ ...s, metadata: { ...s.metadata, purchase_type: "coin_topup" } }, "member", "app_wrapper")).toThrow();
    expect(() => validateAppPayment({ ...s, currency: "aud" }, "member", "app_wrapper")).toThrow();
  });
  it("binds a movie payment to its owner, project, tier and stored session", () => {
    const project = { id: "movie", user_id: "member", quality_tier: "sd", stripe_session_id: "cs_paid" };
    const s = paid({ project_id: "movie", user_id: "member", quality_tier: "sd" }, 900);
    expect(() => validateMoviePayment(s, project)).not.toThrow();
    expect(() => validateMoviePayment(s, { ...project, id: "another" })).toThrow();
    expect(() => validateMoviePayment(s, { ...project, user_id: "other" })).toThrow();
    expect(() => validateMoviePayment(s, { ...project, stripe_session_id: "cs_other" })).toThrow();
    expect(() => validateMoviePayment({ ...s, amount_total: 100 }, project)).toThrow();
  });
});