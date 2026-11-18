export const VOICE_FINAL_PAUSE_MS = 450;
export const VOICE_INTERIM_PAUSE_MS = 900;

// Only emit complete phrases; never speak a partial internal command marker.
export function takeSpeakablePrefix(text: string, final = false): number {
  const marker = text.indexOf("[[");
  const safeText = marker < 0 ? text : text.slice(0, marker);
  const sentence = /[.!?\n](?:\s|$)/.exec(safeText);
  if (sentence) return sentence.index + sentence[0].length;
  const phrase = /[,;:]\s/.exec(safeText);
  if (phrase && safeText.slice(0, phrase.index).trim().split(/\s+/).length >= 5) {
    return phrase.index + phrase[0].length;
  }
  if (final) return safeText.length;
  return 0;
}
export type QueuedSpeech = { text: string; agentName: string };

/**
 * Joins the speaker's waiting sentences into one longer run (up to maxChars)
 * so Oracle talks in flowing passages instead of restarting her voice — and
 * waiting on a new voice request — after every sentence. Stops at another
 * speaker or an item that already has its audio prepared.
 */
export function mergeQueuedSpeech<T extends QueuedSpeech & { audio?: unknown }>(
  first: string,
  queue: T[],
  agentName: string,
  maxChars = 500,
): { text: string; taken: number } {
  let text = first.trim();
  let taken = 0;
  while (taken < queue.length) {
    const item = queue[taken];
    if (item.agentName !== agentName || item.audio) break;
    const piece = item.text.trim();
    if (text && text.length + 1 + piece.length > maxChars) break;
    text = text ? `${text} ${piece}` : piece;
    taken += 1;
  }
  return { text, taken };
}
