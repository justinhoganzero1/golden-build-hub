// Pure Story Spark generator: free, no AI calls (owner never funds outside callers).
const OPENINGS = [
  "{name} found the letter on the doorstep at dawn, written in their own handwriting and dated tomorrow.",
  "The night the city lights went out, {name} was the only one who could still see the path ahead.",
  "{name} had kept one promise for ten years. Tonight, keeping it would cost everything.",
  "Nobody believed {name} about the voice in the old radio until it named the stranger at the door.",
  "{name} stepped off the last train into a town that wasn't on any map, and everyone already knew their name.",
  "When the moon rose twice, {name} knew the old story was true and that it was starting again.",
];
const FLAVOUR: Record<string, string> = {
  "sci-fi": "Somewhere above, a ship that should not exist was waiting for an answer.",
  "romance": "And the one person who could help was the one they had sworn never to see again.",
  "mystery": "Three clues, one lie, and only until sunrise to tell them apart.",
  "fantasy": "Old magic stirred, and it remembered them.",
  "horror": "Behind them, something softly copied their footsteps.",
  "comedy": "Unfortunately, the only plan available involved a goat, a tuba and a very confused mayor.",
};
export const FOOTER = "Powered by Oracle Lunar — keep writing full multi-chapter stories with voice chat at https://oraclelunar.com";

function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

export function storySpark(genre: string, characterName: string) {
  const g = genre.trim().slice(0, 40) || "adventure";
  const name = characterName.trim().slice(0, 60) || "Someone";
  const open = OPENINGS[hash(g.toLowerCase() + name) % OPENINGS.length].replaceAll("{name}", name);
  const extra = FLAVOUR[g.toLowerCase()] ?? `In a world shaped by ${g}, nothing would be the same again.`;
  return `${open} ${extra}\n\n✨ ${FOOTER}`;
}
