// record-arrival — notes the first page a website visitor opened and their
// country. Anonymous: the visitor's network address is never stored, only the
// country the network reports (or, failing that, the browser's time zone).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { countryName } from "../_shared/countries.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const clip = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

const NETWORK_COUNTRY_HEADERS = ["cf-ipcountry", "x-country-code", "x-vercel-ip-country", "cloudfront-viewer-country", "x-geo-country"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const landing = clip(body.landing_path, 200);
  if (!landing || !landing.startsWith("/")) return json({ error: "invalid_landing_path" }, 400);

  let country: string | null = null;
  let basis: "network" | "timezone" | null = null;
  for (const h of NETWORK_COUNTRY_HEADERS) {
    const code = req.headers.get(h)?.trim().toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1") {
      country = countryName(code);
      basis = "network";
      break;
    }
  }
  if (!country) {
    const guess = clip(body.tz_country, 2)?.toUpperCase();
    if (guess && /^[A-Z]{2}$/.test(guess)) { country = countryName(guess); basis = "timezone"; }
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { error } = await admin.from("site_arrivals").insert({
    landing_path: landing,
    source: (clip(body.source, 100) ?? "direct").toLowerCase(),
    medium: clip(body.medium, 100),
    campaign: clip(body.campaign, 100),
    referrer: clip(body.referrer, 500),
    user_agent: clip(req.headers.get("user-agent"), 200),
    country,
    country_basis: basis,
  });
  if (error) {
    console.error("record-arrival insert failed", error.message);
    return json({ error: "not_saved" }, 500);
  }
  return json({ ok: true, country, basis });
});
