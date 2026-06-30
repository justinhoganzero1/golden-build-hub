// Shared auth helpers for edge functions.
// requireUser: returns the authenticated user or a 401 Response.
// requireOwner: returns the authenticated owner or a 401/403 Response.
// enforceRateLimit: returns 429 Response when the caller is over their AI quota.
// All failures are logged to public.auth_audit_log for traceability.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const OWNER_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

function pathOf(req: Request): string | null {
  try {
    return new URL(req.url).pathname;
  } catch {
    return null;
  }
}

async function auditLog(opts: {
  user_id: string | null;
  email: string | null;
  ip: string | null;
  path: string | null;
  event_type: string;
  reason: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("[audit] missing env", { url: !!SUPABASE_URL, key: !!SERVICE_KEY });
      return;
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin.rpc("log_auth_event", {
      _user_id: opts.user_id,
      _email: opts.email,
      _ip: opts.ip,
      _path: opts.path,
      _event_type: opts.event_type,
      _reason: opts.reason,
      _metadata: opts.metadata ?? {},
    });
    if (error) console.error("[audit] rpc error", error.message);
  } catch (e) {
    console.error("[audit] exception", (e as Error).message);
  }
}

function unauthorized(message: string, status = 401, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AuthResult =
  | { user: { id: string; email: string | null }; response?: undefined }
  | { user?: undefined; response: Response };

export async function requireUser(req: Request): Promise<AuthResult> {
  const ip = clientIp(req);
  const path = pathOf(req);
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    await auditLog({ user_id: null, email: null, ip, path, event_type: "auth_required", reason: "missing_bearer_token" });
    return { response: unauthorized("auth_required") };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) return { response: unauthorized("auth_unavailable", 500) };

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    await auditLog({ user_id: null, email: null, ip, path, event_type: "auth_required", reason: error?.message ?? "invalid_token" });
    return { response: unauthorized("auth_required") };
  }
  if (data.user.is_anonymous) {
    await auditLog({ user_id: data.user.id, email: data.user.email ?? null, ip, path, event_type: "auth_required", reason: "anonymous_user" });
    return { response: unauthorized("auth_required") };
  }
  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

export async function requireOwner(req: Request): Promise<AuthResult> {
  const r = await requireUser(req);
  if (r.response) return r;
  if ((r.user.email || "").toLowerCase().trim() !== OWNER_EMAIL) {
    await auditLog({
      user_id: r.user.id,
      email: r.user.email,
      ip: clientIp(req),
      path: pathOf(req),
      event_type: "forbidden",
      reason: "non_owner_blocked",
    });
    return { response: unauthorized("forbidden", 403) };
  }
  return r;
}

/**
 * Enforce per-user per-endpoint rate limit. Owner bypasses.
 * Default: 60 requests / 60s. Pass overrides per endpoint as needed.
 * Returns a 429 Response when exceeded, otherwise undefined.
 */
export async function enforceRateLimit(
  req: Request,
  user: { id: string; email: string | null },
  endpoint: string,
  opts: { limit?: number; windowSeconds?: number } = {},
): Promise<Response | undefined> {
  const limit = opts.limit ?? 60;
  const windowSeconds = opts.windowSeconds ?? 60;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) return undefined;

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  try {
    const { data, error } = await client.rpc("check_ai_rate_limit", {
      _endpoint: endpoint,
      _limit: limit,
      _window_seconds: windowSeconds,
    });
    if (error) return undefined; // fail-open: don't lock users out on infra error
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      await auditLog({
        user_id: user.id,
        email: user.email,
        ip: clientIp(req),
        path: pathOf(req),
        event_type: "rate_limited",
        reason: `over_limit:${endpoint}`,
        metadata: { current_count: row.current_count, rate_limit: row.rate_limit },
      });
      return unauthorized("rate_limited", 429, {
        retry_after_seconds: windowSeconds,
        limit: row.rate_limit,
      });
    }
  } catch {
    // fail-open on unexpected error
  }
  return undefined;
}
