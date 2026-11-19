// Oracle Racing — vision engines 3, 6 and 7 for clips the owner recorded.
// Only a few still frames are read; results are AI interpretations, stored
// separately from objective data, and race replays are learning-only.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { askAI, parseJsonObject, audit, markProvider } from "./common.ts";

const BASE = "Describe only what is visible in the still frames. Never guess a horse's name, never predict a winner, never diagnose health or injury, never invent anything you cannot see.";
const RULES: Record<string, string> = {
  paddock: `You are Oracle Racing's paddock vision engine. Frames come from ONE short clip of horses parading before a race. ${BASE}
For each horse you can see clearly report: label (saddlecloth number if readable, e.g. "No. 5", otherwise colours/position), calmness (calm / alert / on edge / agitated), sweating (none / light / heavy / unclear), coat (shining / normal / dull / unclear), walk (relaxed and even / short or choppy / unclear), head (relaxed / high / tossing / unclear), note (one short sentence).`,
  training: `You are Oracle Racing's training footage engine. Frames come from ONE clip of trackwork, a gallop, a barrier trial or a warm-up. ${BASE}
For each horse you can see clearly report: label, activity (walk / canter / gallop / trial / unclear), movement (fluent and even / slightly uneven / laboured / unclear), stride (long / normal / short / unclear), calmness (calm / alert / on edge / agitated), note (one short sentence). If earlier observations of the same horse are provided, say in the note whether its movement looks better, similar or worse — or "can't compare".`,
  race: `You are Oracle Racing's race replay engine. Frames come from ONE race replay (used only for learning after the race). ${BASE}
For each horse you can identify report: label, start (good / slow / unclear), position (leading / on pace / midfield / back / unclear), finish (strong / one-paced / tiring / unclear), note (one short sentence).`,
};
const SHAPE = `Also rate overall clip quality (good / fair / poor) and your confidence from 0 to 1. Reply with JSON only: {"quality":"fair","confidence":0.5,"overall":"...","horses":[{"label":"...", ...}]}`;
const family = (kind: string) => (kind === "paddock" ? "paddock" : kind === "race" ? "race" : "training");

export async function analyseClip(sb: SupabaseClient, actor: string, videoId: string, frames: string[]) {
  const { data: video } = await sb.from("racing_video_sources").select("id,race_id,horse_id,kind,storage_path,recorded_at").eq("id", videoId).maybeSingle();
  if (!video || !video.storage_path) return { error: "unknown_clip", status: 404 };
  const fam = family(video.kind);
  let history = "";
  if (video.horse_id && fam === "training") {
    const { data: prev } = await sb.from("racing_visual_observations").select("observed_at,objective_measures,ai_interpretation").eq("horse_id", video.horse_id).eq("available", true).order("observed_at", { ascending: false }).limit(3);
    if (prev?.length) history = "Earlier observations of this horse: " + prev.map((p) => `${String(p.observed_at).slice(0, 10)}: ${JSON.stringify(p.objective_measures)} ${p.ai_interpretation ?? ""}`).join(" | ");
  }
  const content: any[] = [{ type: "input_text", text: `${frames.length} frames from the clip, in time order.${history ? " " + history : ""}` }];
  for (const f of frames) content.push({ type: "input_image", image_url: f, detail: "auto" });
  let parsed: any;
  try { parsed = parseJsonObject(await askAI(`${RULES[fam]}\n${SHAPE}`, content)); }
  catch (e) { return { error: "analysis_failed", detail: (e as Error).message, status: 502 }; }
  if (!parsed || !Array.isArray(parsed.horses)) return { error: "analysis_unreadable", status: 502 };
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const quality = ["good", "fair", "poor"].includes(parsed.quality) ? parsed.quality : "unclear";

  // Link each described horse to a runner by saddlecloth number when the clip belongs to a race.
  const byCloth = new Map<number, string>();
  if (video.race_id) {
    const { data: rs } = await sb.from("racing_runners").select("horse_id,saddlecloth").eq("race_id", video.race_id);
    for (const r of rs ?? []) if (r.saddlecloth != null) byCloth.set(r.saddlecloth, r.horse_id);
  }
  const now = new Date().toISOString();
  const horses = parsed.horses.slice(0, 30);
  const rows = horses.map((h: any) => {
    const measures: Record<string, unknown> = { source: "owner_upload", kind: video.kind, frames: frames.length, learning_only: fam === "race" };
    for (const [k, v] of Object.entries(h)) if (k !== "note" && typeof v === "string") measures[k] = v.slice(0, 60);
    const cloth = Number(String(h.label ?? "").match(/\d+/)?.[0]);
    const horseId = video.horse_id && horses.length === 1 ? video.horse_id : byCloth.get(cloth) ?? null;
    return { video_id: video.id, race_id: video.race_id, horse_id: horseId, observed_at: video.recorded_at ?? now, available: true, confidence, objective_measures: measures, ai_interpretation: String(h.note ?? "").slice(0, 400) };
  });
  if (!rows.length) rows.push({ video_id: video.id, race_id: video.race_id, horse_id: video.horse_id ?? null, observed_at: video.recorded_at ?? now, available: false, confidence, objective_measures: { source: "owner_upload", kind: video.kind, frames: frames.length }, ai_interpretation: String(parsed.overall ?? "No horse was clear enough to describe.").slice(0, 400) });
  await sb.from("racing_visual_observations").insert(rows);
  const linked = rows.filter((r: any) => r.horse_id).length;
  await sb.from("racing_video_sources").update({ quality, identification_confidence: rows.length ? +(confidence * (linked ? 1 : 0.5)).toFixed(2) : 0 }).eq("id", video.id);
  if (video.race_id && fam !== "race") await sb.from("racing_races").update(fam === "paddock" ? { has_paddock_video: true } : { has_training_video: true }).eq("id", video.race_id);
  await markProvider(sb, "owner-uploads", true);
  await audit(sb, actor, "clip_analysed", { video: video.id, kind: video.kind, horses: rows.length, linked, quality });
  return { ok: true, horses: rows.filter((x: any) => x.available).length, linked, quality, confidence, overall: String(parsed.overall ?? "").slice(0, 400) };
}
