// admin-reports — owner-only proxy that calls the four SECURITY DEFINER
// admin reporting helpers (provider P&L, user usage breakdown, Stripe event
// summary, margin alert check) using the service-role key. The underlying
// RPCs are revoked from `anon` and `authenticated` at the DB level, so this
// edge function is the only way to reach them — and `requireOwner` ensures
// only the locked owner email can invoke it.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireOwner } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Body = {
  report:
    | "provider_pnl"
    | "user_usage"
    | "stripe_events"
    | "check_margin"
    | "all_dashboards";
  days?: number;
  hours?: number;
  threshold_pct?: number;
  limit?: number;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireOwner(req);
  if (auth.response) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "infra_missing" }, 500);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const days = Math.max(1, Math.min(365, body.days ?? 30));
  const hours = Math.max(1, Math.min(24 * 30, body.hours ?? 24));
  const threshold_pct = Math.max(0, Math.min(100, body.threshold_pct ?? 15));
  const limit = Math.max(1, Math.min(500, body.limit ?? 25));

  try {
    switch (body.report) {
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
      default:
        return json({ error: "unknown_report" }, 400);
    }
  } catch (e) {
    console.error("admin-reports error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
