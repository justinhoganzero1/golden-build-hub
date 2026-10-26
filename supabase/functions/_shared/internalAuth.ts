import { requireOwner } from "./requireAuth.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2.118.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

function sameText(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** True when the request carries the database scheduler's private token. */
export async function hasSchedulerToken(req: Request): Promise<boolean> {
  const supplied = req.headers.get("x-internal-job-token") ?? "";
  if (supplied.length < 32) return false;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("internal_job_token");
  return !error && typeof data === "string" && sameText(data, supplied);
}

/** Only trusted internal service requests, the scheduler, or a verified owner can run global workers. */
export async function requireInternalOrOwner(req: Request): Promise<Response | undefined> {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (sameText(key, token)) return undefined;
  try { if (await hasSchedulerToken(req)) return undefined; } catch { /* fall through */ }
  try { return (await requireOwner(req)).response; }
  catch { return new Response(JSON.stringify({ error: "worker_access_unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
}
