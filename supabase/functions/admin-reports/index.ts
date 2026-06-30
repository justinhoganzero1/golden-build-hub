// admin-reports — owner-only proxy that calls the SECURITY DEFINER admin
// reporting helpers (provider P&L, user usage breakdown, Stripe event
// summary, margin alert check) using the service-role key. Also serves a
// strictly-validated CSV export of auth_audit_log so the browser cannot
// inject filters server-side.
//
// All admin endpoints are protected by:
//   1. requireOwner — locked owner email only
//   2. enforceRateLimit — per-endpoint throttle to prevent scraping
//   3. Hard input validation (no SQL is ever built from user input;
//      every filter goes through PostgREST builders with whitelisted keys).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { enforceRateLimit, requireOwner } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const REPORTS = [
  "provider_pnl",
  "user_usage",
  "stripe_events",
  "check_margin",
  "all_dashboards",
  "audit_export",
] as const;
type Report = (typeof REPORTS)[number];

const EVENT_TYPES = new Set([
  "all",
  "auth_required",
  "forbidden",
  "rate_limited",
  "denied_free_access",
]);

const clampInt = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const clampFloat = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

// Strict pattern for free-text filters — alphanumerics + a few harmless punctuation
// chars. PostgREST builders parameterize these, but we still reject anything weird.
const SAFE_FILTER = /^[A-Za-z0-9._\-@:/+ ]{0,128}$/;

const csvEscape = (v: unknown): string => {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireOwner(req);
  if (auth.response) return auth.response;

  // Throttle even the owner — admin-reports is the only route to a few
  // sensitive aggregates and to the full audit log; 30 req/min is plenty
  // for the dashboard and stops accidental scraping loops.
  const rl = await enforceRateLimit(req, auth.user, "admin-reports", {
    limit: 30,
    windowSeconds: 60,
  });
  if (rl) return rl;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const report = body.report as Report;
  if (!REPORTS.includes(report)) return json({ error: "unknown_report" }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "infra_missing" }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const days = clampInt(body.days, 1, 365, 30);
  const hours = clampInt(body.hours, 1, 24 * 30, 24);
  const threshold_pct = clampFloat(body.threshold_pct, 0, 100, 15);
  const limit = clampInt(body.limit, 1, 500, 25);

  try {
    switch (report) {
      case "provider_pnl": {
        const { data, error } = await admin.rpc("provider_pnl_summary", { _days: days });
        if (error) throw error;
        return json({ rows: data ?? [] });
      }
      case "user_usage": {
        const { data, error } = await admin.rpc("user_usage_breakdown", { _days: days, _limit: limit });
        if (error) throw error;
        return json({ rows: data ?? [] });
      }
      case "stripe_events": {
        const { data, error } = await admin.rpc("stripe_event_summary", { _hours: hours });
        if (error) throw error;
        return json({ rows: data ?? [] });
      }
      case "check_margin": {
        const { data, error } = await admin.rpc("check_margin_and_alert", {
          _threshold_pct: threshold_pct,
          _days: days,
        });
        if (error) throw error;
        return json({ alert_id: data });
      }
      case "all_dashboards": {
        const [pnl, usage, events, margin] = await Promise.all([
          admin.rpc("provider_pnl_summary", { _days: days }),
          admin.rpc("user_usage_breakdown", { _days: days, _limit: limit }),
          admin.rpc("stripe_event_summary", { _hours: hours }),
          admin.rpc("check_margin_and_alert", { _threshold_pct: threshold_pct, _days: days }),
        ]);
        return json({
          provider_pnl: pnl.data ?? [],
          user_usage: usage.data ?? [],
          stripe_events: events.data ?? [],
          margin_alert_id: margin.data ?? null,
        });
      }
      case "audit_export": {
        // Validate every filter before it reaches PostgREST.
        const exportHours = clampInt(body.hours, 1, 24 * 90, 24);
        const exportLimit = clampInt(body.limit, 1, 5000, 1000);
        const eventFilter = String(body.event_filter ?? "all");
        if (!EVENT_TYPES.has(eventFilter)) {
          return json({ error: "invalid_event_filter" }, 400);
        }
        const pathQ = body.path_q == null ? "" : String(body.path_q).trim();
        const userQ = body.user_q == null ? "" : String(body.user_q).trim();
        if (!SAFE_FILTER.test(pathQ) || !SAFE_FILTER.test(userQ)) {
          return json({ error: "invalid_filter_chars" }, 400);
        }

        const since = new Date(Date.now() - exportHours * 3600 * 1000).toISOString();
        let q = admin
          .from("auth_audit_log")
          .select("id, created_at, user_id, email, ip, path, event_type, reason, metadata")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(exportLimit);
        if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
        if (pathQ) q = q.ilike("path", `%${pathQ}%`);
        if (userQ) {
          // OR across email / user_id / ip — PostgREST parameterizes safely.
          q = q.or(`email.ilike.%${userQ}%,user_id.ilike.%${userQ}%,ip.ilike.%${userQ}%`);
        }

        const { data, error } = await q;
        if (error) throw error;
        const rows = data ?? [];

        const cols = ["created_at", "event_type", "reason", "path", "email", "user_id", "ip", "metadata"] as const;
        const lines = [cols.join(",")];
        for (const r of rows as Array<Record<string, unknown>>) {
          lines.push(cols.map((c) => csvEscape(r[c])).join(","));
        }
        const csv = lines.join("\n");

        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        return new Response(csv, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="auth-audit-${exportHours}h-${eventFilter}-${stamp}.csv"`,
            "X-Row-Count": String(rows.length),
          },
        });
      }
    }
  } catch (e) {
    console.error("admin-reports error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
