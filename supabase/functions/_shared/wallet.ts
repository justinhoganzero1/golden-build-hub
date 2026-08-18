// Shared per-user billing helpers for edge functions.
// Paid providers should authorizeAI() before work, then settleAI() with measured
// usage or cancelAI() when the provider fails. chargeAI() remains as a safe,
// atomic compatibility path for endpoints not yet converted to two-phase usage.

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

export interface BillingAuthorization {
  transaction_id: string;
  hold_id: string;
  held_total_micros: number;
  available_balance_micros: number;
  duplicate: boolean;
}

export interface UsageEvent {
  unit_type: "input_token" | "output_token" | "character" | "image" | "audio_second" | "video_second" | "call_minute" | "sms_segment" | "compute_second" | "storage_gb" | "bandwidth_gb" | "request";
  quantity: number;
  unit_cost_micros?: number;
  provider_cost_micros?: number;
  metadata?: Record<string, unknown>;
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function centsToMicros(cents: number): number {
  return Math.max(10_000, Math.ceil(cents) * 10_000);
}

async function currentBalance(userId: string): Promise<number> {
  const { data } = await serviceClient().from("wallet_balances").select("balance_cents").eq("user_id", userId).maybeSingle();
  return data?.balance_cents ?? 0;
}

/** Reserve estimated funds without spending them. Safe to retry with the same request key. */
export async function authorizeAI(
  userId: string,
  requestKey: string,
  service: string,
  provider: string,
  model: string,
  estimatedProviderCostCents: number,
  metadata: Record<string, unknown> = {},
): Promise<BillingAuthorization> {
  const estimatedMicros = centsToMicros(estimatedProviderCostCents);
  const { data, error } = await serviceClient().rpc("billing_authorize", {
    _user_id: userId,
    _request_key: requestKey,
    _service: service,
    _provider: provider,
    _model: model,
    _estimated_provider_cost_micros: estimatedMicros,
    _metadata: metadata,
  });
  if (error) {
    if (error.message.includes("insufficient_funds")) {
      const balance = await currentBalance(userId);
      const total = Math.ceil((estimatedMicros * 1.1) / 10_000);
      throw new InsufficientCoinsError(total, balance);
    }
    throw new Error(`billing_authorize failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("billing_authorize returned no row");
  return row as BillingAuthorization;
}

/** Settle a hold from actual provider cost and measured usage. Safe to retry. */
export async function settleAI(
  transactionId: string,
  actualProviderCostCents: number,
  providerRequestId?: string,
  usage: UsageEvent[] = [],
  metadata: Record<string, unknown> = {},
): Promise<{ total_billed_cents: number; new_balance_cents: number; platform_fee_micros: number }> {
  const { data, error } = await serviceClient().rpc("billing_settle", {
    _transaction_id: transactionId,
    _actual_provider_cost_micros: centsToMicros(actualProviderCostCents),
    _provider_request_id: providerRequestId ?? null,
    _usage: usage,
    _metadata: metadata,
  });
  if (error) throw new Error(`billing_settle failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("billing_settle returned no row");
  return row;
}

/** Release a hold when provider work fails before settlement. */
export async function cancelAI(transactionId: string, reason = "provider_failed"): Promise<void> {
  const { error } = await serviceClient().rpc("billing_cancel", {
    _transaction_id: transactionId,
    _reason: reason,
  });
  if (error) throw new Error(`billing_cancel failed: ${error.message}`);
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
 * Deprecated: no origin is exempt from billing any more. Every signed-in user
 * pays their own provider cost + 10% from their own wallet.
 */
export function isLovablePreviewOrigin(_req: Request): boolean {
  return false;
}

/**
 * Charge a user's coin wallet for an AI call.
 * Provider cost is marked up by 10% (see pricing.ts) and recorded in ai_charges
 * under that user's own user_id — usage and billing are fully per-user.
 * Throws InsufficientCoinsError if balance is too low.
 */
export async function chargeAI(
  user_id: string,
  service: string,
  provider_cost_cents: number,
  metadata: Record<string, unknown> = {},
  _req?: Request,
): Promise<ChargeResult> {
  const { provider_cost_cents: prov } = markupCents(provider_cost_cents);
  const requestKey = typeof metadata.request_key === "string" && metadata.request_key
    ? metadata.request_key
    : `${service}:${crypto.randomUUID()}`;
  const authorization = await authorizeAI(
    user_id,
    requestKey,
    service,
    typeof metadata.provider === "string" ? metadata.provider : "unknown",
    typeof metadata.model === "string" ? metadata.model : "unknown",
    prov,
    metadata,
  );
  const row = await settleAI(authorization.transaction_id, prov, undefined, [{ unit_type: "request", quantity: 1 }], metadata);
  return {
    charge_id: authorization.transaction_id,
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
