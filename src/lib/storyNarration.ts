// Story narration → real MP3 files (single-track or per-chapter ZIP).
// Shared by the Story Writer audiobook exporter and the share dialog so the
// audio a user sends is a real, playable file.
import { getEdgeAuthToken } from "@/lib/edgeAuth";
import type { StoryFileSource } from "@/lib/storyFiles";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export class NarrationError extends Error {}

const FRIENDLY: Record<string, string> = {
  TTS_UNAVAILABLE: "Voice narration isn't configured yet — add an ElevenLabs key in Settings → Connectors.",
  TTS_FAILED: "ElevenLabs rejected the narration request (key invalid, out of credits, or voice unavailable).",
  NETWORK_ERROR: "Couldn't reach the voice service. Check your connection and try again.",
  NO_AUDIO: "The voice service returned no audio. Try again in a moment.",
  TEXT_REQUIRED: "There's no text to narrate yet.",
  RATE_LIMITED: "Too many narration requests — wait a minute and try again.",
};

/** Narrate one chunk (<= ~4500 chars). Throws NarrationError with a real reason. */
export const narrateChunk = async (
  text: string,
  opts: { voiceId?: string; modelId?: string; outputFormat?: string; settings?: Record<string, unknown> } = {},
): Promise<Uint8Array> => {
  const token = await getEdgeAuthToken();
  let res: Response;
  try {
    res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text,
        voiceId: opts.voiceId,
        modelId: opts.modelId || "eleven_multilingual_v2",
        outputFormat: opts.outputFormat || "mp3_44100_128",
        settings: opts.settings ?? {
          stability: 0.55,
          similarity_boost: 0.85,
          style: 0.35,
          use_speaker_boost: true,
          speed: 0.98,
        },
      }),
    });
  } catch {
    throw new NarrationError(FRIENDLY.NETWORK_ERROR);
  }

  if (res.status === 401 || res.status === 403) {
    throw new NarrationError("Sign in again — your session expired before narration could start.");
  }
  if (res.status === 429) throw new NarrationError(FRIENDLY.RATE_LIMITED);

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    let code = "TTS_FAILED";
    try {
      const j = await res.json();
      code = j?.error || code;
    } catch {}
    throw new NarrationError(FRIENDLY[code] || `Narration failed (${code}).`);
  }
  if (!res.ok) throw new NarrationError(`Narration failed (HTTP ${res.status}).`);

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 512) throw new NarrationError("The voice service returned an empty audio clip.");
  return buf;
};

export const splitForNarration = (text: string, limit = 4500): string[] => {
  const clean = (text || "").replace(/\s{3,}/g, "  ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (s.length > limit) {
      if (buf) { chunks.push(buf); buf = ""; }
      for (let i = 0; i < s.length; i += limit) chunks.push(s.slice(i, i + limit));
      continue;
    }
    if ((buf + s).length > limit) { if (buf) chunks.push(buf); buf = s; }
    else buf += s;
  }
  if (buf.trim()) chunks.push(buf);
  return chunks;
};

const concat = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
};

export const narrateText = async (
  text: string,
  onProgress?: (pct: number) => void,
  opts?: Parameters<typeof narrateChunk>[1],
): Promise<Uint8Array> => {
  const chunks = splitForNarration(text);
  if (!chunks.length) throw new NarrationError(FRIENDLY.TEXT_REQUIRED);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await narrateChunk(chunks[i], opts));
    onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
  }
  return concat(parts);
};

export const storyNarrationScript = (story: StoryFileSource): string => {
  const parts: string[] = [
    `${story.title || "Untitled Story"}. By ${story.author || "Anonymous"}. Narrated by Oracle Lunar A I.`,
  ];
  for (const c of story.chapters || []) {
    const body = (c.content || "").trim();
    if (!body) continue;
    parts.push(`${c.title || "Chapter"}. ${body}`);
  }
  parts.push(`This has been ${story.title || "this story"}, by ${story.author || "Anonymous"}. Thank you for listening.`);
  return parts.join("\n\n");
};

/** Full story as ONE playable MP3 file. */
export const narrateStoryToMp3 = async (
  story: StoryFileSource,
  onProgress?: (pct: number) => void,
): Promise<File> => {
  const bytes = await narrateText(storyNarrationScript(story), onProgress);
  const name = `${(story.title || "story").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story"}.mp3`;
  return new File([bytes as BlobPart], name, { type: "audio/mpeg" });
};
