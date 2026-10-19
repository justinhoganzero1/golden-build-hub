import { requireOwner } from "./requireAuth.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** Only trusted internal service requests or a verified owner can run global workers. */
export async function requireInternalOrOwner(req: Request): Promise<Response | undefined> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (key && token && token.length === key.length) {
    let difference = 0;
    for (let i = 0; i < key.length; i++) difference |= key.charCodeAt(i) ^ token.charCodeAt(i);
    if (difference === 0) return undefined;
  }
  try { return (await requireOwner(req)).response; }
  catch { return new Response(JSON.stringify({ error: "worker_access_unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
}