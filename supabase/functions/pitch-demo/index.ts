// Public demo viewer for the owner's Client Pitch Machine.
// Returns the presentation + locked demo only while the owner has the link
// switched on and it hasn't passed its 7-day expiry. No sign-in needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { demoState, lockDemoHtml, normaliseDeck } from "../_shared/pitchDemo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let token = new URL(req.url).searchParams.get("token") || "";
  if (!token && req.method === "POST") token = String((await req.json().catch(() => ({})))?.token || "");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json({ state: "missing" }, 404);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: row } = await supabase.from("pitch_projects")
    .select("id,business_name,demo_html,deck,snapshot,demo_enabled,demo_expires_at,demo_views")
    .eq("demo_token", token).maybeSingle();
  if (!row) return json({ state: "missing" }, 404);

  const state = demoState(row);
  if (state !== "active") return json({ state, business_name: row.business_name });

  await supabase.from("pitch_projects").update({ demo_views: (row.demo_views || 0) + 1, demo_last_viewed_at: new Date().toISOString() }).eq("id", row.id);

  let currentSite: string | undefined;
  const path = (row.snapshot as any)?.desktop_path;
  if (path) {
    const { data } = await supabase.storage.from("pitch-assets").createSignedUrl(path, 3600);
    currentSite = data?.signedUrl;
  }

  return json({
    state,
    business_name: row.business_name,
    expires_at: row.demo_expires_at,
    slides: normaliseDeck(row.deck),
    current_site_image: currentSite || null,
    html: lockDemoHtml(row.demo_html || "", { businessName: row.business_name || "", expiresAt: row.demo_expires_at }),
  });
});
