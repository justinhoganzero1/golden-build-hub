// Story-by-story production line: content → analysis → sectioned script → licensed visuals → ready to broadcast.
// Bounded per run (a few stories), single-flight via the news lock, and every step leaves an honest status.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { VERIFICATION_LABEL, looksLikeSpaceStory, nasaQuery, rateFootage, brisbaneClock, titleTokens, similarity, type Verification } from "../_shared/newsLogic.ts";
import { normaliseSections, normaliseVisualQueries, commonsLicence, isRelevant, readyToBroadcast, shouldExpire, canRetry, topTrending, pickStoryClips, MAX_ATTEMPTS, NEWS_WINDOW_HOURS, TOP_STORIES, type ScriptSection, type VisualQuery } from "../_shared/newsPipeline.ts";
import { removeRepeatedSentences } from "../_shared/noRepeat.ts";
import { askAI, fetchText, parseJson, USER_AGENT } from "./common.ts";
import { extractFor } from "./analyse.ts";

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

async function setStage(sb: SupabaseClient, id: string, production_status: string, extra: Record<string, unknown> = {}) {
  await sb.from("news_stories").update({ production_status, production_updated_at: new Date().toISOString(), ...extra }).eq("id", id);
}

/** Close off stories that left the news window, so nothing sits in "discovered" forever. */
export async function expireOldStories(sb: SupabaseClient) {
  const cutoff = new Date(Date.now() - NEWS_WINDOW_HOURS * 3600_000).toISOString();
  const { data } = await sb.from("news_stories").update({ production_status: "expired", production_updated_at: new Date().toISOString() })
    .in("production_status", ["discovered"]).lt("last_updated", cutoff).select("id");
  const { data: f } = await sb.from("news_stories").select("id,production_status,last_updated,production_attempts")
    .eq("production_status", "failed").lt("last_updated", cutoff).limit(200);
  const old = (f ?? []).filter((s: any) => shouldExpire(s));
  if (old.length) await sb.from("news_stories").update({ production_status: "expired" }).in("id", old.map((s: any) => s.id));
  // Dismissed stories never enter production.
  await sb.from("news_stories").update({ production_status: "expired" }).eq("status", "dismissed").in("production_status", ["discovered", "failed"]);
  return (data?.length ?? 0) + old.length;
}

