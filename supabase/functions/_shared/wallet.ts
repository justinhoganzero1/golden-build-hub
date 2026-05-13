// Shared coin-wallet helpers for edge functions.
// Every paid AI call MUST chargeAI() before invoking the upstream provider.
// If insufficient balance, throw InsufficientCoinsError → caller returns 402.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { markupCents } from "./pricing.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export class InsufficientCoinsError extends Error {
  needed_cents: number;
  balance_cents: number;
  constructor(needed: number, balance: number) {
    super(`Insufficient coins: need ${needed}¢, have ${balance}¢`);
    this.needed_cents = needed;
    this.balance_cents = balance;
  }
}

export interface ChargeResult {
  charge_id: string;
  total_cents: number;
  new_balance_cents: number;
}

/**
 * Resolve the calling user from the Authorization header.
 * Returns null when the request is unauthenticated (most paid AI endpoints
 * should reject the call in that case).
 */
export async function getUserFromRequest(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/**
 * Returns true if this request originated from a Lovable preview/published
 * URL (lovable.app / lovable.dev / lovableproject.com). On those origins
 * Lovable covers AI fees so visitors can preview freely — no wallet charge.
 */
export function isLovablePreviewOrigin(req: Request): boolean {
  const origin = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return h.endsWith(".lovable.app") || h.endsWith(".lovable.dev") || h.endsWith(".lovableproject.com");
  } catch {
    return /\.lovable\.app|\.lovable\.dev|\.lovableproject\.com/.test(origin);
  }
}

/**
 * Charge a user's coin wallet for an AI call.
 * Provider cost is marked up by 5% (see pricing.ts) and recorded in ai_charges.
 * Anonymous visitors are billed 3× by the SQL function automatically.
 * Lovable preview origins are not charged at all (Lovable covers preview AI).
 * Throws InsufficientCoinsError if balance is too low.
 */
export async function chargeAI(
  user_id: string,
  service: string,
  provider_cost_cents: number,
  metadata: Record<string, unknown> = {},
  req?: Request,
): Promise<ChargeResult> {
  if (req && isLovablePreviewOrigin(req)) {
    return { charge_id: "preview-free", total_cents: 0, new_balance_cents: 0 };
  }
  const { provider_cost_cents: prov, platform_fee_cents: fee } = markupCents(provider_cost_cents);
  const client = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await client.rpc("wallet_charge_ai", {
    _user_id: user_id,
    _service: service,
    _provider_cost_cents: prov,
    _platform_fee_cents: fee,
    _metadata: metadata,
  });
  if (error) throw new Error(`wallet_charge_ai failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("wallet_charge_ai returned no row");
  if (row.insufficient) {
    throw new InsufficientCoinsError(row.total_billed_cents, row.new_balance_cents);
  }
  return {
    charge_id: row.charge_id,
    total_cents: row.total_billed_cents,
    new_balance_cents: row.new_balance_cents,
  };
}

/** Standard 402 response for an insufficient-coins error. */
export function insufficientCoinsResponse(err: InsufficientCoinsError, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: "insufficient_coins",
      message: "Not enough coins. Top up your wallet to continue.",
      needed_cents: err.needed_cents,
      balance_cents: err.balance_cents,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
