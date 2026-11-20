// Editorial director + Oracle scriptwriter.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { selectStories, wordBudget, estimateSeconds, initialStatus, brisbaneClock, VERIFICATION_LABEL, type Verification } from "../_shared/newsLogic.ts";
import { removeRepeatedSentences } from "../_shared/noRepeat.ts";
import { askAI, parseJson, hoursSince } from "./common.ts";

export async function generateScript(sb: SupabaseClient, kind: "daily" | "manual" | "breaking", storyIds?: string[]) {
  const { data: settings } = await sb.from("news_settings").select("*").eq("id", 1).single();
  if (!settings) throw new Error("News settings are missing.");
  const today = brisbaneClock(new Date()).date;

  if (kind === "daily") {
    const { data: existing } = await sb.from("news_broadcasts").select("id,status").eq("kind", "daily").eq("edition_date", today).maybeSingle();
    if (existing && ["produced", "published"].includes(existing.status)) return { skipped: true, note: "Today's edition is already filmed or published.", broadcast_id: existing.id };
  }

  let picked: any[];
  if (storyIds?.length) {
    const { data } = await sb.from("news_stories").select("*").in("id", storyIds);
    picked = data ?? [];
  } else {
    const { data } = await sb.from("news_stories").select("*").gte("last_updated", new Date(Date.now() - 36 * 3600_000).toISOString()).order("importance", { ascending: false }).limit(200);
    const scored = (data ?? []).map((s: any) => ({ ...s, hoursOld: hoursSince(s.first_seen) }));
    const pool = kind === "breaking" ? scored.filter((s) => s.is_breaking) : scored;
    picked = selectStories(pool, { ...settings, story_count: kind === "breaking" ? 1 : settings.story_count });
  }
  if (!picked.length) return { skipped: true, note: "Not enough verified stories for a broadcast yet. Nothing was made up to fill it." };

  const ids = picked.map((s) => s.id);
  const { data: items } = await sb.from("news_items").select("story_id,title,url,published_at,source_id").in("story_id", ids);
  const { data: srcs } = await sb.from("news_sources").select("id,name,publisher_type");
  const srcName = new Map((srcs ?? []).map((s: any) => [s.id, s]));
  const { data: footage } = await sb.from("news_footage").select("id,story_id,rating,file_path,title,attribution").in("story_id", ids).eq("rating", "green").not("file_path", "is", null);
  const footageBy = new Map<string, any[]>();
  for (const f of footage ?? []) footageBy.set(f.story_id, [...(footageBy.get(f.story_id) ?? []), f]);

  const budget = wordBudget(kind === "breaking" ? Math.min(2, settings.duration_minutes) : settings.duration_minutes);
  const perStory = Math.max(60, Math.floor((budget - 80) / picked.length));
  const packets = picked.map((s) => {
    const its = (items ?? []).filter((i: any) => i.story_id === s.id).slice(0, 5);
    const f = footageBy.get(s.id) ?? [];
    return `STORY ${s.id}
Headline: ${s.headline}
Verification: ${VERIFICATION_LABEL[s.verification as Verification] ?? s.verification}${s.conflicts ? `\nConflicting reports: ${s.conflicts}` : ""}
Research summary: ${s.summary ?? "(not analysed — rely only on the headlines below)"}
Reports: ${its.map((i: any) => `${srcName.get(i.source_id)?.name ?? "Source"}: "${i.title}"`).join(" | ")}
Approved footage available: ${f.length ? f.map((x) => `"${x.title}" (${x.attribution})`).join("; ") : "none"}`;
  });

  const raw = await askAI(
    `You are Oracle, the warm, intelligent, conversational presenter of Oracle News on Oracle Lunar. Write an ORIGINAL spoken news bulletin from ONLY the material supplied.
Rules:
- Never invent facts, numbers, names, quotes, places or footage. If something is unconfirmed, single-source, developing or conflicting, say so plainly on air.
- Summarise and analyse in your own words; never copy article sentences.
- Each story segment covers: headline, brief background, verified developments, relevant facts, then one short line of Oracle's own thoughtful commentary (clearly opinion, kind and balanced).
- Only introduce footage when "Approved footage available" lists some, and credit it (for example "Footage courtesy of NASA").
- Name the outlets reporting it naturally ("ABC and the BBC report…").
- Plain spoken text only: no markdown, no stage directions, no emojis.
- About ${perStory} words per story; the whole bulletin must stay under ${budget} words.
Reply with JSON only: {"title":"…","intro":"…","segments":[{"story_id":"…","text":"…"}],"closing":"…"}`,
    packets.join("\n\n"),
    "medium",
  );
  const j = parseJson(raw);
  if (!j || !Array.isArray(j.segments)) throw new Error("The script came back in a form that couldn't be read, so no broadcast was saved.");
  const valid = new Set(ids);
  const segments = j.segments.filter((s: any) => s && valid.has(s.story_id) && typeof s.text === "string" && s.text.trim());
  if (!segments.length) throw new Error("The script didn't cover any of the chosen stories, so it was rejected.");
  const usedIds: string[] = segments.map((s: any) => s.story_id as string);
  const script = removeRepeatedSentences([j.intro, ...segments.map((s: any) => s.text), j.closing].filter((p) => typeof p === "string" && p.trim()).map((p: string) => p.trim()).join("\n\n"));
  const sources = usedIds.map((id) => {
    const s = picked.find((p) => p.id === id);
    return {
      story_id: id, headline: s?.headline, verification: s?.verification,
      links: (items ?? []).filter((i: any) => i.story_id === id).slice(0, 6).map((i: any) => ({ title: i.title, url: i.url, publisher: srcName.get(i.source_id)?.name ?? null, published_at: i.published_at })),
    };
  });
  const footageIds = usedIds.flatMap((id) => (footageBy.get(id) ?? []).map((f) => f.id));
  const title = String(j.title || `Oracle News — ${today}`).slice(0, 160);
  const row = {
    edition_date: today, kind, title, status: initialStatus(settings.mode), script, story_ids: usedIds, sources, footage_ids: footageIds,
    duration_seconds: estimateSeconds(script), error: null, approved_at: settings.mode === "automatic" ? new Date().toISOString() : null,
  };
  let broadcastId: string;
  if (kind === "daily") {
    const { data: existing } = await sb.from("news_broadcasts").select("id").eq("kind", "daily").eq("edition_date", today).maybeSingle();
    if (existing) { await sb.from("news_broadcasts").update(row).eq("id", existing.id); broadcastId = existing.id; }
    else { const { data, error } = await sb.from("news_broadcasts").insert(row).select("id").single(); if (error) throw new Error(error.message); broadcastId = data.id; }
  } else {
    const { data, error } = await sb.from("news_broadcasts").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    broadcastId = data.id;
  }
  await sb.from("news_stories").update({ status: "selected" }).in("id", usedIds);
  return { broadcast_id: broadcastId, stories: usedIds.length, words: script.split(/\s+/).length, seconds: row.duration_seconds, status: row.status, shorter_than_requested: usedIds.length < settings.story_count && kind === "daily" };
}
