// News discovery: public RSS/Atom feeds only, robots.txt respected, failures reported honestly.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { parseFeed, normaliseUrl, robotsAllows, titleTokens, bestMatch, clusterKeyFor, classifyVerification, publisherKey, strayItemIndexes, importanceScore, isBreaking } from "../_shared/newsLogic.ts";
import { fetchText, robotsFor, sha256, hoursSince } from "./common.ts";

type Source = { id: string; name: string; kind: string; url: string; region: string; category: string; publisher_type: string; enabled: boolean };

async function scanOne(sb: SupabaseClient, s: Source): Promise<{ id: string; name: string; ok: boolean; found: number; added: number; error?: string }> {
  const now = new Date().toISOString();
  const fail = async (error: string) => {
    await sb.from("news_sources").update({ last_scan_at: now, last_status: "unavailable", last_error: error.slice(0, 300), items_last: 0 }).eq("id", s.id);
    return { id: s.id, name: s.name, ok: false, found: 0, added: 0, error };
  };
  try {
    const robots = await robotsFor(s.url);
    const u = new URL(s.url);
    if (robots && !robotsAllows(robots, u.pathname + u.search)) return await fail("robots.txt does not allow automated reading of this feed");
    const r = await fetchText(s.url);
    if (!r.ok) return await fail(r.status ? `Website answered ${r.status}` : `Could not reach website (${r.text})`);
    const entries = parseFeed(r.text).slice(0, 60);
    if (!entries.length) return await fail("No headlines could be read from this feed");
    const rows = [];
    for (const e of entries) {
      const link = normaliseUrl(e.link);
      rows.push({
        source_id: s.id, guid_hash: await sha256(s.kind === "youtube_rss" && e.videoId ? `yt:${e.videoId}` : link),
        title: e.title.slice(0, 400), summary: e.summary || null, url: link, published_at: e.published,
        extract: s.kind === "youtube_rss" ? JSON.stringify({ videoId: e.videoId, thumbnail: e.thumbnail }) : null,
      });
    }
    const { data: inserted, error } = await sb.from("news_items").upsert(rows, { onConflict: "guid_hash", ignoreDuplicates: true }).select("id");
    if (error) return await fail(`Saving failed: ${error.message}`);
    await sb.from("news_sources").update({ last_scan_at: now, last_ok_at: now, last_status: "ok", last_error: null, items_last: entries.length }).eq("id", s.id);
    return { id: s.id, name: s.name, ok: true, found: entries.length, added: inserted?.length ?? 0 };
  } catch (e) {
    return await fail((e as Error).message);
  }
}

export async function scanSources(sb: SupabaseClient) {
  const { data: sources } = await sb.from("news_sources").select("*").eq("enabled", true).neq("kind", "nasa_video");
  const list = (sources ?? []) as Source[];
  const results: Awaited<ReturnType<typeof scanOne>>[] = [];
  for (let i = 0; i < list.length; i += 6) results.push(...await Promise.all(list.slice(i, i + 6).map((s) => scanOne(sb, s))));
  const clustered = await clusterNewItems(sb);
  return { sources: results, scanned: results.length, ok: results.filter((r) => r.ok).length, added: results.reduce((a, r) => a + r.added, 0), ...clustered };
}

/** Group fresh headlines into stories; update an existing story instead of duplicating it. Batched for speed. */
export async function clusterNewItems(sb: SupabaseClient) {
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: srcs } = await sb.from("news_sources").select("id,kind,region,category,publisher_type,url");
  const srcMap = new Map((srcs ?? []).map((s: any) => [s.id, s]));
  const textSourceIds = (srcs ?? []).filter((s: any) => s.kind === "rss").map((s: any) => s.id);
  if (!textSourceIds.length) return { new_stories: 0, updated_stories: 0, breaking: [] as string[] };
  const { data: fresh } = await sb.from("news_items").select("id,source_id,title,url,published_at,fetched_at").is("story_id", null).in("source_id", textSourceIds).gte("fetched_at", since).limit(1000);
  const { data: stories } = await sb.from("news_stories").select("id,headline,source_count").gte("last_updated", since).limit(2000);
  type Cand = { id: string | null; key: string; tokens: string[]; row?: Record<string, unknown>; items: string[] };
  const cands: Cand[] = (stories ?? []).map((s: any) => ({ id: s.id, key: s.id, tokens: titleTokens(s.headline), items: [] }));
  for (const it of (fresh ?? []) as any[]) {
    const tokens = titleTokens(it.title);
    if (tokens.length < 2) continue;
    const match = bestMatch(tokens, cands);
    if (match) { match.items.push(it.id); continue; }
    const src: any = srcMap.get(it.source_id) ?? {};
    const first = it.published_at ?? it.fetched_at;
    const key = clusterKeyFor(tokens, first);
    cands.push({ id: null, key, tokens, items: [it.id], row: { cluster_key: key, headline: it.title, category: src.category ?? "general", region: src.region ?? "intl", first_seen: first } });
  }
  const newOnes = cands.filter((c) => !c.id && c.row);
  for (let i = 0; i < newOnes.length; i += 200) {
    const { data } = await sb.from("news_stories").upsert(newOnes.slice(i, i + 200).map((c) => c.row!), { onConflict: "cluster_key" }).select("id,cluster_key");
    const byKey = new Map((data ?? []).map((d: any) => [d.cluster_key, d.id]));
    for (const c of newOnes.slice(i, i + 200)) c.id = byKey.get(c.key) ?? null;
  }
  // Recount every recent story each scan, so counts, labels and any old false grouping self-correct.
  const touched: string[] = (stories ?? []).map((s: any) => s.id);
  await Promise.all(cands.filter((c) => c.id && c.items.length).map(async (c) => {
    await sb.from("news_items").update({ story_id: c.id }).in("id", c.items);
    if (!touched.includes(c.id!)) touched.push(c.id!);
  }));
  const breaking = await refreshStories(sb, touched, srcMap);
  const updated = cands.filter((c) => c.id && c.items.length && !c.row).length;
  return { new_stories: newOnes.filter((c) => c.id).length, updated_stories: updated, breaking };
}

