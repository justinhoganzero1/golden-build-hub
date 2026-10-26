// Compatibility endpoint for Oracle and Movie Studio. Jobs resume without resubmission.
// Members pay their own provider cost + 20% from their wallet; the owner is exempt.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2.99.3/cors";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { generateVideo, getVideo, downloadVideo, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { VIDEO_MODEL, videoDuration, parseVideoJob } from "../_shared/videoContract.ts";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";
import { z } from "npm:zod@3.25.76";
const bodySchema = z.object({ job_id: z.string().uuid().optional(), request_key: z.string().uuid().optional(), image_url: z.string().max(12000000).optional(), prompt: z.string().max(4096).default("Cinematic motion, natural subject movement"), duration: z.number().int().min(3).max(10).optional(), ratio: z.enum(["16:9", "9:16"]).optional() });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const PER_SECOND_CENTS = PROVIDER_RATES.lovable_ai_video_flash_per_second;
async function imageInput(url: string) {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Invalid source image");
    return { type: "image" as const, mime_type: match[1], data: match[2] };
  }
  const parsed = new URL(url);
  const storageHost = new URL(Deno.env.get("SUPABASE_URL")!).hostname;
  if (parsed.protocol !== "https:" || parsed.hostname !== storageHost) throw new Error("Use a saved Library image or upload a source image");
  const result = await fetch(parsed, { redirect: "error" });
  if (!result.ok) throw new Error("Source image unavailable");
  const mime = (result.headers.get("content-type") || "").split(";")[0];
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new Error("Unsupported source image");
  const bytes = new Uint8Array(await result.arrayBuffer());
  if (bytes.length > 8000000) throw new Error("Source image too large");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { type: "image" as const, mime_type: mime, data: btoa(binary) };
}
serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let localJobId: string | undefined;
  let submitted = false;
  const client = db();
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const body = bodySchema.safeParse(await req.json());
    if (!body.success) return json({ error: "Invalid video request" }, 400);
    const input = body.data;
    const { data: owner, error: roleError } = await client.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    const isOwner = !roleError && !!owner;
    const rateLimit = await enforceRateLimit(req, auth.user, "gemini-video");
    if (rateLimit) return rateLimit;
    let query = client.from("member_video_jobs").select("*").eq("user_id", auth.user.id);
    query = input.job_id ? query.eq("id", input.job_id) : query.eq("request_key", input.request_key || crypto.randomUUID());
    let { data: saved, error } = await query.maybeSingle();
    if (error) throw error;
    if (input.job_id && !saved) return json({ error: "Video job not found" }, 404);
    if (!saved) {
      const seconds = videoDuration(input.duration);
      const estimatedCents = PER_SECOND_CENTS * seconds;
      const image = input.image_url ? await imageInput(input.image_url) : undefined;
      const requestId = input.request_key || crypto.randomUUID();
      // Reserve funds before any provider work. The owner is exempt from billing.
      let transactionId: string | null = null;
      if (!isOwner) {
        try {
          const authorization = await authorizeAI(auth.user.id, requestId, "gemini-video", "lovable-ai-gateway", VIDEO_MODEL, estimatedCents, { seconds });
          transactionId = authorization.transaction_id;
        } catch (billingError) {
          if (billingError instanceof InsufficientCoinsError) return insufficientCoinsResponse(billingError, corsHeaders);
          throw billingError;
        }
      }
      const { data: created, error: insertError } = await client.from("member_video_jobs").insert({ id: requestId, user_id: auth.user.id, request_key: requestId, source: "gemini-video", status: "starting", billing_transaction_id: transactionId, estimated_provider_cents: estimatedCents }).select("*").single();
      if (insertError) {
        if (transactionId) await cancelAI(transactionId, "duplicate_request").catch(() => undefined);
        return json({ error: "Video request already started. Resume its saved job." }, 409);
      }
      saved = created;
      localJobId = saved.id;
      submitted = true;
      try {
        const remote = await generateVideo({ model: VIDEO_MODEL, input: image ? [{ type: "text", text: input.prompt }, image] : input.prompt, response_format: { type: "video", duration: `${seconds}s`, resolution: "720p" } }, { runId: saved.id });
        const update = await client.from("member_video_jobs").update({ gateway_job_id: remote.id, status: remote.status, updated_at: new Date().toISOString() }).eq("id", saved.id);
        if (update.error) throw update.error;
        saved.gateway_job_id = remote.id;
        saved.status = remote.status;
      } catch (submitError) {
        // Provider work never started (or outcome unknown): release the hold when
        // the gateway confirms nothing was submitted, otherwise keep it for resume.
        if (transactionId && !(submitError instanceof GatewayError && submitError.outcome === "unknown")) {
          await cancelAI(transactionId, "provider_submit_failed").catch(() => undefined);
          await client.from("member_video_jobs").update({ billing_transaction_id: null }).eq("id", saved.id);
          saved.billing_transaction_id = null;
        }
        throw submitError;
      }
    }
    localJobId = saved.id;
    if (saved.status === "completed" && saved.video_url) {
      const path = `${auth.user.id}/generated/${saved.id}.mp4`;
      const { data: signed, error: signError } = await client.storage.from("movies").createSignedUrl(path, 3600);
      if (signError) throw signError;
      return json({ job_id: saved.id, status: "completed", video_url: signed.signedUrl, media_id: saved.media_id });
    }
    if (!saved.gateway_job_id) return json({ job_id: saved.id, status: saved.status }, 202);
    const remote = parseVideoJob(await getVideo(saved.gateway_job_id));
    if (remote.status === "failed") {
      if (saved.billing_transaction_id) await cancelAI(saved.billing_transaction_id, "provider_failed").catch(() => undefined);
      await client.from("member_video_jobs").update({ status: "failed", error_code: "provider_failed", billing_transaction_id: null }).eq("id", saved.id);
      return json({ job_id: saved.id, error: "Video generation failed; no member wallet charged" }, 502);
    }
    if (remote.status !== "completed") {
      await client.from("member_video_jobs").update({ status: remote.status, updated_at: new Date().toISOString() }).eq("id", saved.id);
      return json({ job_id: saved.id, status: remote.status }, 202);
    }
    const download = await downloadVideo(remote.id);
    const blob = await download.blob();
    const path = `${auth.user.id}/generated/${saved.id}.mp4`;
    const uploaded = await client.storage.from("movies").upload(path, blob, { contentType: "video/mp4", upsert: true });
    if (uploaded.error) throw uploaded.error;
    const storageUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/movies/${path}`;
    let mediaId = saved.media_id;
    if (!mediaId) {
      const { data: media, error: mediaError } = await client.from("user_media").insert({ user_id: auth.user.id, media_type: "video", title: "Oracle Lunar generated video", url: storageUrl, source_page: "oracle-video", metadata: { model: VIDEO_MODEL, video_job_id: saved.id, seconds: remote.seconds } }).select("id").single();
      if (mediaError) throw mediaError;
      mediaId = media.id;
    }
    // Settle the wallet hold from the measured clip length before releasing the video.
    if (saved.billing_transaction_id) {
      const billedSeconds = remote.seconds ?? videoDuration(input.duration);
      await settleAI(saved.billing_transaction_id, PER_SECOND_CENTS * billedSeconds, remote.id, [{ unit_type: "video_second", quantity: billedSeconds }], { model: VIDEO_MODEL, seconds: billedSeconds });
    }
    const final = await client.from("member_video_jobs").update({ status: "completed", media_id: mediaId, video_url: storageUrl, updated_at: new Date().toISOString() }).eq("id", saved.id);
    if (final.error) throw final.error;
    const { data: signed, error: signError } = await client.storage.from("movies").createSignedUrl(path, 3600);
    if (signError) throw signError;
    return json({ job_id: saved.id, status: "completed", video_url: signed.signedUrl, media_id: mediaId, seconds: remote.seconds });
  } catch (error) {
    if (submitted && localJobId) {
      const gatewayId = error instanceof GatewayError ? error.ids?.jobId : undefined;
      await client.from("member_video_jobs").update({ status: "unknown", ...(gatewayId ? { gateway_job_id: gatewayId } : {}), error_code: error instanceof GatewayError ? error.code : "application_error" }).eq("id", localJobId);
    }
    if (error instanceof GatewayError) return json({ error: error.code, job_id: localJobId, message: error.outcome === "unknown" ? "Your video may still be rendering. Resume the saved job; do not start another." : "Video provider unavailable. No member wallet charged." }, error.httpStatus && error.httpStatus >= 400 ? error.httpStatus : 502);
    console.error("video operation failed", localJobId, error instanceof Error ? error.name : "unknown");
    return json({ error: "Video could not finish. Your saved job is preserved.", job_id: localJobId }, 500);
  }
});