// ── Step 1: content ──
async function retrieveContent(sb: SupabaseClient, story: any) {
  const { data: items } = await sb.from("news_items").select("id,source_id,title,summary,url,published_at,fetched_at,extract").eq("story_id", story.id).order("published_at", { ascending: false }).limit(5);
  const { data: srcs } = await sb.from("news_sources").select("id,name,publisher_type");
  const srcMap = new Map((srcs ?? []).map((s: any) => [s.id, s]));
  const verified = (items ?? []).filter((i: any) => /^https:\/\//.test(i.url ?? "") && srcMap.has(i.source_id));
  if (!verified.length) throw new Error("Content retrieval: no source article with a working https link and a known publisher.");
  let read = 0;
  const reports: Array<{ publisher: string; official: boolean; url: string; published_at: string | null; title: string; summary: string | null; text: string }> = [];
  for (const it of verified as any[]) {
    const text = read < 2 ? await extractFor(sb, it) : "";
    if (text) read++;
    const src: any = srcMap.get(it.source_id);
    reports.push({ publisher: src.name, official: src.publisher_type === "official", url: it.url, published_at: it.published_at ?? it.fetched_at ?? null, title: it.title, summary: it.summary, text });
  }
  const checked = {
    sources: reports.map((r) => ({ publisher: r.publisher, url: r.url, published_at: r.published_at, official: r.official, article_text_read: !!r.text })),
    articles_read: read, checked_at: new Date().toISOString(),
    note: read ? `Read ${read} article page${read > 1 ? "s" : ""}.` : "Article pages couldn't be read (robots rules, paywall or no text) — the script uses the published headlines and summaries only.",
  };
  await setStage(sb, story.id, "content_retrieved", { content_checked: checked });
  return reports;
}

// ── Step 2: analysis + script ──
async function writeScript(sb: SupabaseClient, story: any, reports: Awaited<ReturnType<typeof retrieveContent>>) {
  await setStage(sb, story.id, "analysing");
  const packet = `Headline: ${story.headline}
Category: ${story.category ?? "general"} · Region: ${story.region === "au" ? "Australia" : "World"}
Verification: ${VERIFICATION_LABEL[story.verification as Verification] ?? story.verification}${story.conflicts ? `\nConflicting reports: ${story.conflicts}` : ""}
Research notes: ${story.summary ?? "(none yet)"}
Reports:
${reports.map((r) => `- ${r.publisher} (${r.official ? "official statement" : "independent reporting"}, published ${r.published_at ?? "date unknown"}): "${r.title}". ${r.summary ?? ""}${r.text ? `\n  Article text: ${r.text.slice(0, 2200)}` : ""}`).join("\n")}`;
  const raw = await askAI(
    `You are Oracle, the warm, professional presenter of Oracle News on Oracle Lunar. Write ONE story segment for television, in ORIGINAL words, using ONLY the reports supplied.
Rules:
- Never invent facts, numbers, names, quotes, places, dates or events. If the reports don't establish something, return "" for that part.
- Clearly separate what is confirmed from allegations, estimates and developing reports ("police allege", "early estimates suggest", "this is still developing").
- Never just read the headline or copy article sentences. Conversational, natural, spoken English for a news presenter. No markdown, emojis or stage directions.
- Name the outlets naturally (e.g. "the ABC reports…") — at least once in the segment.
- Total 120–200 spoken words across all parts.
Return JSON only:
{"intro":"engaging opening line(s)","what_happened":"…","where_when":"…","who":"… (only people reliably named)","background":"…","figures":"… (only numbers that appear in the reports)","why_it_matters":"…","what_next":"…","closing":"a natural one-line transition to the next story","category":"one word","visual_queries":[{"section":"what_happened","query":"2–5 word search for real footage or a photo, naming a specific place, organisation, object or event, e.g. \\"Parliament House Canberra\\""}]}
Give 2–4 visual_queries, each tied to a section you filled in. Prefer places, landmarks, organisations and objects over people.`,
    packet,
    "low",
  );
  const j = parseJson(raw);
  const sections = normaliseSections(j);
  if (!sections) throw new Error("Script writing: the AI reply was missing the introduction, what happened, why it matters or the closing, so it wasn't used.");
  // House rule: describe each thing once.
  const cleaned: ScriptSection[] = sections.map((s) => ({ ...s, text: removeRepeatedSentences(s.text) })).filter((s) => s.text.trim());
  const queries = normaliseVisualQueries(j?.visual_queries, cleaned);
  if (!queries.length) { const q = nasaQuery(story.headline, story.summary ?? ""); if (q) queries.push({ section: cleaned[1]?.key ?? "intro", query: q }); }
  const script_sections = {
    sections: cleaned, visual_queries: queries, written_at: new Date().toISOString(),
    verification: story.verification, attribution: [...new Set(reports.map((r) => r.publisher))].slice(0, 4),
  };
  await setStage(sb, story.id, "script_ready", { script_sections, category: typeof j?.category === "string" && j.category.length < 30 ? j.category.toLowerCase() : story.category });
  return { sections: cleaned, queries };
}

// ── Step 3: visual research ──
interface CommonsHit { title: string; page: string; url: string; mime: string; size: number; thumb: string | null; licence: string; artist: string; credit: string }

async function commonsSearch(query: string, kind: "video" | "image"): Promise<CommonsHit[]> {
  const search = `${query} ${kind === "video" ? "filetype:video" : "filetype:bitmap"}`;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch=${encodeURIComponent(search)}&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=1280&iiextmetadatafilter=LicenseShortName|Artist|Credit`;
  const r = await fetchText(url, 10_000, 1_500_000);
  if (!r.ok) return [];
  let pages: any[] = [];
  try { pages = Object.values(JSON.parse(r.text)?.query?.pages ?? {}); } catch { return []; }
  const strip = (s: string) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return pages.map((p: any) => {
    const ii = p.imageinfo?.[0] ?? {}; const m = ii.extmetadata ?? {};
    return {
      title: String(p.title ?? ""), page: String(ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title ?? "")}`),
      url: String(ii.url ?? "").split("?")[0], mime: String(ii.mime ?? ""), size: Number(ii.size ?? 0), thumb: ii.thumburl ? String(ii.thumburl).split("?")[0] : null,
      licence: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value).slice(0, 120), credit: strip(m.Credit?.value).slice(0, 160),
    };
  }).filter((h) => h.url.startsWith("https://upload.wikimedia.org/"));
}

