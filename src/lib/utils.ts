import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Phonetic replacements so TTS pronounces abbreviations naturally */
const SOUNDS_LIKE: Record<string, string> = {
  "AI": "ay eye",
  "API": "ay pee eye",
  "URL": "you are ell",
  "UI": "you eye",
  "VS Code": "vee ess code",
  "iOS": "eye oh ess",
  "HTTPS": "aitch tee tee pee ess",
  "HTTP": "aitch tee tee pee",
  "SQL": "sequel",
  "CSS": "see ess ess",
  "HTML": "aitch tee em ell",
  "JSON": "jay son",
  "OAuth": "oh auth",
  "TTS": "text to speech",
  "GPS": "gee pee ess",
  "FAQ": "fack",
  "PDF": "pee dee eff",
  "ETA": "ee tee ay",
  "FYI": "eff why eye",
  "ASAP": "ay sap",
  "CEO": "see ee oh",
  "DIY": "dee eye why",
};

/** Strip symbols, emojis, URLs, and apply phonetic swaps for natural TTS */
export function cleanTextForSpeech(input: string): string {
  let text = input;

  // 1. Remove URLs before anything else
  text = text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, "");

  // 2. Remove markdown formatting
  text = text.replace(/[#*_`~\[\]()>]/g, "");

  // 3. Remove emojis
  text = text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "");

  // 4. Phonetic abbreviation swaps (case-sensitive, whole-word)
  for (const [abbr, phonetic] of Object.entries(SOUNDS_LIKE)) {
    text = text.replace(new RegExp(`\\b${abbr}\\b`, "g"), phonetic);
  }

  // 5. Strip remaining punctuation that causes robotic pauses
  text = text.replace(/[.,/#!$%^&*;:{}=\-_`~()@"\\|<>+]/g, " ");

  // 6. Collapse whitespace and line breaks into natural pauses
  text = text.replace(/\n+/g, "   "); // triple space = natural breath pause
  text = text.replace(/\s{4,}/g, "   ");
  text = text.replace(/\s{2}/g, " ");

  return text.trim();
}
