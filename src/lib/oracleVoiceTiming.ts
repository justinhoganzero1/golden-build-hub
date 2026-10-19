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