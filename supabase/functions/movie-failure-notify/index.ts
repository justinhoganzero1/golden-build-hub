// Hourly sweep: notifies users about (a) failed projects and (b) newly-completed projects.
// Inserts an in-app inbox row + sends a Resend email. Marks notified flag so we don't double-notify.
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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  let notified = 0;
  let emailed = 0;

  // ============= FAILED PROJECTS =============
  const { data: failed } = await supabase
    .from("movie_projects")
    .select("id, user_id, title, last_error, youtube_metadata")
    .eq("status", "failed")
    .gte("updated_at", since);

  for (const p of failed ?? []) {
    const meta = (p.youtube_metadata as any) ?? {};
    if (meta.notified) continue;

    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const email = u?.user?.email ?? null;
    const name = u?.user?.user_metadata?.full_name ?? null;
    const errMsg = p.last_error ?? "unknown error";

    await supabase.from("inquiry_leads").insert({
      source: "movie_failure",
      email,
      name,
      message: `Your movie "${p.title}" failed to render. Error: ${errMsg}. Open Movie Studio Pro to retry the failed scenes.`,
      interest: "movie_studio_pro",
      status: "new",
    });

    if (RESEND_API_KEY && email) {
      try {
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0b0f;color:#f5f5f7;border-radius:12px">
            <h2 style="color:#f5b042;margin:0 0 12px">🎬 Movie render needs your attention</h2>
            <p>Hi ${name ?? "there"},</p>
            <p>Your project <strong>"${p.title}"</strong> ran into an issue while rendering:</p>
            <pre style="background:#1a1a22;padding:12px;border-radius:8px;color:#ff9b9b;white-space:pre-wrap;font-size:13px">${errMsg}</pre>
            <p>Good news — it's saved as a draft. Open Movie Studio Pro and tap <strong>Retry failed scenes</strong> to pick up where it left off.</p>
            <p style="margin-top:24px">
              <a href="https://oracle-lunar.online/movie-studio-pro" style="background:#f5b042;color:#0b0b0f;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open Movie Studio Pro</a>
            </p>
            <p style="color:#888;font-size:12px;margin-top:32px">— ORACLE LUNAR Movie Studio</p>
          </div>`;
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ORACLE LUNAR Movies <onboarding@resend.dev>",
            to: [email],
            subject: `🎬 Your movie "${p.title}" needs a quick retry`,
            html,
          }),
        });
        if (resp.ok) emailed++;
        else console.error("Resend send failed:", await resp.text());
      } catch (e) {
        console.error("Resend error:", e);
      }
    }

    await supabase.from("movie_projects")
      .update({ youtube_metadata: { ...meta, notified: true, notified_at: new Date().toISOString(), emailed: emailed > 0 } })
      .eq("id", p.id);
    notified++;
  }

  // ============= COMPLETED PROJECTS (success notification) =============
  const { data: completed } = await supabase
    .from("movie_projects")
    .select("id, user_id, title, final_video_url, thumbnail_url, trailer_url, youtube_metadata")
    .eq("status", "completed")
    .gte("completed_at", since);

  for (const p of completed ?? []) {
    const meta = (p.youtube_metadata as any) ?? {};
    if (meta.completion_notified) continue;

    const { data: u } = await supabase.auth.admin.getUserById(p.user_id);
    const email = u?.user?.email ?? null;
    const name = u?.user?.user_metadata?.full_name ?? null;

    await supabase.from("inquiry_leads").insert({
      source: "movie_completed",
      email,
      name,
      message: `🎉 Your movie "${p.title}" is ready to watch! Open Movie Studio Pro to view, share, or publish to YouTube.`,
      interest: "movie_studio_pro",
      status: "new",
    });

    if (RESEND_API_KEY && email && p.final_video_url) {
      try {
        const thumb = p.thumbnail_url
          ? `<img src="${p.thumbnail_url}" alt="${p.title}" style="width:100%;border-radius:8px;margin:12px 0" />`
          : "";
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0b0f;color:#f5f5f7;border-radius:12px">
            <h2 style="color:#f5b042;margin:0 0 12px">🎉 Your movie is ready!</h2>
            <p>Hi ${name ?? "there"},</p>
            <p><strong>"${p.title}"</strong> finished rendering and is ready to watch.</p>
            ${thumb}
            <p style="margin-top:24px;display:flex;gap:8px;flex-wrap:wrap">
              <a href="${p.final_video_url}" style="background:#f5b042;color:#0b0b0f;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">▶ Watch</a>
              <a href="https://oracle-lunar.online/movie-studio-pro" style="background:#1a1a22;color:#f5f5f7;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #333">Open Studio</a>
            </p>
            ${p.trailer_url ? `<p style="margin-top:12px"><a href="${p.trailer_url}" style="color:#f5b042">🎞 Watch the trailer</a></p>` : ""}
            <p style="color:#888;font-size:12px;margin-top:32px">— ORACLE LUNAR Movie Studio</p>
          </div>`;
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "ORACLE LUNAR Movies <onboarding@resend.dev>",
            to: [email],
            subject: `🎬 "${p.title}" is ready to watch`,
            html,
          }),
        });
        if (resp.ok) emailed++;
        else console.error("Resend completion send failed:", await resp.text());
      } catch (e) {
        console.error("Resend completion error:", e);
      }
    }

    await supabase.from("movie_projects")
      .update({ youtube_metadata: { ...meta, completion_notified: true, completion_notified_at: new Date().toISOString() } })
      .eq("id", p.id);
    notified++;
  }

  return new Response(JSON.stringify({
    ok: true,
    failed_scanned: failed?.length ?? 0,
    completed_scanned: completed?.length ?? 0,
    notified,
    emailed,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
