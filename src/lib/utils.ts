import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip symbols, emojis, and URLs from text before sending to TTS */
export function cleanTextForSpeech(input: string): string {
  return input
    .replace(/[#*_`~\[\]()>]/g, "")         // markdown symbols
    .replace(/[^\w\s.,!?;:'-]/g, "")         // remaining punctuation/symbols (keep basic ones)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")  // common emojis
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")  // misc symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")  // transport & map symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, "")    // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, "")    // dingbats
    .replace(/(?:https?|ftp):\/\/[\n\S]+/g, "") // URLs
    .replace(/\n+/g, ". ")
    .trim();
}
