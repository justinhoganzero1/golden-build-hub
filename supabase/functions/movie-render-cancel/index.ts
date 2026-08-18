// movie-render-cancel — cancel a project's in-flight render jobs and release
// the money exactly once. Held funds are released with billing_cancel; already
// settled charges are refunded with billing_refund. Cancelled jobs can be
// requeued afterwards without being charged twice, because every release is
// keyed to a transaction that is only touched while it is still open.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;

    const { project_id: projectId, refund = true } = await req.json().catch(() => ({}));
    if (!projectId || typeof projectId !== "string") return json({ error: "project_id required" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: project } = await svc
      .from("movie_projects")
      .select("id, user_id, status")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) return json({ error: "project not found" }, 404);
    if (project.user_id !== auth.user.id) return json({ error: "forbidden" }, 403);

    // 1. Stop every job that has not finished. Running jobs are marked
    //    cancelled too; the worker checks status before writing results.
    const { data: stopped } = await svc
      .from("movie_render_jobs")
      .update({ status: "cancelled", locked_by: null, locked_at: null, completed_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .in("status", ["queued", "running"])
      .select("id");

    await svc
      .from("movie_projects")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", projectId);

    // 2. Release money exactly once per open transaction for this project.
    const { data: txs } = await svc
      .from("billing_transactions")
      .select("id, status, total_micros")
      .eq("user_id", auth.user.id)
      .eq("service", "movie_render")
      .contains("metadata", { project_id: projectId });

    let releasedCents = 0;
    const released: string[] = [];
    for (const tx of txs ?? []) {
      if (tx.status === "held") {
        const { error } = await svc.rpc("billing_cancel", { _transaction_id: tx.id, _reason: "user_cancelled_render" });
        if (!error) {
          released.push(tx.id);
          releasedCents += Math.round((tx.total_micros ?? 0) / 10_000);
        }
      } else if (tx.status === "settled" && refund) {
        const { error } = await svc.rpc("billing_refund", {
          _transaction_id: tx.id,
          _refund_micros: tx.total_micros,
          _reason: "user_cancelled_render",
        });
        if (!error) {
          released.push(tx.id);
          releasedCents += Math.round((tx.total_micros ?? 0) / 10_000);
        }
      }
      // Any other status (already cancelled/refunded) is skipped — this is what
      // keeps a cancel + requeue from refunding or charging twice.
    }

    return json({
      success: true,
      jobs_cancelled: stopped?.length ?? 0,
      transactions_released: released.length,
      released_cents: releasedCents,
    });
  } catch (e) {
    console.error("movie-render-cancel error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
