/**
 * Style-DNA: learn the author's real voice from their own writing samples,
 * then use that profile to steer generation and the humanising rewrite pass.
 *
 * Samples live in `user_style_samples` (RLS: owner-only) with
 * source = 'story-writer-style-dna'.
 */
import { supabase } from "@/integrations/supabase/client";

export const STYLE_DNA_SOURCE = "story-writer-style-dna";
const PROFILE_KEY = (uid: string) => `oracle-lunar:style-dna-profile:${uid}`;

export interface StyleSample {
  id: string;
  content: string;
  created_at: string;
}

export async function listStyleSamples(userId: string): Promise<StyleSample[]> {
  const { data, error } = await supabase
    .from("user_style_samples")
    .select("id, content, created_at")
    .eq("user_id", userId)
    .eq("source", STYLE_DNA_SOURCE)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as StyleSample[]) || [];
}

export async function addStyleSample(userId: string, content: string): Promise<void> {
  const text = (content || "").trim();
  if (text.length < 200) throw new Error("Paste at least 200 characters so the AI can hear your voice.");
  const { error } = await supabase.from("user_style_samples").insert({
    user_id: userId,
    source: STYLE_DNA_SOURCE,
    content: text.slice(0, 40000),
  });
  if (error) throw error;
}

export async function deleteStyleSample(id: string): Promise<void> {
  const { error } = await supabase.from("user_style_samples").delete().eq("id", id);
  if (error) throw error;
}

/** Cached, human-readable description of the author's voice. */
export function loadStyleProfile(userId: string): string {
  try { return localStorage.getItem(PROFILE_KEY(userId)) || ""; } catch { return ""; }
}

export function saveStyleProfile(userId: string, profile: string) {
  try { localStorage.setItem(PROFILE_KEY(userId), profile); } catch { /* ignore */ }
}

export const STYLE_ANALYST_SYSTEM = `You are a forensic prose stylist. You will be given writing samples by ONE author.
Produce a precise, reusable STYLE DNA profile another writer could follow to sound exactly like them.
Cover, with concrete examples quoted from the samples:
1. Sentence rhythm (average length, how often they run long or clip short, fragment use)
2. Vocabulary register and favourite words/idioms/slang, spelling convention (UK/US/AU)
3. Punctuation habits (em dashes, ellipses, semicolons, comma splices)
4. Paragraph shape and pacing
5. Dialogue style and tagging habits
6. Point of view, tense, and how often they address the reader
7. Humour, imagery and metaphor patterns
8. Tics to reproduce, and things this author NEVER does
Return plain text under 900 words. No preamble.`;

export function styleDirective(profile: string): string {
  if (!profile.trim()) return "";
  return `\n\nAUTHOR STYLE DNA — write so this reads exactly like the author's own hand:\n${profile.trim().slice(0, 4000)}\n`;
}

export const HUMANISE_SYSTEM = `You are the author's own editing hand doing a final human pass on their manuscript.
Rewrite the passage so it reads like the author wrote it themselves — not smoother, more HUMAN.
Do all of the following:
- Vary sentence rhythm hard: mix long winding sentences with short punchy ones and the occasional fragment.
- Break AI cadence: no tricolon crutches, no "not only... but also", no "in a world where", no summary sentence at the end of every paragraph.
- Add the author's first-person asides, opinions and small digressions where they fit the voice.
- Use concrete, specific, lived detail instead of generic abstraction.
- Keep imperfection: an occasional comma splice, a repeated word for emphasis, an unfinished thought.
- Preserve the plot, characters, facts, chapter meaning and approximate length. Never censor or shorten the story.
This is an honest craft pass to improve the prose in the author's voice. It is NOT an attempt to defeat detection tools, and provenance/disclosure records stay attached to the work.
Return ONLY the rewritten prose. No commentary, no markdown fences.`;
