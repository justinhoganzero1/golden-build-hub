// Real lip-sync for the YouTube newsroom host (Replicate prunaai/p-video-avatar).
// Actions: quote (free), start (holds funds, starts the job), status (polls; on success
// stores the clip privately, settles the exact cost + 20%, then returns the clip).
// The clip is never released before billing settles, and failed jobs release the hold.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizeAI, cancelAI, getUserFromRequest, InsufficientCoinsError, insufficientCoinsResponse, settleAI } from "../_shared/wallet.ts";
import {
  FALLBACK_AUD_PER_USD, LIPSYNC_MAX_SECONDS, LIPSYNC_MODEL, mp4DurationSeconds, ownsPath, quoteLipsync,
  type LipsyncResolution,
} from "../_shared/lipsyncPricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BUCKET = "photography-assets";
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function audPerUsd(): Promise<number> {
  try {
    const ctl = AbortSignal.timeout(3000);
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=AUD", { signal: ctl });
    const j = await r.json();
    const rate = Number(j?.rates?.AUD);
    if (rate > 0.5 && rate < 5) return rate;
  } catch { /* fall through */ }
  return FALLBACK_AUD_PER_USD;
}

function replicateHeaders() {
  return { Authorization: `Bearer ${Deno.env.get("REPLICATE_API_TOKEN")}`, "Content-Type": "application/json" };
}

