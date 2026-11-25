export interface FitnessVideoTemplate {
  exercise_key: string; video_id: string; title: string; channel_title: string;
  description: string; commentary: string[]; fetched_at: string; expires_at: string;
}
export function normalizeExercise(value: string): string | null {
  const text = value.toLowerCase().trim().replace(/[-_]/g, " ").replace(/\s+/g, " ");
  if (!/^[a-z ]{2,80}$/.test(text)) return null;
  if (/\b(injury|pain|rehab|cure|pregnant|extreme|dangerous)\b/.test(text)) return null;
  if (/^(star jumps?|jumping jacks?)$/.test(text)) return "jumping jacks";
  if (/^(push ups?|press ups?)$/.test(text)) return "push ups";
  if (/^squats?$/.test(text)) return "squats";
  return text;
}
export function isFreshTemplate(template: Pick<FitnessVideoTemplate, "expires_at">, now = Date.now()) {
  return Date.parse(template.expires_at) > now;
}
export interface VideoCandidate {
  id: string; snippet?: { title?: string; channelTitle?: string; description?: string; liveBroadcastContent?: string };
  status?: { embeddable?: boolean; privacyStatus?: string }; contentDetails?: { duration?: string; regionRestriction?: unknown };
}
export function chooseFitnessVideo(items: VideoCandidate[], exercise: string): VideoCandidate | null {
  const words = exercise.split(" ").filter(w => !["ups", "up"].includes(w));
  const candidates = items.filter(v => {
    const title = (v.snippet?.title || "").toLowerCase().replace(/-/g, " ");
    return /^[\w-]{11}$/.test(v.id) && v.status?.embeddable === true && v.status.privacyStatus === "public"
      && !v.contentDetails?.regionRestriction && v.snippet?.liveBroadcastContent !== "live"
      && !/\b(challenge|prank|extreme|injury|cure|compilation)\b/.test(title)
      && words.every(w => title.includes(w.replace(/s$/, "")));
  });
  return candidates.map((v, i) => ({ v, score: /how to|tutorial|proper|form|beginner|technique/i.test(v.snippet?.title || "") ? 100 - i : -i }))
    .sort((a, b) => b.score - a.score)[0]?.v ?? null;
}
export function makeFitnessTemplate(video: VideoCandidate, exercise: string, now = Date.now()): FitnessVideoTemplate {
  const clean = (s: string) => s.replace(/https?:\/\/\S+/g, "").replace(/[<>\[\]]/g, "").replace(/\s+/g, " ").trim();
  const title = clean(video.snippet?.title || exercise).slice(0, 180);
  const channel = clean(video.snippet?.channelTitle || "YouTube").slice(0, 100);
  return {
    exercise_key: exercise, video_id: video.id, title, channel_title: channel,
    description: clean(video.snippet?.description || "").slice(0, 1000),
    commentary: [
      `This is ${title}, from ${channel}.`,
      `The title describes a ${exercise} demonstration. My guidance is general, not a live description of the footage.`,
      "Start slowly, use a comfortable range of movement, and stop if you feel pain or dizziness. Follow the instructor's demonstration at your own pace.",
    ],
    fetched_at: new Date(now).toISOString(), expires_at: new Date(now + 7 * 86400000).toISOString(),
  };
}