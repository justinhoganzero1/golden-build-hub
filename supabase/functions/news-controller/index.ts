// Oracle News Intelligence — controller.
// Owner actions from the YouTube studio control room, an hourly scheduler tick
// (x-internal-job-token), and a members' archive of published editions.
// Uses only public feeds and the app's existing AI; never invents stories or footage.
import { z } from "npm:zod@3.25.76";
import { requireOwner, requireUser } from "../_shared/requireAuth.ts";
import { hasSchedulerToken } from "../_shared/internalAuth.ts";
import { installNoRepeatRule } from "../_shared/noRepeat.ts";
import { dailyStepDue, brisbaneClock, rateFootage } from "../_shared/newsLogic.ts";
import { db, startRun, finishRun } from "./common.ts";
import { scanSources, checkSources } from "./scan.ts";
import { analyseStories } from "./analyse.ts";
import { findFootage } from "./footage.ts";
import { generateScript } from "./script.ts";
import { advancePipeline, regenerateScript, retryFootage, expireOldStories } from "./pipeline.ts";
import { healthCheck } from "./health.ts";

installNoRepeatRule();

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-job-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const ids = z.array(z.string().uuid()).max(12).optional();
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("tick") }),
  z.object({ action: z.literal("archive"), q: z.string().max(100).optional() }),
  z.object({ action: z.literal("scan") }),
  z.object({ action: z.literal("check_sources") }),
  z.object({ action: z.literal("analyse"), story_ids: ids }),
  z.object({ action: z.literal("find_footage"), story_ids: ids }),
  z.object({ action: z.literal("generate_script"), kind: z.enum(["daily", "manual", "breaking"]).default("manual"), story_ids: ids }),
  z.object({ action: z.literal("approve"), broadcast_id: z.string().uuid() }),
  z.object({ action: z.literal("publish"), broadcast_id: z.string().uuid() }),
  z.object({ action: z.literal("unpublish"), broadcast_id: z.string().uuid() }),
  z.object({ action: z.literal("delete_broadcast"), broadcast_id: z.string().uuid() }),
  z.object({ action: z.literal("attach_video"), broadcast_id: z.string().uuid(), video_path: z.string().regex(/^broadcasts\/[a-z0-9-]+\.(webm|mp4)$/), library_id: z.string().max(80).nullable().optional(), duration_seconds: z.number().int().min(1).max(7200).optional() }),
  z.object({ action: z.literal("set_story_status"), story_id: z.string().uuid(), status: z.enum(["new", "selected", "dismissed"]) }),
  z.object({
    action: z.literal("set_rights"), footage_id: z.string().uuid(),
    copyright_owner: z.string().max(200).optional(), licence: z.string().max(300).optional(), attribution: z.string().max(200).optional(),
    commercial_use: z.boolean(), editing_allowed: z.boolean(), permission_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    approval_status: z.enum(["pending", "requested", "approved", "denied", "embed_only", "public_domain"]), notes: z.string().max(600).optional(),
  }),
  z.object({
    action: z.literal("save_settings"), mode: z.enum(["automatic", "approval", "manual"]), story_count: z.number().int().min(1).max(12),
    duration_minutes: z.number().int().min(1).max(20), au_share: z.number().int().min(0).max(100), breaking_priority: z.boolean(),
    categories: z.array(z.string().min(2).max(30)).max(12),
  }),
  z.object({
    action: z.literal("add_footage"), story_id: z.string().uuid().nullable(), url: z.string().url().startsWith("https://").max(500), title: z.string().min(2).max(300),
    creator: z.string().max(200).optional(), copyright_owner: z.string().max(200).optional(), licence: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal("public_news"), id: z.string().uuid().optional() }),
  z.object({ action: z.literal("advance_pipeline"), story_ids: ids, limit: z.number().int().min(1).max(3).default(1), respect_cap: z.boolean().optional() }),
  z.object({ action: z.literal("regenerate_script"), story_id: z.string().uuid() }),
  z.object({ action: z.literal("retry_footage"), story_id: z.string().uuid() }),
  z.object({ action: z.literal("mark_broadcast"), story_id: z.string().uuid(), status: z.enum(["presenter_speaking", "broadcast_complete", "ready_to_broadcast"]) }),
  z.object({ action: z.literal("remove_visual"), footage_id: z.string().uuid() }),
  z.object({ action: z.literal("set_public"), story_id: z.string().uuid(), public: z.boolean() }),
  z.object({ action: z.literal("save_pipeline"), auto_pipeline: z.boolean(), pipeline_daily_cap: z.number().int().min(0).max(40) }),
  z.object({ action: z.literal("health_check") }),
  z.object({ action: z.literal("toggle_source"), source_id: z.string().uuid(), enabled: z.boolean() }),
  z.object({
    action: z.literal("add_source"), name: z.string().min(2).max(100), url: z.string().url().startsWith("https://").max(400),
    kind: z.enum(["rss", "youtube_rss"]), region: z.enum(["au", "intl"]), category: z.string().min(2).max(30), publisher_type: z.enum(["publisher", "official"]),
  }),
]);