async function createPrediction(input: Record<string, unknown>): Promise<{ id: string }> {
  const r = await fetch(`https://api.replicate.com/v1/models/${LIPSYNC_MODEL}/predictions`, {
    method: "POST", headers: replicateHeaders(), body: JSON.stringify({ input }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.id) throw new Error(`replicate_start ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return { id: j.id };
}

async function signed(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await admin().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw new Error(`sign_failed ${error?.message ?? ""}`);
  return data.signedUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUserFromRequest(req);
    if (!user) return json({ error: "auth_required" }, 401);
    if (!Deno.env.get("REPLICATE_API_TOKEN")) return json({ error: "lipsync_unavailable", message: "Lip-sync isn't set up yet." }, 503);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const resolution: LipsyncResolution = body.resolution === "1080p" ? "1080p" : "720p";
    const db = admin();

    if (action === "quote") {
      const seconds = Math.min(LIPSYNC_MAX_SECONDS, Math.max(1, Number(body.seconds) || 0));
      const q = quoteLipsync(seconds, resolution, await audPerUsd());
      return json({ quote: { seconds: q.seconds, total_cents: q.total_cents } });
    }

    if (action === "start") {
      const seconds = Number(body.seconds);
      const requestKey = String(body.request_key ?? "").slice(0, 100);
      if (!(seconds > 0) || seconds > LIPSYNC_MAX_SECONDS) return json({ error: "too_long", message: `Lip-sync works on voices up to ${LIPSYNC_MAX_SECONDS / 60} minutes.` }, 400);
      if (!requestKey) return json({ error: "request_key required" }, 400);
      if (!ownsPath(user.id, body.image_path) || !ownsPath(user.id, body.audio_path)) return json({ error: "bad_files" }, 400);

      const { data: existing } = await db.from("host_lipsync_jobs").select("id,status").eq("user_id", user.id).eq("request_key", requestKey).maybeSingle();
      if (existing) return json({ job_id: existing.id, status: existing.status, duplicate: true });

      const fx = await audPerUsd();
      const quote = quoteLipsync(seconds, resolution, fx);
      // Hold one extra second in case the clip runs a touch longer than the voice.
      const hold = quoteLipsync(Math.ceil(seconds) + 1, resolution, fx);
      const { data: job, error: insErr } = await db.from("host_lipsync_jobs").insert({
        user_id: user.id, request_key: requestKey, status: "starting", resolution,
        requested_seconds: seconds, usd_per_second: quote.usd_per_second, aud_per_usd: fx,
        script_hash: typeof body.script_hash === "string" ? body.script_hash.slice(0, 80) : null,
      }).select("id").single();
      if (insErr || !job) throw new Error(`job_insert ${insErr?.message}`);

      let txId: string;
      try {
        const auth = await authorizeAI(user.id, `lipsync:${requestKey}`, "lipsync_host", "replicate", LIPSYNC_MODEL, hold.provider_cost_cents,
          { job_id: job.id, seconds, resolution, aud_per_usd: fx });
        txId = auth.transaction_id;
      } catch (e) {
        await db.from("host_lipsync_jobs").update({ status: "failed", error: "not_authorized", updated_at: new Date().toISOString() }).eq("id", job.id);
        if (e instanceof InsufficientCoinsError) return insufficientCoinsResponse(e, corsHeaders);
        throw e;
      }

      try {
        const [image, audio] = await Promise.all([signed(body.image_path), signed(body.audio_path)]);
        const pred = await createPrediction({
          image, audio, resolution,
          // Interview tracks are silent while the other person speaks: they listen with lips closed.
          video_prompt: body.listening === true
            ? "A friendly TV news presenter in a studio interview. Talks naturally while their voice plays; during silence they listen quietly with lips closed, small nods and blinking. The plain solid green background stays exactly the same."
            : "A friendly TV news presenter talking to camera with natural head movement and blinking. The plain solid green background stays exactly the same.",
          negative_prompt: "background change, camera movement, zoom, text, subtitles, watermark, scene change, extra people",
          disable_prompt_upsampling: true,
        });
        await db.from("host_lipsync_jobs").update({ prediction_id: pred.id, transaction_id: txId, status: "running", updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ job_id: job.id, status: "running", quote: { seconds: quote.seconds, total_cents: quote.total_cents } });
      } catch (e) {
        console.error("lipsync start failed", e);
        await cancelAI(txId, "provider_start_failed").catch(() => null);
        await db.from("host_lipsync_jobs").update({ status: "failed", error: String(e).slice(0, 300), transaction_id: txId, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ error: "start_failed", message: "The lip-sync service didn't start. Nothing was charged." }, 502);
      }
    }

    if (action === "status") {
      const { data: job } = await db.from("host_lipsync_jobs").select("*").eq("id", String(body.job_id ?? "")).eq("user_id", user.id).maybeSingle();
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "succeeded" && job.storage_path) {
        return json({ status: "succeeded", url: await signed(job.storage_path, 6 * 3600), output_seconds: job.output_seconds, total_billed_cents: job.total_billed_cents });
      }
      if (job.status === "failed" || job.status === "starting") return json({ status: job.status, message: job.status === "failed" ? "Lip-sync didn't finish. Nothing was charged." : undefined });

      const pr = await fetch(`https://api.replicate.com/v1/predictions/${job.prediction_id}`, { headers: replicateHeaders() });
      const p = await pr.json().catch(() => ({}));
      if (!pr.ok) return json({ status: "running" });
      if (p.status === "failed" || p.status === "canceled") {
        if (job.transaction_id) await cancelAI(job.transaction_id, `provider_${p.status}`).catch((e) => console.error("cancel failed", e));
        await db.from("host_lipsync_jobs").update({ status: "failed", error: String(p.error ?? p.status).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ status: "failed", message: "Lip-sync didn't finish. Nothing was charged." });
      }
      if (p.status !== "succeeded") return json({ status: "running" });

      const outUrl = Array.isArray(p.output) ? p.output[0] : p.output;
      if (typeof outUrl !== "string") return json({ status: "running" });
      await db.from("host_lipsync_jobs").update({ status: "settling", updated_at: new Date().toISOString() }).eq("id", job.id).in("status", ["running", "settling"]);

      const path = job.storage_path || `${user.id}/library/oracle/lipsync-${job.id}.mp4`;
      const vr = await fetch(outUrl);
      if (!vr.ok) return json({ status: "running" });
      const bytes = new Uint8Array(await vr.arrayBuffer());
      const metricSeconds = Number(p.metrics?.video_output_duration_seconds);
      const seconds = metricSeconds > 0 ? metricSeconds : (mp4DurationSeconds(bytes) ?? Number(job.requested_seconds));
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "video/mp4", upsert: true });
      if (upErr) { console.error("lipsync upload", upErr.message); return json({ status: "running" }); }

      const cost = quoteLipsync(seconds, job.resolution as LipsyncResolution, Number(job.aud_per_usd));
      try {
        const settled = await settleAI(job.transaction_id, cost.provider_cost_cents, job.prediction_id,
          [{ unit_type: "video_second", quantity: seconds, metadata: { usd_per_second: cost.usd_per_second, aud_per_usd: cost.aud_per_usd } }],
          { job_id: job.id, model: LIPSYNC_MODEL });
        await db.from("host_lipsync_jobs").update({
          status: "succeeded", storage_path: path, output_seconds: seconds, provider_cost_cents: cost.provider_cost_cents,
          total_billed_cents: settled.total_billed_cents, updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        return json({ status: "succeeded", url: await signed(path, 6 * 3600), output_seconds: seconds, total_billed_cents: settled.total_billed_cents });
      } catch (e) {
        // Keep the clip private until the charge is confirmed; the next status check retries.
        console.error("lipsync settle failed", e);
        await db.from("host_lipsync_jobs").update({ storage_path: path, output_seconds: seconds, updated_at: new Date().toISOString() }).eq("id", job.id);
        return json({ status: "running" });
      }
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("host-lipsync error", e);
    return json({ error: "server_error", message: "Lip-sync hit a problem. Nothing extra was charged." }, 500);
  }
});
