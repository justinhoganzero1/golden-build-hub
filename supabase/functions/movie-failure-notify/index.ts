// Hourly sweep: finds failed movie projects that haven't been notified yet,
// inserts a row into inquiry_leads (acts as in-app notification inbox for now)
// and marks the project so we don't double-notify.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Find failed projects in last 24h whose youtube_metadata.notified is not true
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: projects } = await supabase
    .from("movie_projects")
    .select("id, user_id, title, last_error, youtube_metadata")
    .eq("status", "failed")
    .gte("updated_at", since);

  let notified = 0;
  for (const p of projects ?? []) {
    const meta = (p.youtube_metadata as any) ?? {};
    if (meta.notified) continue;

    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const email = u?.user?.email ?? null;

    await supabase.from("inquiry_leads").insert({
      source: "movie_failure",
      email,
      name: u?.user?.user_metadata?.full_name ?? null,
      message: `Your movie "${p.title}" failed to render. Error: ${p.last_error ?? "unknown"}. Open Movie Studio Pro to retry the failed scenes.`,
      interest: "movie_studio_pro",
      status: "new",
    });

    await supabase.from("movie_projects")
      .update({ youtube_metadata: { ...meta, notified: true, notified_at: new Date().toISOString() } })
      .eq("id", p.id);

    notified++;
  }

  return new Response(JSON.stringify({ ok: true, scanned: projects?.length ?? 0, notified }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
