import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireOwner } from "../_shared/requireAuth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const owner = await requireOwner(req);
  if (owner.response) return owner.response;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const input = await req.json().catch(() => null);
  if (!input || input.check !== true) return json({ error: "check_required" }, 400);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "configuration_unavailable" }, 503);
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db.rpc("run_daily_safety_check");
    if (error) return json({ error: "safety_review_failed" }, 503);
    const { data: report, error: readError } = await db.from("system_health_reports").select("checks,created_at").eq("source", "daily-database").order("created_at", { ascending: false }).limit(1).single();
    if (readError) return json({ error: "report_unavailable" }, 503);
    const configuration = ["RESEND_API_KEY", "STRIPE_SANDBOX_API_KEY", "PAYMENTS_SANDBOX_WEBHOOK_SECRET", "STRIPE_LIVE_API_KEY", "PAYMENTS_LIVE_WEBHOOK_SECRET", "TWILIO_API_KEY", "TWILIO_AUTH_TOKEN", "LOVABLE_API_KEY"].map(name => ({ name: name.replaceAll("_", " "), status: Deno.env.get(name) ? "pass" : "warn", detail: Deno.env.get(name) ? "Configured; live operations not tested" : "Not configured" }));
    return json({ checks: [...report.checks, ...configuration], checkedAt: report.created_at, paidOperationsTested: false });
  } catch { return json({ error: "health_check_unavailable" }, 503); }
});