async function runStep<T>(sb: ReturnType<typeof db>, step: string, trigger: string, fn: () => Promise<T>) {
  const id = await startRun(sb, step, trigger);
  try {
    const out = await fn() as any;
    await finishRun(sb, id, out?.skipped ? "skipped" : "ok", out ?? {});
    return out;
  } catch (e) {
    await finishRun(sb, id, "failed", {}, (e as Error).message);
    throw e;
  }
}

async function withLock<T>(sb: ReturnType<typeof db>, fn: () => Promise<T>): Promise<T | { busy: true }> {
  const now = new Date();
  const { data } = await sb.from("news_settings").update({ lock_until: new Date(now.getTime() + 8 * 60_000).toISOString() })
    .eq("id", 1).or(`lock_until.is.null,lock_until.lt.${now.toISOString()}`).select("id");
  if (!data?.length) return { busy: true };
  try { return await fn(); } finally { await sb.from("news_settings").update({ lock_until: null }).eq("id", 1); }
}

async function tick(sb: ReturnType<typeof db>, trigger: string) {
  const { data: settings } = await sb.from("news_settings").select("mode,last_daily_steps").eq("id", 1).single();
  const done = (settings?.last_daily_steps ?? {}) as { research?: string; produce?: string };
  const step = dailyStepDue(new Date(), done, settings?.mode ?? "approval");
  const out: Record<string, unknown> = {};
  out.scan = await runStep(sb, "scan", trigger, () => scanSources(sb)); // also flags breaking news every hour
  // Story-by-story production: 2 stories an hour, capped per day in Settings.
  out.pipeline = await runStep(sb, "pipeline", trigger, () => advancePipeline(sb, { limit: 2, respectCap: true })).catch((e) => ({ error: (e as Error).message }));
  const today = brisbaneClock(new Date()).date;
  if (step === "research") {
    out.analyse = await runStep(sb, "analyse", trigger, () => analyseStories(sb)).catch((e) => ({ error: (e as Error).message }));
    await sb.from("news_settings").update({ last_daily_steps: { ...done, research: today } }).eq("id", 1);
  } else if (step === "produce") {
    out.script = await runStep(sb, "generate_script", trigger, () => generateScript(sb, "daily")).catch((e) => ({ error: (e as Error).message }));
    out.footage = await runStep(sb, "find_footage", trigger, () => findFootage(sb)).catch((e) => ({ error: (e as Error).message }));
    // Attach any newly approved footage to today's edition.
    const { data: b } = await sb.from("news_broadcasts").select("id,story_ids,status").eq("kind", "daily").eq("edition_date", today).maybeSingle();
    if (b && !["produced", "published"].includes(b.status)) {
      const { data: f } = await sb.from("news_footage").select("id").in("story_id", b.story_ids).eq("rating", "green").not("file_path", "is", null);
      await sb.from("news_broadcasts").update({ footage_ids: (f ?? []).map((x: any) => x.id) }).eq("id", b.id);
    }
    await sb.from("news_settings").update({ last_daily_steps: { ...done, produce: today } }).eq("id", 1);
  }
  return { step: step ?? "hourly_scan", ...out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "invalid_request", details: parsed.error.flatten().fieldErrors }, 400);
    body = parsed.data;
  } catch { return json({ error: "invalid_json" }, 400); }
  const sb = db();

  // Members' archive: published editions only.
  if (body.action === "archive") {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    let q = sb.from("news_broadcasts").select("id,title,edition_date,kind,duration_seconds,script,sources,video_path,thumbnail_url,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(30);
    if (body.q?.trim()) q = q.ilike("title", `%${body.q.trim().replace(/[%_,()]/g, " ")}%`);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    const out = [];
    for (const b of data ?? []) {
      const signed = b.video_path ? await sb.storage.from("news-footage").createSignedUrl(b.video_path, 3600) : null;
      out.push({ ...b, video_path: undefined, video_url: signed?.data?.signedUrl ?? null });
    }
    return json({ broadcasts: out });
  }

  // Public news pages on oraclelunar.com: only stories the owner put on the website.
  if (body.action === "public_news") {
    let q = sb.from("news_stories").select("id,headline,category,region,verification,script_sections,public_at,first_seen,last_updated").not("public_at", "is", null).order("public_at", { ascending: false });
    q = body.id ? q.eq("id", body.id) : q.limit(40);
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 500);
    const storyIds = (data ?? []).map((s: any) => s.id);
    const [{ data: items }, { data: srcs }, { data: vis }] = await Promise.all([
      storyIds.length ? sb.from("news_items").select("story_id,title,url,published_at,source_id").in("story_id", storyIds) : Promise.resolve({ data: [] as any[] }),
      sb.from("news_sources").select("id,name"),
      body.id ? sb.from("news_footage").select("story_id,section,media_type,media_url,embed_url,source_kind,thumbnail_url,title,url,licence,attribution,source_org").eq("story_id", body.id).or("rating.eq.green,and(source_kind.eq.youtube_clip,rating.eq.amber)").not("media_url", "is", null) : Promise.resolve({ data: [] as any[] }),
    ]);
    const name = new Map((srcs ?? []).map((s: any) => [s.id, s.name]));
    const stories = (data ?? []).map((s: any) => ({
      id: s.id, headline: s.headline, category: s.category, region: s.region, verification: s.verification, published_at: s.public_at, updated_at: s.last_updated,
      sections: body.id ? (s.script_sections?.sections ?? []) : undefined,
      teaser: (s.script_sections?.sections ?? []).find((x: any) => x.key === "what_happened")?.text?.slice(0, 220) ?? null,
      sources: body.id ? (items ?? []).filter((i: any) => i.story_id === s.id).slice(0, 6).map((i: any) => ({ title: i.title, url: i.url, publisher: name.get(i.source_id) ?? null, published_at: i.published_at })) : undefined,
      visuals: body.id ? (vis ?? []).map((v: any) => ({ ...v, story_id: undefined })) : undefined,
    }));
    return new Response(JSON.stringify({ stories }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
  }

  if (body.action === "tick") {
    const scheduler = await hasSchedulerToken(req).catch(() => false);
    if (!scheduler) { const o = await requireOwner(req); if (o.response) return o.response; }
    try { return json(await withLock(sb, () => tick(sb, scheduler ? "scheduler" : "owner"))); }
    catch (e) { return json({ error: (e as Error).message }, 500); }
  }

  const owner = await requireOwner(req);
  if (owner.response) return owner.response;

  try {
    switch (body.action) {
      case "scan": return json(await withLock(sb, () => runStep(sb, "scan", "owner", () => scanSources(sb))));
      case "check_sources": return json(await runStep(sb, "check_sources", "owner", () => checkSources(sb)));
      case "analyse": return json(await runStep(sb, "analyse", "owner", () => analyseStories(sb, body.story_ids)));
      case "find_footage": return json(await runStep(sb, "find_footage", "owner", () => findFootage(sb, body.story_ids)));
      case "generate_script": { const kind = body.kind; return json(await runStep(sb, "generate_script", "owner", () => generateScript(sb, kind, body.story_ids))); }
      case "approve": {
        const { error } = await sb.from("news_broadcasts").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", body.broadcast_id).in("status", ["scripted", "awaiting_approval"]);
        return error ? json({ error: error.message }, 500) : json({ ok: true });
      }
      case "attach_video": {
        const { data: obj } = await sb.storage.from("news-footage").list("broadcasts", { search: body.video_path.split("/")[1] });
        if (!obj?.length) return json({ error: "The video file wasn't found in storage." }, 400);
        const { error } = await sb.from("news_broadcasts").update({ status: "produced", video_path: body.video_path, library_id: body.library_id ?? null, duration_seconds: body.duration_seconds, produced_at: new Date().toISOString() }).eq("id", body.broadcast_id);
        return error ? json({ error: error.message }, 500) : json({ ok: true });
      }
      case "publish": {
        const { data: b } = await sb.from("news_broadcasts").select("status,video_path,story_ids").eq("id", body.broadcast_id).single();
        if (!b) return json({ error: "Broadcast not found" }, 404);
        if (!b.video_path) return json({ error: "Film the broadcast in the newsroom studio first — there is no video to publish yet." }, 400);
        await sb.from("news_broadcasts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", body.broadcast_id);
        await sb.from("news_stories").update({ status: "used" }).in("id", b.story_ids);
        return json({ ok: true });
      }
      case "unpublish": {
        await sb.from("news_broadcasts").update({ status: "produced", published_at: null }).eq("id", body.broadcast_id).eq("status", "published");
        return json({ ok: true });
      }
      case "delete_broadcast": {
        const { data: b } = await sb.from("news_broadcasts").select("video_path,story_ids,status").eq("id", body.broadcast_id).single();
        if (b?.video_path) await sb.storage.from("news-footage").remove([b.video_path]);
        if (b && b.status !== "published") await sb.from("news_stories").update({ status: "new" }).in("id", b.story_ids).eq("status", "selected");
        await sb.from("news_broadcasts").delete().eq("id", body.broadcast_id);
        return json({ ok: true });
      }
      case "set_story_status": {
        await sb.from("news_stories").update({ status: body.status }).eq("id", body.story_id);
        return json({ ok: true });
      }
      case "set_rights": {
        const { data: f } = await sb.from("news_footage").select("source_kind").eq("id", body.footage_id).single();
        if (!f) return json({ error: "Footage not found" }, 404);
        const patch = { ...body, action: undefined, footage_id: undefined, permission_expiry: body.permission_expiry ?? null, updated_at: new Date().toISOString() };
        delete (patch as any).action; delete (patch as any).footage_id;
        const rating = rateFootage({ source_kind: f.source_kind, commercial_use: body.commercial_use, editing_allowed: body.editing_allowed, approval_status: body.approval_status, permission_expiry: body.permission_expiry ?? null });
        await sb.from("news_footage").update({ ...patch, rating }).eq("id", body.footage_id);
        return json({ ok: true, rating });
      }
      case "save_settings": {
        const { action: _a, ...s } = body;
        const { error } = await sb.from("news_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1);
        return error ? json({ error: error.message }, 500) : json({ ok: true });
      }
      case "add_footage": {
        const yt = body.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
        const kind = yt ? "youtube_rss" : "manual";
        const row = {
          story_id: body.story_id, source_kind: kind, url: body.url, title: body.title, creator: body.creator ?? null, copyright_owner: body.copyright_owner ?? null,
          licence: body.licence ?? (yt ? "Standard YouTube Licence — authorised embed through YouTube's player only" : "Unknown — permission needed"),
          embed_url: yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : null, thumbnail_url: yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null,
          commercial_use: false, editing_allowed: false, approval_status: yt ? "embed_only" : "pending",
          notes: "Added by the owner. Not downloaded. Reuse in a finished broadcast needs written permission from the copyright owner.",
        };
        const rating = rateFootage({ ...row, permission_expiry: null });
        const { error } = await sb.from("news_footage").insert({ ...row, rating });
        return error ? json({ error: error.message }, 400) : json({ ok: true, rating });
      }
      case "advance_pipeline": {
        const lim = body.limit;
        const ids2 = body.story_ids; const cap = !!body.respect_cap;
        return json(await withLock(sb, () => runStep(sb, "pipeline", "owner", () => advancePipeline(sb, { limit: lim, storyIds: ids2, respectCap: cap }))));
      }
      case "regenerate_script": { const id = body.story_id; return json(await runStep(sb, "regenerate_script", "owner", () => regenerateScript(sb, id))); }
      case "retry_footage": { const id = body.story_id; return json(await runStep(sb, "retry_footage", "owner", () => retryFootage(sb, id))); }
      case "mark_broadcast": {
        const now = new Date().toISOString();
        if (body.status === "broadcast_complete") {
          const { data: st } = await sb.from("news_stories").select("broadcast_count").eq("id", body.story_id).single();
          await sb.from("news_stories").update({ production_status: "broadcast_complete", production_updated_at: now, last_broadcast_at: now, broadcast_count: (st?.broadcast_count ?? 0) + 1 }).eq("id", body.story_id);
        } else {
          await sb.from("news_stories").update({ production_status: body.status, production_updated_at: now }).eq("id", body.story_id).in("production_status", ["ready_to_broadcast", "presenter_speaking", "broadcast_complete"]);
        }
        return json({ ok: true });
      }
      case "remove_visual": {
        await sb.from("news_footage").update({ rating: "red", approval_status: "denied", notes: "Removed by the owner as not relevant or not suitable.", updated_at: new Date().toISOString() }).eq("id", body.footage_id);
        return json({ ok: true });
      }
      case "set_public": {
        const { data: st } = await sb.from("news_stories").select("script_sections,production_status").eq("id", body.story_id).single();
        if (body.public && !(st?.script_sections as any)?.sections?.length) return json({ error: "This story has no finished script yet, so it can't go on the website." }, 400);
        await sb.from("news_stories").update({ public_at: body.public ? new Date().toISOString() : null }).eq("id", body.story_id);
        return json({ ok: true });
      }
      case "save_pipeline": {
        await sb.from("news_settings").update({ auto_pipeline: body.auto_pipeline, pipeline_daily_cap: body.pipeline_daily_cap, updated_at: new Date().toISOString() }).eq("id", 1);
        return json({ ok: true });
      }
      case "health_check": {
        await expireOldStories(sb);
        return json(await runStep(sb, "health_check", "owner", () => healthCheck(sb)));
      }
      case "toggle_source": {
        await sb.from("news_sources").update({ enabled: body.enabled }).eq("id", body.source_id);
        return json({ ok: true });
      }
      case "add_source": {
        const { action: _a, ...s } = body;
        const { error } = await sb.from("news_sources").insert(s);
        return error ? json({ error: error.message }, 400) : json({ ok: true });
      }
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
  return json({ error: "unknown_action" }, 400);
});