/** Smaller transcoded copy of a Commons video when one exists (plays faster on phones). */
async function playableVideoUrl(hit: CommonsHit): Promise<string | null> {
  const m = hit.url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(.\/..\/)(.+)$/);
  if (m) {
    const name = m[2];
    const t = `https://upload.wikimedia.org/wikipedia/commons/transcoded/${m[1]}${name}/${name}.480p.vp9.webm`;
    const h = await fetch(t, { method: "HEAD", headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (h?.ok) return t;
  }
  if (hit.size && hit.size <= MAX_VIDEO_BYTES) {
    const h = await fetch(hit.url, { method: "HEAD", headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (h?.ok) return hit.url;
  }
  return null;
}

async function saveVisual(sb: SupabaseClient, story: any, q: VisualQuery, hit: CommonsHit, kind: "video" | "image", mediaUrl: string) {
  const lic = commonsLicence(hit.licence);
  const row = {
    story_id: story.id, source_kind: "commons", url: hit.page, media_url: mediaUrl, thumbnail_url: hit.thumb, title: hit.title.replace(/^File:/, "").slice(0, 300),
    creator: hit.artist || null, copyright_owner: hit.artist || "See Wikimedia Commons page", licence: lic.licence, commercial_use: lic.commercial_use, editing_allowed: lic.editing_allowed,
    attribution: `${hit.artist ? `${hit.artist} / ` : ""}Wikimedia Commons (${lic.licence})`.slice(0, 200), approval_status: lic.approval_status,
    notes: `${lic.note} Found for "${q.query}". Streamed from Wikimedia Commons, not downloaded.`, section: q.section, media_type: kind, source_org: "Wikimedia Commons", playback_status: "ok",
  };
  const { error } = await sb.from("news_footage").upsert({ ...row, rating: rateFootage({ ...row, permission_expiry: null }) }, { onConflict: "story_id,url", ignoreDuplicates: true });
  return !error;
}

async function nasaVisual(sb: SupabaseClient, story: any, q: VisualQuery): Promise<boolean> {
  const r = await fetchText(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q.query)}&media_type=video&page_size=3`, 10_000);
  if (!r.ok) return false;
  let items: any[] = [];
  try { items = JSON.parse(r.text)?.collection?.items ?? []; } catch { return false; }
  for (const it of items.slice(0, 2)) {
    const meta = it?.data?.[0]; if (!meta?.nasa_id || !isRelevant(q.query, `${meta.title} ${meta.description ?? ""}`)) continue;
    const col = await fetchText(String(it.href).replace(/ /g, "%20"), 10_000);
    if (!col.ok) continue;
    let files: string[] = []; try { files = JSON.parse(col.text); } catch { continue; }
    const pick = ["~mobile.mp4", "~small.mp4", "~preview.mp4"].map((s) => files.find((f) => f.endsWith(s))).find(Boolean);
    if (!pick) continue;
    const mediaUrl = pick.replace(/^http:/, "https:").replace(/ /g, "%20");
    const head = await fetch(mediaUrl, { method: "HEAD", headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (!head?.ok) continue;
    const row = {
      story_id: story.id, source_kind: "nasa_video", url: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`, media_url: mediaUrl,
      thumbnail_url: (it.links ?? []).find((l: any) => l.render === "image")?.href ?? null, title: String(meta.title ?? meta.nasa_id).slice(0, 300),
      creator: `NASA ${meta.center ?? ""}`.trim(), copyright_owner: "NASA (US Government work)", licence: "Public domain — NASA media usage guidelines",
      commercial_use: true, editing_allowed: true, attribution: "Footage courtesy of NASA", approval_status: "public_domain",
      notes: "NASA logos may not imply endorsement. Streamed from NASA's library.", section: q.section, media_type: "video", source_org: "NASA", playback_status: "ok",
    };
    const { error } = await sb.from("news_footage").upsert({ ...row, rating: rateFootage({ ...row, permission_expiry: null }) }, { onConflict: "story_id,url", ignoreDuplicates: true });
    if (!error) return true;
  }
  return false;
}