/** Recount sources, re-label verification, re-score importance and flag breaking news. */
export async function refreshStories(sb: SupabaseClient, ids: string[], srcMap?: Map<string, any>) {
  if (!ids.length) return [] as string[];
  if (!srcMap) {
    const { data: srcs } = await sb.from("news_sources").select("id,kind,region,category,publisher_type,url");
    srcMap = new Map((srcs ?? []).map((s: any) => [s.id, s]));
  }
  const { data: settings } = await sb.from("news_settings").select("breaking_priority").eq("id", 1).single();
  const breaking: Array<{ id: string; headline: string; n: number; off: number }> = [];
  const rows: any[] = [];
  const allStories: any[] = []; const allItems: any[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const part = ids.slice(i, i + 150);
    const [{ data: st }, { data: its }] = await Promise.all([
      sb.from("news_stories").select("*").in("id", part),
      sb.from("news_items").select("id,story_id,source_id,title,url,published_at,fetched_at").in("story_id", part),
    ]);
    allStories.push(...(st ?? [])); allItems.push(...(its ?? []));
  }
  const itemsBy = new Map<string, any[]>();
  for (const it of allItems) itemsBy.set(it.story_id, [...(itemsBy.get(it.story_id) ?? []), it]);
  const strays: string[] = [];
  for (const st of allStories) {
    let items = itemsBy.get(st.id) ?? [];
    const bad = new Set(strayItemIndexes(st.headline, items.map((i: any) => i.title)));
    if (bad.size && bad.size < items.length) {
      items.forEach((it: any, i: number) => { if (bad.has(i)) strays.push(it.id); });
      items = items.filter((_: any, i: number) => !bad.has(i));
    }
    if (!items.length) continue;
    const publishers = items.map((i: any) => publisherKey(i.url));
    const official = new Set(items.filter((i: any) => srcMap!.get(i.source_id)?.publisher_type === "official").map((i: any) => publisherKey(i.url))).size;
    const earliest = items.map((i: any) => i.published_at ?? i.fetched_at).sort()[0];
    const hoursOld = hoursSince(earliest);
    const au = items.some((i: any) => srcMap!.get(i.source_id)?.region === "au");
    const verification = classifyVerification({ publishers, titles: items.map((i: any) => i.title), conflicts: st.conflicts, hoursOld });
    const sourceCount = new Set(publishers).size;
    const wasBreaking = st.is_breaking;
    const nowBreaking = wasBreaking || isBreaking({ source_count: sourceCount, official_count: official, hoursOld, verification });
    const region = au ? "au" : st.region;
    const importance = importanceScore({ region, category: st.category, source_count: sourceCount, official_count: official, verification, hoursOld, is_breaking: nowBreaking }, { breaking_priority: settings?.breaking_priority ?? true });
    rows.push({ ...st, source_count: sourceCount, official_count: official, verification, importance, region, is_breaking: nowBreaking,
      update_count: (st.update_count ?? 0) + (sourceCount > st.source_count && st.source_count > 0 ? 1 : 0), last_updated: new Date().toISOString() });
    if (nowBreaking && !wasBreaking) breaking.push({ id: st.id, headline: st.headline, n: sourceCount, off: official });
  }
  // Detach wrongly grouped headlines; the next scan files them under their own story.
  for (let i = 0; i < strays.length; i += 200) await sb.from("news_items").update({ story_id: null }).in("id", strays.slice(i, i + 200));
  for (let i = 0; i < rows.length; i += 200) await sb.from("news_stories").upsert(rows.slice(i, i + 200), { onConflict: "id" });
  const headlines: string[] = [];
  for (const b of breaking) {
    const { id, headline, n, off } = b;
    headlines.push(headline);
    const key = `news-breaking-${id}`;
    const { data: seen } = await sb.from("system_incidents").select("id").eq("incident_key", key).limit(1);
    if (!seen?.length) await sb.from("system_incidents").insert({ incident_key: key, severity: "info", summary: `Breaking news (${n} outlets${off > 0 ? ", officially confirmed" : ""}): ${headline}`.slice(0, 400) });
  }
  return headlines;
}

/** Quick reachability check of every source without saving headlines. */
export async function checkSources(sb: SupabaseClient) {
  const { data } = await sb.from("news_sources").select("*").eq("enabled", true);
  const out = [];
  for (const s of (data ?? []) as Source[]) {
    const url = s.kind === "nasa_video" ? "https://images-api.nasa.gov/search?q=moon&media_type=video&page_size=1" : s.url;
    const r = await fetchText(url, 8000, 300_000);
    const ok = r.ok && (s.kind === "nasa_video" ? r.text.includes("collection") : parseFeed(r.text).length > 0);
    await sb.from("news_sources").update({ last_status: ok ? "ok" : "unavailable", last_error: ok ? null : (r.status ? `Website answered ${r.status}` : r.text).slice(0, 300), ...(ok ? { last_ok_at: new Date().toISOString() } : {}) }).eq("id", s.id);
    out.push({ name: s.name, ok });
  }
  return { checked: out.length, ok: out.filter((o) => o.ok).length, sources: out };
}
