// Creates a Google Calendar event for the authenticated user using stored tokens.
// Auto-refreshes expired access tokens.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

async function refreshIfNeeded(admin: any, row: any) {
  const expMs = new Date(row.expires_at).getTime();
  if (expMs - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) throw new Error('no_refresh_token');

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: row.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const t = await res.json();
  if (!res.ok) throw new Error(`refresh_failed: ${JSON.stringify(t)}`);
  const newExpiry = new Date(Date.now() + (Number(t.expires_in ?? 3600) * 1000)).toISOString();
  await admin.from('user_google_tokens').update({
    access_token: t.access_token, expires_at: newExpiry,
  }).eq('user_id', row.user_id);
  return t.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ud, error: ue } = await userClient.auth.getUser();
    if (ue || !ud.user) return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    const { summary, description, start_iso, end_iso, attendees } = await req.json();
    if (!summary || !start_iso || !end_iso) {
      return new Response(JSON.stringify({ error: 'summary, start_iso, end_iso required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: row, error: re } = await admin.from('user_google_tokens')
      .select('*').eq('user_id', ud.user.id).maybeSingle();
    if (re || !row) {
      return new Response(JSON.stringify({ error: 'google_not_connected' }), {
        status: 412, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await refreshIfNeeded(admin, row);
    const calendarId = encodeURIComponent(row.calendar_id || 'primary');

    const evRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary, description: description ?? '',
          start: { dateTime: start_iso },
          end: { dateTime: end_iso },
          attendees: Array.isArray(attendees) ? attendees.map((e: string) => ({ email: e })) : undefined,
        }),
      },
    );
    const ev = await evRes.json();
    if (!evRes.ok) {
      return new Response(JSON.stringify({ error: 'gcal_create_failed', detail: ev }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, event: ev }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
