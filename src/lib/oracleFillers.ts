// Stored "thinking out loud" reactions Oracle says while the real answer loads.
// They never contain facts or answers — only warm, natural lead-ins — so the
// real reply can follow on seamlessly. Every reaction is an opener + a bridge,
// and each piece is a pre-recorded clip in Oracle's ad voice (no paid speech).
export type FillerCategory = "question" | "task" | "research" | "feelings" | "chat";
export interface FillerClip { id: string; text: string }
export interface Filler { key: string; category: FillerCategory; clips: FillerClip[]; text: string }

const clips = (prefix: string, texts: string[]): FillerClip[] => texts.map((text, i) => ({ id: `${prefix}${String(i + 1).padStart(2, "0")}`, text }));

export const SHARED_OPENERS = clips("s", [
  "Mmm.", "Right.", "Okay.", "Oh, nice.", "Ooh.", "Alright.", "Ah, yes.", "Hmm, okay.", "Oh, I like this.", "Love it.",
  "Yep.", "Sure thing.", "Oh, good one.", "Righto.", "Okay, let's see.", "Ah, okay.", "Oh, interesting.", "No worries.", "Got it.", "Ooh, okay.",
]);

export const FILLER_SETS: Record<FillerCategory, { shared: boolean; openers: FillerClip[]; bridges: FillerClip[] }> = {
  question: {
    shared: true,
    openers: clips("qo", ["Good question.", "Ooh, that's a good one.", "Now that's a great question.", "Hmm, let me think.", "Oh, I've wondered about that too.", "That's a really fair question.", "Ah, that's a clever one.", "Let me think about that."]),
    bridges: clips("qb", ["Let me have a proper think about that.", "Give me a second to get this right for you.", "I want to give you a good answer, so bear with me.", "I'm just putting my thoughts together.", "Let me work through it properly.", "Hang on, I'm pulling that together now.", "Just a moment while I think it through.", "I'm lining up the best answer for you.", "Let me get the details straight.", "One tick, I'm working it out.", "I'm going over it carefully for you.", "Bear with me a moment."]),
  },
  task: {
    shared: true,
    openers: clips("to", ["Ooh, I can help with that.", "Oh, fun, let's do it.", "Leave it with me.", "Great idea.", "I'm on it.", "Oh, I love making things.", "Let's make it happen.", "Count me in."]),
    bridges: clips("tb", ["Let me get started on that for you.", "I'm just setting things up.", "Give me a moment to pull it together.", "I'm getting the pieces ready now.", "Let me map out the best way to do it.", "I'm sorting out the details now.", "Just getting everything lined up.", "I'll have something for you shortly.", "Let me shape that up properly.", "Working on it right now.", "I'm putting my best effort into this one.", "Bear with me while I work it out."]),
  },
  research: {
    shared: true,
    openers: clips("ro", ["Ooh, let me look into that.", "Good thing to check.", "Let me find out.", "Ah, let me see.", "Let's find out together.", "I'll dig into that.", "Hmm, worth getting right.", "Let me have a look."]),
    bridges: clips("rb", ["Give me a moment with that one.", "Let me make sure I've got it right.", "I want to be accurate, so bear with me.", "Just pulling the details together now.", "Let me get the facts straight first.", "One moment while I double-check.", "I'm sorting through it now.", "Let me be careful with this one.", "Hang on, I'm on it.", "I'm getting it together for you.", "Just a moment, I want this right.", "Bear with me, this is worth doing properly."]),
  },
  chat: {
    shared: true,
    openers: clips("co", ["Aww.", "Oh, ha!", "Oh, really?", "Ha, I love that.", "Oh, how lovely.", "Well, well.", "Oh, you!", "Oh, nice one."]),
    bridges: clips("cb", ["Let me think about that for a sec.", "Ooh, give me a moment.", "Hmm, where do I start?", "Let me gather my thoughts.", "I've got a few things to say about that.", "Hang on, let me get my words together.", "You've got me thinking now.", "Oh, let me think.", "Give me a tick.", "Now, let me see.", "Just a sec.", "Let me put this nicely."]),
  },
  feelings: {
    shared: false,
    openers: clips("fo", ["Oh, I hear you.", "Aww, I'm here.", "Thank you for telling me.", "Oh, that sounds hard.", "I'm really glad you shared that.", "I'm right here with you.", "That matters, and so do you.", "Oh, I'm listening.", "Okay, I'm with you.", "I hear you, really.", "You're not alone in this.", "Take a breath with me."]),
    bridges: clips("fb", ["Let me think about how I can help.", "I want to get this right for you.", "Give me a moment to think it through.", "I'm thinking about what you said.", "Let's work through this together.", "I'm taking a moment to really think about it.", "I'm not going anywhere.", "Let me find the right words.", "Just a moment, I'm with you.", "I'm thinking carefully about this.", "We'll go through it gently.", "Stay with me a second."]),
  },
};

