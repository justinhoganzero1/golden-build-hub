export type PresenterState = "idle" | "listening" | "thinking" | "speaking";
export interface PresenterClip { id: string; url: string; states: PresenterState[]; approved: boolean; silent: boolean; }

export function choosePresenterClip(clips: PresenterClip[], state: PresenterState, recent: string[], ratings: Record<string, number> = {}): PresenterClip | null {
  const eligible = clips.filter(clip => clip.approved && clip.silent && clip.states.includes(state));
  if (!eligible.length) return null;
  const fresh = eligible.filter(clip => !recent.includes(clip.id));
  const notLast = eligible.filter(clip => clip.id !== recent[recent.length - 1]);
  const pool = fresh.length ? fresh : notLast.length ? notLast : eligible;
  return [...pool].sort((a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0) || a.id.localeCompare(b.id))[0];
}
export function presenterHistory(recent: string[], id: string) { return [...recent, id].slice(-12); }
export function feedbackKey(userId: string) { return `oracle-response-feedback:${userId}`; }
export function oracleToolDestination(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !/^\/(oracle|chat-oracle)([/?#]|$)/.test(path);
}