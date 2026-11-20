// Footage discovery without paid APIs: official YouTube channel RSS (embed only) and the public-domain NASA library.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { titleTokens, similarity, looksLikeSpaceStory, rateFootage, nasaQuery } from "../_shared/newsLogic.ts";
import { fetchText, sha256, USER_AGENT } from "./common.ts";

const MAX_NASA_BYTES = 40 * 1024 * 1024;

async function nasaClips(sb: SupabaseClient, story: { id: string; headline: string; summary?: string | null; footage_terms?: string | null }) {
  const terms = story.footage_terms || nasaQuery(story.headline, story.summary ?? "");
  const notes: string[] = [];
  const done = (added: number) => ({ added, note: `NASA "${terms}": ${added} clip${added === 1 ? "" : "s"} saved${notes.length ? ` (${notes.join("; ")})` : ""}` });
  if (!terms) return done(0);
  const r = await fetchText(`https://images-api.nasa.gov/search?q=${encodeURIComponent(terms)}&media_type=video&page_size=3`, 10_000);
  if (!r.ok) { notes.push(`archive answered ${r.status || r.text}`); return done(0); }
  let items: any[] = [];
  try { items = JSON.parse(r.text)?.collection?.items ?? []; } catch { notes.push("archive reply unreadable"); return done(0); }
  if (!items.length) notes.push("no matching videos");
  let added = 0;
  for (const it of items.slice(0, 2)) {
    const meta = it?.data?.[0]; if (!meta?.nasa_id) continue;
    const page = `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`;
    const { data: exists } = await sb.from("news_footage").select("id").eq("story_id", story.id).eq("url", page).limit(1);
    if (exists?.length) { notes.push("already saved"); continue; }
    const col = await fetchText(String(it.href).replace(/ /g, "%20"), 10_000);
    if (!col.ok) { notes.push(`file list ${col.status || col.text}`); continue; }
    let files: string[] = [];
    try { files = JSON.parse(col.text); } catch { notes.push("file list unreadable"); continue; }
    const pick = ["~mobile.mp4", "~small.mp4", "~preview.mp4"].map((s) => files.find((f) => f.endsWith(s))).find(Boolean);
    if (!pick) { notes.push("no small video version"); continue; }
    const fileUrl = pick.replace(/^http:/, "https:").replace(/ /g, "%20");
    const head = await fetch(fileUrl, { method: "HEAD", headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    const size = Number(head?.headers.get("content-length") ?? 0);
    if (!head?.ok || !size || size > MAX_NASA_BYTES) { notes.push(head?.ok ? "video too large" : `video unavailable ${head?.status ?? ""}`); continue; }
    const vid = await fetch(fileUrl, { headers: { "User-Agent": USER_AGENT } }).catch(() => null);
    if (!vid?.ok) { notes.push("download failed"); continue; }
    const bytes = new Uint8Array(await vid.arrayBuffer());
    const path = `footage/nasa-${(await sha256(meta.nasa_id)).slice(0, 24)}.mp4`;
    const up = await sb.storage.from("news-footage").upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) { notes.push(`storage: ${up.error.message}`); continue; }
    const thumb = (it.links ?? []).find((l: any) => l.render === "image")?.href ?? null;
    const row = {
      story_id: story.id, source_kind: "nasa_video", url: page, file_path: path, thumbnail_url: thumb, title: String(meta.title ?? meta.nasa_id).slice(0, 300),
      creator: `NASA ${meta.center ?? ""}`.trim(), copyright_owner: "NASA (US Government work)", licence: "Public domain — NASA media usage guidelines",
      commercial_use: true, editing_allowed: true, attribution: "Footage courtesy of NASA",
      approval_status: "public_domain", notes: "NASA logos and insignia may not be used to imply endorsement; check the item page for any third-party credit.",
    };
    await sb.from("news_footage").insert({ ...row, rating: rateFootage({ ...row, permission_expiry: null }) });
    added++;
  }
  return done(added);
}

async function youtubeMatches(sb: SupabaseClient, story: { id: string; headline: string }, videos: any[]) {
  const tokens = titleTokens(story.headline);
  let added = 0;
  const scored = videos.map((v) => ({ v, s: similarity(tokens, v.tokens) })).filter((x) => x.s >= 0.4).sort((a, b) => b.s - a.s).slice(0, 2);
  for (const { v } of scored) {
    const meta = (() => { try { return JSON.parse(v.extract ?? "{}"); } catch { return {}; } })();
    if (!meta.videoId) continue;
    const row = {
      story_id: story.id, source_kind: "youtube_rss", url: v.url, embed_url: `https://www.youtube-nocookie.com/embed/${meta.videoId}`, thumbnail_url: meta.thumbnail ?? null,
      title: v.title, creator: v.source_name, copyright_owner: v.source_name, licence: "Standard YouTube Licence — authorised embed through YouTube's player only",
      commercial_use: false, editing_allowed: false, attribution: v.source_name, approval_status: "embed_only",
      notes: "Not downloaded. Reuse inside a finished broadcast needs written permission from the channel owner.",
    };
    const { error } = await sb.from("news_footage").upsert({ ...row, rating: rateFootage({ ...row, permission_expiry: null }) }, { onConflict: "story_id,url", ignoreDuplicates: true });
    if (!error) added++;
  }
  return added;
}

export async function findFootage(sb: SupabaseClient, storyIds?: string[]) {
  let q = sb.from("news_stories").select("id,headline,summary,category,footage_terms");
  q = storyIds?.length ? q.in("id", storyIds) : q.eq("status", "selected").limit(12);
  const { data: stories } = await q;
  if (!stories?.length) return { stories: 0, youtube: 0, nasa: 0, note: "Select stories first (Generate Script picks them), or choose a story." };
  const { data: ytSources } = await sb.from("news_sources").select("id,name").eq("kind", "youtube_rss");
  const ytName = new Map((ytSources ?? []).map((s: any) => [s.id, s.name]));
  const { data: vids } = await sb.from("news_items").select("source_id,title,url,extract").in("source_id", [...ytName.keys()]).gte("fetched_at", new Date(Date.now() - 72 * 3600_000).toISOString()).limit(300);
  const videos = (vids ?? []).map((v: any) => ({ ...v, source_name: ytName.get(v.source_id), tokens: titleTokens(v.title) }));
  const { data: nasaSrc } = await sb.from("news_sources").select("enabled").eq("kind", "nasa_video").limit(1);
  const nasaOn = nasaSrc?.[0]?.enabled !== false;
  let youtube = 0; let nasa = 0;
  const notes: string[] = [];
  for (const st of stories as any[]) {
    youtube += await youtubeMatches(sb, st, videos);
    if (nasaOn && looksLikeSpaceStory(`${st.headline} ${st.summary ?? ""}`)) { const r = await nasaClips(sb, st); nasa += r.added; notes.push(r.note); }
  }
  if (!videos.length) notes.push("No official-channel video list available (YouTube's robots rules don't allow automated feed reading) — add video links by hand in the rights register.");
  return { stories: stories.length, youtube, nasa, notes };
}
