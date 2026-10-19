import { createClient } from "npm:@supabase/supabase-js@2";

/** A committed claim prevents repeating an external side effect after a timeout. */
export async function claimOperation(userId: string, service: "kindle-send" | "outbound-call", requestKey: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Operation storage unavailable");
  const db = createClient(url, key);
  const { data, error } = await db.rpc("claim_paid_operation", { _user_id: userId, _service: service, _request_key: requestKey });
  if (error || !data?.id) throw new Error("Operation claim unavailable");
  return {
    id: String(data.id), duplicate: data.duplicate === true, state: String(data.state ?? "claimed"), result: data.result ?? {},
    async finish(state: string, result: Record<string, unknown>) {
      const { error } = await db.from("operation_claims").update({ state, result, updated_at: new Date().toISOString() }).eq("id", data.id);
      if (error) throw new Error("Operation result could not be recorded; do not repeat it");
    },
  };
}