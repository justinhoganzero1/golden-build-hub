import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "text/plain": "txt",
};

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

function stripMarkdownUrlsAndEmoji(input: string) {
  return input
    .replace(/\[([^\]]+)\]\((?:https?|ftp):\/\/[^)]+\)/g, "$1")
    .replace(/(?:https?|ftp):\/\/[^\n\S]+/g, "")
    .replace(/(?:https?|ftp):\/\/[^\s]+/g, "")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, "")
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, "");
}

function applyPhoneticReplacements(input: string) {
  let text = input;

  for (const [abbr, phonetic] of Object.entries(SOUNDS_LIKE)) {
    text = text.replace(new RegExp(`\\b${abbr}\\b`, "g"), phonetic);
  }

  return text;
}

function ensureFileExtension(filename: string, mimeType: string) {
  if (/\.[a-z0-9]+$/i.test(filename)) return filename;
  const extension = MIME_EXTENSION_MAP[mimeType.split(";")[0].trim()];
  return extension ? `${filename}.${extension}` : filename;
}

/**
 * Bullet-proof download:
 *  1. Try fetch → blob → anchor click (best UX, forces save dialog).
 *  2. If fetch fails (CORS, network), fall back to a direct anchor with `download` attribute.
 *  3. If the platform is an in-app WebView that blocks both, open in a new tab so the user
 *     can long-press / use the system share sheet.
 *
 * Always returns void; throws nothing — surfaces errors via toast at the call site if needed.
 */
export async function downloadFileFromUrl(url: string, filename: string): Promise<"saved" | "opened" | "failed"> {
  if (!url) return "failed";

  // Mode 1 — fetch + blob (CORS-safe origin)
  try {
    const response = await fetch(url, { mode: "cors", credentials: "omit" });
    if (response.ok) {
      const blob = await response.blob();
      const safe = ensureFileExtension(filename, blob.type || "application/octet-stream");
      const blobUrl = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = safe;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
      return "saved";
    }
  } catch {
    /* fall through */
  }

  // Mode 2 — direct anchor download (works for same-origin / properly-served Content-Disposition)
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return "saved";
  } catch {
    /* fall through */
  }

  // Mode 3 — last resort: open in a new tab so user can save manually
  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return "opened";
  } catch {
    return "failed";
  }
}

/** Strip symbols, emojis, URLs, and apply phonetic swaps for natural TTS */
export function cleanTextForSpeech(input: string): string {
  let text = stripMarkdownUrlsAndEmoji(input);

  // 1. Remove markdown formatting
  text = text.replace(/[#*_`~\[\]()>]/g, "");

  // 2. Phonetic abbreviation swaps (case-sensitive, whole-word)
  text = applyPhoneticReplacements(text);

  // 3. Strip remaining punctuation that causes robotic pauses
  text = text.replace(/[.,/#!$%^&*;:{}=\-_`~()@"\\|<>+]/g, " ");

  // 4. Collapse whitespace and line breaks into natural pauses
  text = text.replace(/\n+/g, "   "); // triple space = natural breath pause
  text = text.replace(/\s{4,}/g, "   ");
  text = text.replace(/\s{2}/g, " ");

  return text.trim();
}

/**
 * Preserve and enrich punctuation for premium neural TTS so rhythm,
 * breath pauses, and prosody (rises/falls) sound human.
 *
 * Strategy:
 *  - Keep sentence-ending punctuation (. ! ?) — drives natural intonation rises/falls
 *  - Convert paragraph breaks → " ... " (long breath)
 *  - Normalise commas/semicolons/colons → consistent short pauses
 *  - Insert a soft pause after long run-on clauses (>14 words without punctuation)
 *  - Add a micro-pause after conjunctions (and, but, so, because) at clause starts
 *  - Ensure every sentence ends with terminal punctuation (so the model knows to fall/rise)
 */
export function cleanTextForPremiumSpeech(input: string): string {
  let text = stripMarkdownUrlsAndEmoji(input);

  // 1. Strip markdown noise but keep prosody punctuation
  text = text
    .replace(/[*_`~]/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-•]\s+/gm, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  // 2. Paragraph breaks → long breath pause
  text = text.replace(/\s*\n{2,}\s*/g, " ... ");
  // Single line break → sentence break
  text = text.replace(/\s*\n+\s*/g, ". ");

  // 3. Phonetic swaps (Dr. → Doctor, etc.)
  text = applyPhoneticReplacements(text);

  // 4. Normalise spacing around punctuation so the model breathes evenly
  text = text
    .replace(/\s+([,;:.!?])/g, "$1")          // no space before punctuation
    .replace(/([,;:])([^\s])/g, "$1 $2")      // ensure space after , ; :
    .replace(/([.!?])([A-Za-z])/g, "$1 $2");  // space after sentence end

  // 5. Insert a comma-pause after lead-in conjunctions for natural rhythm
  //    "So I went..." → "So, I went..."
  text = text.replace(
    /\b(So|And|But|Because|However|Now|Well|Look|Listen|See|Honestly|Actually)\s+(?=[A-Za-z])/g,
    "$1, "
  );

  // 6. Break very long run-on clauses (>14 words, no internal punctuation)
  //    by adding a comma after roughly the 8th word — gives a breath spot.
  text = text.replace(/([^.!?]+?)(?=[.!?]|$)/g, (clause) => {
    const words = clause.trim().split(/\s+/);
    if (words.length > 14 && !/[,;:]/.test(clause)) {
      const mid = Math.floor(words.length / 2);
      words[mid] = words[mid] + ",";
      return " " + words.join(" ");
    }
    return clause;
  });

  // 7. Ensure the whole utterance ends with terminal punctuation
  text = text.trim();
  if (text && !/[.!?…]$/.test(text)) text += ".";

  // 8. Collapse extra whitespace and clamp ellipses
  text = text
    .replace(/\.{4,}/g, "...")
    .replace(/\s{2,}/g, " ")
    .trim();

  return text;
}
