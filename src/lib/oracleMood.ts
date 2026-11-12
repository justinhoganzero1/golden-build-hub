// Oracle's emotional awareness engine. Reads the mood of each message the user
// sends in the current chat and spots when that mood shifts. It is free (no AI
// call), runs only in the browser, and is never saved — it just gives Oracle a
// short, private hint so she can respond with the right warmth.
export type Mood = "crisis" | "angry" | "anxious" | "sad" | "lonely" | "tired" | "neutral" | "calm" | "happy" | "excited";
export interface MoodReading { mood: Mood; intensity: 1 | 2 | 3; at: number }
export interface MoodShift { from: Mood; to: Mood; direction: "lifted" | "dropped" | "changed" }

/** How positive each mood is (-3 very low … +2 very bright). */
export const MOOD_VALENCE: Record<Mood, number> = {
  crisis: -3, angry: -2, anxious: -2, sad: -2, lonely: -2, tired: -1, neutral: 0, calm: 1, happy: 2, excited: 2,
};

const CUES: [Exclude<Mood, "neutral">, RegExp][] = [
  ["crisis", /\b(suicid\w*|kill (my ?self|myself)|end (it all|my life)|self[- ]?harm\w*|hurt(ing)? myself|want to die|don'?t want to (live|be here)|no reason to live|better off dead|overdose)\b/],
  ["angry", /\b(angry|furious|pissed( off)?|fuming|livid|rage|raging|hate (this|it|him|her|them|everything)|so annoyed|annoying|fed up|sick of|frustrat\w*|ripped off)\b/],
  ["anxious", /\b(anxious|anxiety|nervous|worried|worrying|panic\w*|scared|afraid|freaking out|stress(ed|ful)?|overwhelm\w*|on edge|can'?t (sleep|stop thinking)|dread\w*)\b/],
  ["sad", /\b(sad|unhappy|down|depress\w*|miserable|heartbroken|crying|cried|tears|grief|griev\w*|lost my|passed away|died|hurt(s|ing)?|awful|terrible|horrible day|bad day|gutted|devastat\w*)\b/],
  ["lonely", /\b(lonely|alone|no ?one (cares|to talk)|nobody (cares|understands)|isolated|left out|no friends|miss (him|her|them|you|my))\b/],
  ["tired", /\b(tired|exhausted|knackered|worn out|drained|burn(ed|t)? out|no energy|sleepy|so done)\b/],
  ["excited", /\b(excited|can'?t wait|stoked|pumped|thrilled|amazing news|woo+|yay+|omg|best day|got the job|we won|i did it)\b/],
  ["happy", /\b(happy|glad|great|good day|wonderful|love (it|this|that)|awesome|fantastic|brilliant|grateful|thankful|proud|beautiful|lovely|cheers|thanks so much)\b/],
  ["calm", /\b(relaxed|calm|peaceful|chill(ing|ed)?|content|cosy|cozy|fine thanks|all good|not bad)\b/],
];

const NEGATED_POSITIVE = /\b(not|never|isn'?t|wasn'?t|don'?t feel|no longer) (so |very |that |really )?(happy|good|great|fine|okay|ok|alright|calm|excited)\b/;
const INTENSIFIER = /\b(so|really|very|extremely|totally|absolutely|completely|super|incredibly|deeply)\b/g;
const POSITIVE_EMOJI = /(😀|😃|😄|😁|😊|🥰|😍|🤩|🎉|❤️|💖|😂|🤣|👍)/u;
const NEGATIVE_EMOJI = /(😢|😭|😞|😔|😟|😩|😫|💔|😡|🤬|😠|😰|😨)/u;

/** Read the mood of one message. Safety (crisis) always wins over other cues. */
export function detectMood(text: string, at = Date.now()): MoodReading {
  const raw = text.slice(0, 2000);
  const m = raw.toLowerCase();
  const scores = new Map<Mood, number>();
  for (const [mood, re] of CUES) {
    const hits = m.match(new RegExp(re.source, "g"));
    if (hits) scores.set(mood, hits.length);
  }
  if (NEGATED_POSITIVE.test(m)) {
    scores.delete("happy"); scores.delete("excited"); scores.delete("calm");
    scores.set("sad", (scores.get("sad") || 0) + 1);
  }
  if (POSITIVE_EMOJI.test(raw)) scores.set("happy", (scores.get("happy") || 0) + 1);
  if (NEGATIVE_EMOJI.test(raw)) scores.set("sad", (scores.get("sad") || 0) + 1);

  let mood: Mood = "neutral";
  if (scores.has("crisis")) mood = "crisis";
  else {
    let best = 0;
    for (const [k, v] of scores) {
      // Ties lean towards the more vulnerable mood so Oracle errs on the side of care.
      if (v > best || (v === best && MOOD_VALENCE[k] < MOOD_VALENCE[mood])) { best = v; mood = k; }
    }
  }
  const boost = (m.match(INTENSIFIER)?.length || 0) + ((raw.match(/!/g)?.length || 0) >= 2 ? 1 : 0)
    + (/[A-Z]{5,}/.test(raw) && raw === raw.toUpperCase() && /[A-Z]/.test(raw) ? 1 : 0) + ((scores.get(mood) || 0) > 1 ? 1 : 0);
  const intensity = (mood === "crisis" ? 3 : Math.min(3, 1 + boost)) as 1 | 2 | 3;
  return { mood, intensity, at };
}

/** Keep the last few readings for this chat only. Neutral small talk does not erase the mood. */
export function addReading(history: MoodReading[], reading: MoodReading, keep = 8): MoodReading[] {
  return [...history, reading].slice(-keep);
}

/** The latest meaningful (non-neutral) mood, or neutral. */
export function currentMood(history: MoodReading[]): MoodReading | null {
  const last = history[history.length - 1];
  if (!last) return null;
  if (last.mood !== "neutral") return last;
  // A plain message right after a strong feeling usually means the feeling is still there.
  const prev = [...history].reverse().slice(1, 3).find(r => r.mood !== "neutral");
  return prev ?? last;
}

/** Spot a real change in mood between the last message and the ones before it. */
export function detectShift(history: MoodReading[]): MoodShift | null {
  const meaningful = history.filter(r => r.mood !== "neutral");
  if (meaningful.length < 2) return null;
  const to = meaningful[meaningful.length - 1];
  const last = history[history.length - 1];
  if (last.mood === "neutral") return null; // only report a shift on the message that shows it
  const before = meaningful.slice(-4, -1);
  const baseline = before.reduce((s, r) => s + MOOD_VALENCE[r.mood], 0) / before.length;
  const from = before[before.length - 1];
  if (from.mood === to.mood) return null;
  const delta = MOOD_VALENCE[to.mood] - baseline;
  if (to.mood === "crisis" || delta <= -2) return { from: from.mood, to: to.mood, direction: "dropped" };
  if (delta >= 2) return { from: from.mood, to: to.mood, direction: "lifted" };
  return { from: from.mood, to: to.mood, direction: "changed" };
}

const STRENGTH = ["", "mild", "clear", "strong"] as const;

/** Short private note sent with the chat so Oracle can tune her warmth. */
export function moodNote(history: MoodReading[]): string | null {
  const now = currentMood(history);
  if (!now) return null;
  const shift = detectShift(history);
  if (now.mood === "neutral" && !shift) return null;
  const parts = [`current mood: ${now.mood} (${STRENGTH[now.intensity]})`];
  if (shift) parts.push(`mood shift: ${shift.direction} from ${shift.from} to ${shift.to}`);
  const trail = history.filter(r => r.mood !== "neutral").slice(-4).map(r => r.mood);
  if (trail.length > 1) parts.push(`recent moods this chat: ${trail.join(" → ")}`);
  return parts.join("; ");
}
