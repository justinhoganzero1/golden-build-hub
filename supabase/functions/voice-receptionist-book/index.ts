// Books an appointment into Oracle calendar_events AND Google Calendar.
// POST { contact_id, start_iso, duration_minutes?, title?, notes? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_CALENDAR_API_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { contact_id, start_iso, duration_minutes, title, notes } = body;
    if (!contact_id || !start_iso) {
      return new Response(JSON.stringify({ error: "contact_id and start_iso required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: cfg } = await supabase.from("voice_agent_config").select("*").limit(1).maybeSingle();
    const dur = duration_minutes || cfg?.booking_duration_minutes || 30;
    const start = new Date(start_iso);
    const end = new Date(start.getTime() + dur * 60_000);

    const { data: contact } = await supabase.from("crm_contacts").select("*").eq("id", contact_id).maybeSingle();
    if (!contact) return new Response(JSON.stringify({ error: "contact not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });

    const apptTitle = title || `Call: ${contact.name || contact.phone || "Caller"}`;
    const apptNotes = notes || `Booked via Voice AI Receptionist.\nPhone: ${contact.phone || ""}\nEmail: ${contact.email || ""}`;

    // Conflict check in Oracle calendar
    const { data: conflicts } = await supabase.from("calendar_events").select("id,title,start_time,end_time")
      .lte("start_time", end.toISOString()).gte("end_time", start.toISOString()).limit(1);
    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({ error: "slot taken", conflict: conflicts[0] }), { status: 409, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Insert into Oracle calendar — owner's calendar
    // Find owner user_id
    const { data: ownerRole } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    const ownerId = ownerRole?.user_id;

    let oracleEventId: string | null = null;
    if (ownerId) {
      const { data: ev } = await supabase.from("calendar_events").insert({
        user_id: ownerId, title: apptTitle, description: apptNotes,
        start_time: start.toISOString(), end_time: end.toISOString(),
        category: "appointment", metadata: { source: "voice_receptionist", contact_id },
      }).select("id").maybeSingle();
      oracleEventId = ev?.id ?? null;
    }

    // Google Calendar dual-write — uses the BUSINESS OWNER's connected Google account
    // (per-user OAuth tokens stored in user_google_tokens). Auto-refresh on expiry.
    let googleEventId: string | null = null;
    let googleError: string | null = null;
    if (cfg?.google_calendar_enabled && ownerId) {
      try {
        const { data: tokRow } = await supabase.from("user_google_tokens")
          .select("*").eq("user_id", ownerId).maybeSingle();
        if (!tokRow) {
          googleError = "owner_google_not_connected";
        } else {
          let accessToken = tokRow.access_token as string;
          const expMs = new Date(tokRow.expires_at).getTime();
          if (expMs - Date.now() < 60_000 && tokRow.refresh_token) {
            const cid = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
            const csec = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
            const rr = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: cid, client_secret: csec,
                refresh_token: tokRow.refresh_token, grant_type: "refresh_token",
              }),
            });
            const tj = await rr.json();
            if (rr.ok) {
              accessToken = tj.access_token;
              await supabase.from("user_google_tokens").update({
                access_token: tj.access_token,
                expires_at: new Date(Date.now() + Number(tj.expires_in ?? 3600) * 1000).toISOString(),
              }).eq("user_id", ownerId);
            } else {
              googleError = `refresh_failed: ${JSON.stringify(tj).slice(0, 200)}`;
            }
          }
          if (!googleError) {
            const calId = encodeURIComponent(tokRow.calendar_id || cfg.booking_calendar_id || "primary");
            const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calId}/events`, {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                summary: apptTitle, description: apptNotes,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
                attendees: contact.email ? [{ email: contact.email }] : undefined,
              }),
            });
            const gj = await r.json();
            if (!r.ok) googleError = `${r.status}: ${JSON.stringify(gj).slice(0, 200)}`;
            else googleEventId = gj.id;
          }
        }
      } catch (e) { googleError = String(e); }
    }

    // Move contact to "Booked" stage
    const { data: bookedStage } = await supabase.from("crm_pipeline_stages").select("id").eq("name", "Booked").maybeSingle();
    if (bookedStage) await supabase.from("crm_contacts").update({ stage_id: bookedStage.id }).eq("id", contact_id);

    await supabase.from("crm_activities").insert({
      contact_id, activity_type: "booking", channel: "calendar",
      subject: apptTitle, body: apptNotes,
      payload: { start: start.toISOString(), end: end.toISOString(), oracleEventId, googleEventId, googleError },
    });

    // Fire external webhook
    if (cfg?.external_webhook_url) {
      try {
        await fetch(cfg.external_webhook_url, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "booking.created", contact, start: start.toISOString(), end: end.toISOString(), oracleEventId, googleEventId }),
        });
      } catch (e) { console.warn("webhook fanout fail", e); }
    }

    return new Response(JSON.stringify({ ok: true, oracleEventId, googleEventId, googleError }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("book error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