/** Real clips of the actual story from any YouTube channel. Shown only through YouTube's own player with a credit banner — never downloaded. */
async function youtubeStoryClips(sb: SupabaseClient, story: any): Promise<{ added: number; note: string }> {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) return { added: 0, note: "Real story clips: YouTube search key missing" };
  const q = String(story.headline).replace(/[‘’'"“”:|–—-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 12).join(" ");
  const params = new URLSearchParams({
    part: "snippet", type: "video", q, maxResults: "20", order: "relevance", videoEmbeddable: "true", safeSearch: "moderate",
    publishedAfter: new Date(Date.now() - 4 * 86400_000).toISOString(), key,
  });
  const r = await fetchText(`https://www.googleapis.com/youtube/v3/search?${params}`, 10_000);
  if (!r.ok) return { added: 0, note: `Real story clips: YouTube answered ${r.status || r.text.slice(0, 80)}` };
  let items: any[] = [];
  try { items = JSON.parse(r.text)?.items ?? []; } catch { return { added: 0, note: "Real story clips: YouTube reply unreadable" }; }
  const decode = (t: string) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const cands = items.map((it) => {
    const title = decode(String(it.snippet?.title ?? ""));
    return { videoId: String(it.id?.videoId ?? ""), title, channel: decode(String(it.snippet?.channelTitle ?? "")), live: it.snippet?.liveBroadcastContent ?? null, tokens: titleTokens(title), thumb: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.medium?.url ?? null };
  });
  const picks = pickStoryClips(titleTokens(story.headline), cands, similarity);
  let added = 0;
  for (const p of picks) {
    const thumb = cands.find((c) => c.videoId === p.videoId)?.thumb ?? null;
    const embed = `https://www.youtube-nocookie.com/embed/${p.videoId}`;
    const row = {
      story_id: story.id, source_kind: "youtube_clip", url: `https://www.youtube.com/watch?v=${p.videoId}`, embed_url: embed, media_url: embed, thumbnail_url: thumb,
      title: p.title.slice(0, 300), creator: p.channel, copyright_owner: p.channel, licence: "Standard YouTube Licence — shown through YouTube's own player, not copied",
      commercial_use: false, editing_allowed: false, attribution: p.channel.slice(0, 200), approval_status: "embed_only", source_org: p.channel.slice(0, 120),
      notes: "Real clip of this story. Plays in YouTube's player with the Oracle Lunar credit banner and a spoken thank-you; can't go into a filmed or downloaded video.",
      section: null, media_type: "video", playback_status: "ok",
    };
    const { error } = await sb.from("news_footage").upsert({ ...row, rating: rateFootage({ ...row, permission_expiry: null }) }, { onConflict: "story_id,url", ignoreDuplicates: true });
    if (!error) added++;
  }
  return { added, note: added ? `Real story clips: ${picks.map((p) => p.channel).join(", ")}` : "Real story clips: none matched the story closely enough" };
}

export async function researchVisuals(sb: SupabaseClient, story: any, queries: VisualQuery[]) {
  await setStage(sb, story.id, "searching_footage");
  const notes: string[] = [];
  let videos = 0, images = 0;
  const yt = await youtubeStoryClips(sb, story).catch((e) => ({ added: 0, note: `Real story clips: ${(e as Error).message}` }));
  videos += yt.added; notes.push(yt.note);
  const space = looksLikeSpaceStory(`${story.headline} ${story.summary ?? ""}`);
  for (const q of queries.slice(0, 4)) {
    if (space && await nasaVisual(sb, story, q)) { videos++; notes.push(`"${q.query}": NASA video`); continue; }
    let done = false;
    for (const hit of (await commonsSearch(q.query, "video")).filter((h) => h.mime === "video/webm" && isRelevant(q.query, h.title))) {
      if (!commonsLicence(hit.licence).allowed) continue;
      const url = await playableVideoUrl(hit);
      if (url && await saveVisual(sb, story, q, hit, "video", url)) { videos++; done = true; notes.push(`"${q.query}": video (${hit.licence})`); break; }
    }
    if (done) continue;
    for (const hit of (await commonsSearch(q.query, "image")).filter((h) => /^image\/(jpeg|png|webp)$/.test(h.mime) && isRelevant(q.query, h.title))) {
      if (!commonsLicence(hit.licence).allowed) continue;
      const url = hit.thumb ?? hit.url;
      if (await saveVisual(sb, story, q, hit, "image", url)) { images++; done = true; notes.push(`"${q.query}": photo (${hit.licence})`); break; }
    }
    if (!done) notes.push(`"${q.query}": nothing licensed and relevant — a news graphic will be shown`);
  }
  const summary = { videos, images, notes };
  const { data: cur } = await sb.from("news_stories").select("content_checked").eq("id", story.id).single();
  const prev = (cur?.content_checked ?? {}) as Record<string, unknown>;
  await setStage(sb, story.id, "footage_verified", { content_checked: { ...prev, visuals: summary } });
  return summary;
}

/** Runs one story through every step. Failures are recorded with the stage that failed. */
export async function produceStory(sb: SupabaseClient, story: any) {
  const attempts = (story.production_attempts ?? 0) + 1;
  await sb.from("news_stories").update({ production_attempts: attempts, production_error: null }).eq("id", story.id);
  try {
    const reports = await retrieveContent(sb, story);
    const { sections, queries } = await writeScript(sb, story, reports);
    const visuals = await researchVisuals(sb, story, queries);
    if (!readyToBroadcast(sections)) throw new Error("Final check: the script isn't complete enough to broadcast.");
    await setStage(sb, story.id, "ready_to_broadcast");
    return { id: story.id, headline: story.headline, ok: true, sections: sections.length, ...visuals };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    await setStage(sb, story.id, "failed", { production_error: `${msg}${attempts >= MAX_ATTEMPTS ? " (gave up after 3 tries — press Retry to try again)" : " (will retry automatically in 30 minutes)"}` });
    return { id: story.id, headline: story.headline, ok: false, error: msg };
  }
}

/** Advance the queue by a bounded number of stories, highest priority first. */
export async function advancePipeline(sb: SupabaseClient, opts: { limit: number; storyIds?: string[]; respectCap?: boolean }) {
  const expired = await expireOldStories(sb);
  const { data: settings } = await sb.from("news_settings").select("auto_pipeline,pipeline_daily_cap,categories").eq("id", 1).single();
  let todo: any[] = [];
  if (opts.storyIds?.length) {
    const { data } = await sb.from("news_stories").select("*").in("id", opts.storyIds);
    todo = data ?? [];
  } else {
    if (opts.respectCap) {
      if (settings && !settings.auto_pipeline) return { skipped: true, note: "Automatic story production is switched off in Settings.", expired };
      const today = brisbaneClock(new Date()).date;
      const { count } = await sb.from("news_stories").select("id", { count: "exact", head: true }).gte("production_updated_at", `${today}T00:00:00+10:00`).not("script_sections", "is", null).neq("production_status", "discovered");
      const left = (settings?.pipeline_daily_cap ?? 10) - (count ?? 0);
      if (left <= 0) return { skipped: true, note: `Today's limit of ${settings?.pipeline_daily_cap} written stories is reached (saves AI credits). Change it in Settings.`, expired };
      opts.limit = Math.min(opts.limit, left);
    }
    const since = new Date(Date.now() - NEWS_WINDOW_HOURS * 3600_000).toISOString();
    // Only the top ten trending stories in the world get produced.
    const { data: recent } = await sb.from("news_stories").select("*").gte("last_updated", since).neq("status", "dismissed").neq("production_status", "expired").order("importance", { ascending: false }).limit(60);
    const fresh = topTrending(recent ?? [], TOP_STORIES).filter((s: any) => s.production_status === "discovered").slice(0, opts.limit);
    const { data: failed } = await sb.from("news_stories").select("*").eq("production_status", "failed").gte("last_updated", since).limit(20);
    const retry = (failed ?? []).filter((s: any) => canRetry(s));
    todo = [...retry, ...(fresh ?? [])].slice(0, opts.limit);
  }
  if (!todo.length) return { produced: 0, expired, note: "The top ten trending stories are already produced — nothing waiting." };
  const results = [];
  for (const st of todo) results.push(await produceStory(sb, st));
  return { produced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, expired, results };
}

/** Rewrite only the script for one story (keeps its visuals). */
export async function regenerateScript(sb: SupabaseClient, storyId: string) {
  const { data: story } = await sb.from("news_stories").select("*").eq("id", storyId).single();
  if (!story) throw new Error("Story not found");
  try {
    const reports = await retrieveContent(sb, story);
    const { sections, queries } = await writeScript(sb, story, reports);
    const { count } = await sb.from("news_footage").select("id", { count: "exact", head: true }).eq("story_id", storyId).eq("rating", "green").not("media_url", "is", null);
    if (!count) await researchVisuals(sb, story, queries);
    await setStage(sb, storyId, readyToBroadcast(sections) ? "ready_to_broadcast" : "failed");
    return { ok: true, sections: sections.length };
  } catch (e) {
    await setStage(sb, storyId, "failed", { production_error: (e as Error).message.slice(0, 500) });
    throw e;
  }
}

/** Search for visuals again for one story. */
export async function retryFootage(sb: SupabaseClient, storyId: string) {
  const { data: story } = await sb.from("news_stories").select("*").eq("id", storyId).single();
  if (!story?.script_sections) throw new Error("Write the script first — footage is matched to its sections.");
  const r = await researchVisuals(sb, story, (story.script_sections as any).visual_queries ?? []);
  await setStage(sb, storyId, readyToBroadcast((story.script_sections as any).sections) ? "ready_to_broadcast" : "failed");
  return r;
}
