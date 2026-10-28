// Payments Health Check — owner-only.
// Verifies the Lovable-managed payments environment is configured:
// gateway keys, webhook secrets, and the payments-webhook function.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_REF = Deno.env.get("SUPABASE_URL")?.match(/https:\/\/([^.]+)\./)?.[1] ?? "";
const EXPECTED_WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/payments-webhook`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  const ok = (name: string, detail = "OK") => checks.push({ name, ok: true, detail });
  const fail = (name: string, detail: string) => checks.push({ name, ok: false, detail });

  try {
    const auth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    const { data: c, error: ce } = await auth.auth.getClaims(token);
    const email = (c?.claims?.email as string | undefined)?.toLowerCase().trim();
    if (ce || email !== "justinbretthogan@gmail.com") {
      return new Response(JSON.stringify({ error: "owner only" }), { status: 403, headers: corsHeaders });
    }

    if (Deno.env.get("STRIPE_SANDBOX_API_KEY")) ok("Test payments", "Test environment connected");
    else fail("Test payments", "Not connected — enable payments in the Payments tab");

    if (Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET")) ok("Test webhook", "Registered and signing secret stored");
    else fail("Test webhook", "Webhook secret missing");

    if (Deno.env.get("STRIPE_LIVE_API_KEY")) ok("Live payments", "Live account connected — real money enabled");
    else fail("Live payments", "Not live yet — finish the go-live steps in the Payments tab");

    if (Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET")) ok("Live webhook", "Registered");
    else fail("Live webhook", "Created automatically after go-live");

    if (Deno.env.get("LOVABLE_API_KEY")) ok("Gateway auth", "Configured");
    else fail("Gateway auth", "LOVABLE_API_KEY missing");

    const all_ok = checks.every((c) => c.ok);
    return new Response(
      JSON.stringify({ checks, all_ok, expected_webhook_url: EXPECTED_WEBHOOK_URL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e), checks }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
