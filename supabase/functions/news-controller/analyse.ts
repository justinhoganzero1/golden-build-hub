// Research desk: pull permitted article text and ask the existing AI to summarise and compare reports.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { extractArticleText, robotsAllows } from "../_shared/newsLogic.ts";
import { askAI, fetchText, parseJson, robotsFor } from "./common.ts";
import { refreshStories } from "./scan.ts";

const MAX_STORIES = 8;

export async function extractFor(sb: SupabaseClient, item: { id: string; url: string; extract: string | null }) {
  if (item.extract) return item.extract;
  try {
    const robots = await robotsFor(item.url);
    const u = new URL(item.url);
    if (robots && !robotsAllows(robots, u.pathname)) return "";
    const r = await fetchText(item.url, 10_000, 1_500_000);
    if (!r.ok || /subscribe to (continue|read)|paywall/i.test(r.text.slice(0, 50_000))) return "";
    const text = extractArticleText(r.text);
    if (text) await sb.from("news_items").update({ extract: text }).eq("id", item.id);
    return text;
  } catch { return ""; }
}

export async function analyseStories(sb: SupabaseClient, storyIds?: string[]) {
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  let q = sb.from("news_stories").select("id,headline,verification,source_count,official_count,analysed_at,last_updated").neq("status", "dismissed");
  q = storyIds?.length ? q.in("id", storyIds) : q.gte("last_updated", since).order("importance", { ascending: false }).limit(30);
  const { data: rows } = await q;
  const todo = (rows ?? []).filter((s: any) => storyIds?.length || !s.analysed_at || s.last_updated > s.analysed_at).slice(0, MAX_STORIES);
  if (!todo.length) return { analysed: 0, note: "No new or updated stories to analyse." };

  const { data: srcs } = await sb.from("news_sources").select("id,name,publisher_type");
  const srcMap = new Map((srcs ?? []).map((s: any) => [s.id, s]));
  const packets: string[] = [];
  let extracted = 0;
  for (const st of todo as any[]) {
    const { data: items } = await sb.from("news_items").select("id,source_id,title,summary,url,published_at,extract").eq("story_id", st.id).order("published_at", { ascending: false }).limit(4);
    const parts: string[] = [];
    let n = 0;
    for (const it of (items ?? []) as any[]) {
      const src: any = srcMap.get(it.source_id) ?? {};
      const text = n < 2 ? await extractFor(sb, it) : "";
      if (text) { extracted++; n++; }
      parts.push(`- ${src.name ?? "Source"} (${src.publisher_type === "official" ? "official statement" : "independent reporting"}, ${it.published_at ?? "date unknown"}): "${it.title}". ${it.summary ?? ""}${text ? `\n  Article text: ${text.slice(0, 1800)}` : ""}`);
    }
    packets.push(`STORY ${st.id}\nHeadline: ${st.headline}\nReports:\n${parts.join("\n")}`);
  }

  const raw = await askAI(
    `You are the research desk for Oracle News. Use ONLY the reports supplied — never add facts, numbers, quotes or evidence that are not in them. If the material is too thin, say so.
For each story return: "summary" (2–4 sentences in your own original words, never copied), "conflicts" (a short description of any contradiction between the reports, or null), "official_note" (what comes from official statements versus independent reporting), "unconfirmed" (claims only one report makes, or null), "footage_search" (2–3 words naming the main visual subject for an archive video search, e.g. "Voyager 1" or "Artemis launch", or null).
Reply with a JSON array only: [{"id":"…","summary":"…","conflicts":null,"official_note":"…","unconfirmed":null,"footage_search":null}]`,
    packets.join("\n\n"),
  );
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) throw new Error("The AI's research summary could not be read, so nothing was changed.");
  const valid = new Set(todo.map((t: any) => t.id));
  let analysed = 0;
  for (const r of parsed) {
    if (!r || !valid.has(r.id) || typeof r.summary !== "string") continue;
    const extra = [r.official_note ? `Sources: ${r.official_note}` : "", r.unconfirmed ? `Unconfirmed: ${r.unconfirmed}` : ""].filter(Boolean).join("\n");
    await sb.from("news_stories").update({
      summary: `${r.summary}${extra ? `\n${extra}` : ""}`.slice(0, 2000),
      conflicts: typeof r.conflicts === "string" && r.conflicts.trim() ? r.conflicts.slice(0, 600) : null,
      footage_terms: typeof r.footage_search === "string" && r.footage_search.trim() ? r.footage_search.trim().slice(0, 60) : null,
      analysed_at: new Date().toISOString(),
    }).eq("id", r.id);
    analysed++;
  }
  await refreshStories(sb, todo.map((t: any) => t.id));
  return { analysed, requested: todo.length, article_texts_read: extracted };
}
