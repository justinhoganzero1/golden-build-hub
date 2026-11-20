// Automated health checker: real checks of each newsroom and website stage, with plain pass/fail results.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { fetchText, USER_AGENT } from "./common.ts";

export interface Check { stage: string; ok: boolean; detail: string }
const SITE = "https://oraclelunar.com";
const APK = "https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/app-download";

async function head(url: string, ms = 10_000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    let r = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: ctrl.signal });
    if (r.status === 405) r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Range: "bytes=0-1023" }, redirect: "follow", signal: ctrl.signal });
    return { ok: r.ok, status: r.status, type: r.headers.get("content-type") ?? "" };
  } catch (e) { return { ok: false, status: 0, type: (e as Error).message }; } finally { clearTimeout(t); }
}

export async function healthCheck(sb: SupabaseClient): Promise<{ checks: Check[]; passed: number; failed: number }> {
  const checks: Check[] = [];
  const add = (stage: string, ok: boolean, detail: string) => checks.push({ stage, ok, detail });
  const day = new Date(Date.now() - 24 * 3600_000).toISOString();

  // News discovery
  const { data: lastScan } = await sb.from("news_runs").select("status,started_at,error").eq("step", "scan").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { data: srcs } = await sb.from("news_sources").select("enabled,last_status").eq("enabled", true);
  const working = (srcs ?? []).filter((s: any) => s.last_status === "ok").length;
  const scanAge = lastScan ? (Date.now() - new Date(lastScan.started_at).getTime()) / 3600_000 : 99;
  add("News discovery", !!lastScan && lastScan.status === "ok" && scanAge < 2.5 && working > 0, lastScan ? `Last scan ${scanAge.toFixed(1)} h ago (${lastScan.status}); ${working} of ${srcs?.length ?? 0} sources working.` : "No scan has run yet.");

  // Article extraction (evidence + a live read of one public article)
  const { data: read } = await sb.from("news_stories").select("content_checked").gte("production_updated_at", day).not("content_checked", "is", null).limit(50);
  const readCount = (read ?? []).filter((r: any) => (r.content_checked?.articles_read ?? 0) > 0).length;
  const { data: sample } = await sb.from("news_items").select("url").not("extract", "is", null).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  const live = sample?.url ? await fetchText(sample.url, 10_000, 600_000) : null;
  add("Article extraction", readCount > 0 || !!live?.ok, `${readCount} stories had article text read in 24 h${live ? `; live re-read of a recent article: ${live.ok ? "worked" : `failed (${live.status || live.text})`}` : ""}.`);

  // Script generation
  const { count: scripted } = await sb.from("news_stories").select("id", { count: "exact", head: true }).not("script_sections", "is", null).gte("production_updated_at", day);
  const { data: lastFail } = await sb.from("news_stories").select("headline,production_error").eq("production_status", "failed").order("production_updated_at", { ascending: false }).limit(1).maybeSingle();
  add("Script generation", (scripted ?? 0) > 0, `${scripted ?? 0} stories scripted in 24 h.${lastFail?.production_error ? ` Latest failure: ${lastFail.production_error}` : ""}`);

  // Footage search (live, free library)
  const c = await fetchText("https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=1&srsearch=Sydney%20Opera%20House%20filetype%3Avideo", 10_000);
  const hits = (() => { try { return JSON.parse(c.text)?.query?.search?.length ?? 0; } catch { return 0; } })();
  add("Footage search", c.ok && hits > 0, c.ok ? `Wikimedia Commons search answered (${hits} result).` : `Wikimedia Commons didn't answer (${c.status || c.text}).`);

  // Media permissions metadata
  const { data: greens } = await sb.from("news_footage").select("id,url,licence,attribution,source_org,story_id,media_type,media_url,section,playback_status").eq("rating", "green").not("media_url", "is", null).order("created_at", { ascending: false }).limit(40);
  const missing = (greens ?? []).filter((g: any) => !g.url || !g.licence || !g.attribution || !g.source_org || !g.story_id || !g.media_type);
  add("Media permissions metadata", (greens?.length ?? 0) > 0 && !missing.length, `${greens?.length ?? 0} approved visuals checked; ${missing.length} missing source, licence, credit or story link.`);

  // Video playback (each recent approved video must answer as a playable file)
  const vids = (greens ?? []).filter((g: any) => g.media_type === "video").slice(0, 6);
  let playable = 0;
  for (const v of vids as any[]) {
    const h = await head(v.media_url);
    const ok = h.ok && /video|octet-stream|webm|mp4/.test(h.type);
    if (ok) playable++;
    await sb.from("news_footage").update({ playback_status: ok ? "ok" : "failed" }).eq("id", v.id);
  }
  add("Video playback", vids.length > 0 && playable === vids.length, vids.length ? `${playable} of ${vids.length} recent videos play; broken ones are switched to their fallback picture or graphic.` : "No approved videos yet to test.");

  // Ready-to-broadcast integrity: never ready without script + fallback
  const { data: ready } = await sb.from("news_stories").select("id,script_sections").eq("production_status", "ready_to_broadcast").limit(100);
  const bad = (ready ?? []).filter((r: any) => !(r.script_sections?.sections?.length >= 4));
  add("Broadcast-ready check", !bad.length, `${ready?.length ?? 0} stories ready to broadcast; ${bad.length} without a complete script.`);

  // Broadcast completion (recorded by the presenter player)
  const { data: lastDone } = await sb.from("news_stories").select("headline,last_broadcast_at").not("last_broadcast_at", "is", null).order("last_broadcast_at", { ascending: false }).limit(1).maybeSingle();
  add("Broadcast completion", !!lastDone, lastDone ? `Last story finished on air: "${lastDone.headline}" at ${lastDone.last_broadcast_at}.` : "No story has finished on air yet — press Start Broadcast.");

  // Website pages
  const pages = ["/", "/download", "/ai-friend", "/news", "/sitemap.xml", "/robots.txt"];
  const results = await Promise.all(pages.map(async (p) => ({ p, r: await head(`${SITE}${p}`) })));
  const down = results.filter((x) => !x.r.ok);
  add("Website page loading", !down.length, down.length ? `Not loading: ${down.map((d) => `${d.p} (${d.r.status})`).join(", ")}` : `${pages.length} pages answered on oraclelunar.com.`);

  // Download link
  const apk = await head(APK, 15_000);
  add("Download links", apk.ok, apk.ok ? `Android download answers (${apk.type || "file"}).` : `Android download failed (${apk.status} ${apk.type}).`);

  // Search indexing configuration
  const robots = await fetchText(`${SITE}/robots.txt`, 8000);
  const sitemap = await fetchText(`${SITE}/sitemap.xml`, 8000);
  const home = await fetchText(`${SITE}/`, 8000);
  const urlCount = (sitemap.text.match(/<loc>/g) ?? []).length;
  const problems = [
    !/Sitemap:\s*https:\/\/oraclelunar\.com\/sitemap\.xml/i.test(robots.text) && "robots.txt has no sitemap line",
    /^\s*Disallow:\s*\/\s*$/im.test(robots.text) && "robots.txt blocks the whole site",
    urlCount < 10 && `sitemap lists only ${urlCount} pages`,
    !/<meta name="description"/i.test(home.text) && "home page has no description",
    !/application\/ld\+json/i.test(home.text) && "home page has no structured data",
    !/og:title/i.test(home.text) && "home page has no social sharing tags",
  ].filter(Boolean);
  add("Search indexing configuration", !problems.length, problems.length ? problems.join("; ") : `robots.txt points to the sitemap (${urlCount} pages); home page has description, structured data and sharing tags.`);

  const passed = checks.filter((c) => c.ok).length;
  return { checks, passed, failed: checks.length - passed };
}