export const fillerClipUrl = (id: string) => `/oracle-fillers/${id}.mp3`;

/** Every individual recorded clip (for the one-time voice recording). */
export function allFillerClips(): FillerClip[] {
  const seen = new Map<string, FillerClip>();
  for (const c of SHARED_OPENERS) seen.set(c.id, c);
  for (const set of Object.values(FILLER_SETS)) for (const c of [...set.openers, ...set.bridges]) seen.set(c.id, c);
  return [...seen.values()];
}

function openersFor(category: FillerCategory) {
  const set = FILLER_SETS[category];
  return set.shared ? [...SHARED_OPENERS, ...set.openers] : set.openers;
}

/** All stored reactions (opener + bridge combinations). */
export function allFillers(): Filler[] {
  const out: Filler[] = [];
  for (const category of Object.keys(FILLER_SETS) as FillerCategory[]) {
    for (const o of openersFor(category)) for (const b of FILLER_SETS[category].bridges) {
      out.push({ key: `${o.id}+${b.id}`, category, clips: [o, b], text: `${o.text} ${b.text}` });
    }
  }
  return out;
}

export function classifyForFiller(message: string): FillerCategory {
  const m = message.toLowerCase();
  if (/\b(sad|lonely|alone|anxious|anxiety|stress(ed)?|depress(ed|ion)?|upset|hurt(ing)?|scared|afraid|cry(ing)?|miss (him|her|them)|grief|griev|heartbroken|worried|overwhelmed|panic|suicid|self[- ]harm|feel(ing)? (bad|down|awful|terrible|low))\b/.test(m)) return "feelings";
  if (/\b(latest|news|today|tonight|tomorrow|this week|current(ly)?|price of|weather|score|look up|search|google|find out|who won|what time|stock|exchange rate)\b/.test(m)) return "research";
  if (/^(please\s+)?(make|create|write|build|generate|draw|design|plan|draft|compose|edit|fix|turn|convert|summari[sz]e|translate|help me)\b/.test(m) || /\b(can you|could you|would you|will you) (make|create|write|build|generate|draw|design|plan|draft|help)\b/.test(m)) return "task";
  if (/\?\s*$/.test(m) || /^(what|how|why|when|where|who|which|can|could|should|would|is|are|do|does|did|will|tell me|explain)\b/.test(m)) return "question";
  return "chat";
}

/** Pick a random fitting reaction, avoiding recently used ones and the last opener. */
export function pickFiller(message: string, recentKeys: string[] = [], rand: () => number = Math.random): Filler {
  const category = classifyForFiller(message);
  const pool = allFillers().filter(f => f.category === category);
  const lastOpener = recentKeys[recentKeys.length - 1]?.split("+")[0];
  const fresh = pool.filter(f => !recentKeys.includes(f.key) && f.clips[0].id !== lastOpener);
  const choices = fresh.length ? fresh : pool;
  return choices[Math.min(choices.length - 1, Math.floor(rand() * choices.length))];
}
