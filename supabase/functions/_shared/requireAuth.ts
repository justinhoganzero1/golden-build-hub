// Shared auth helpers for edge functions.
// requireUser: returns the authenticated user or a 401 Response.
// requireOwner: returns the authenticated owner or a 401/403 Response.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const OWNER_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function unauthorized(message: string, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type AuthResult =
  | { user: { id: string; email: string | null }; response?: undefined }
  | { user?: undefined; response: Response };

export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { response: unauthorized("auth_required") };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !ANON_KEY) return { response: unauthorized("auth_unavailable", 500) };

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return { response: unauthorized("auth_required") };
  if (data.user.is_anonymous) return { response: unauthorized("auth_required") };
  return { user: { id: data.user.id, email: data.user.email ?? null } };
}

export async function requireOwner(req: Request): Promise<AuthResult> {
  const r = await requireUser(req);
  if (r.response) return r;
  if ((r.user.email || "").toLowerCase().trim() !== OWNER_EMAIL) {
    return { response: unauthorized("forbidden", 403) };
  }
  return r;
}
