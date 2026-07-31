/**
 * Disclosure automation.
 *
 * Auto-fills the AI-assistance declarations that Amazon KDP, Audible/ACX and
 * YouTube now require, using the real facts from the project (what the AI did,
 * how much the human edited, which tools were used).
 *
 * This is the honest counterpart to metadata hygiene: we remove private
 * identifiers, we never remove the AI declaration.
 */

export interface DisclosureFacts {
  title: string;
  author: string;
  aiTextUsed: boolean;
  aiImagesUsed: boolean;
  aiVoiceUsed: boolean;
  humanEditedPercent?: number;
  tools?: string[];
}

const toolLine = (f: DisclosureFacts) =>
  (f.tools && f.tools.length ? f.tools : ["Oracle Lunar (Google Gemini, OpenAI, ElevenLabs)"]).join(", ");

/**
 * Amazon KDP: during publishing you must answer whether AI-generated content
 * (text, images, translations) is included, and in which categories.
 */
export function kdpDisclosure(f: DisclosureFacts): string {
  const cats: string[] = [];
  if (f.aiTextUsed) cats.push("Text");
  if (f.aiImagesUsed) cats.push("Images");
  return [
    "AMAZON KDP — AI CONTENT DECLARATION (copy into the KDP publishing form)",
    `Title: ${f.title || "Untitled"}`,
    `Author: ${f.author || "Unknown"}`,
    "",
    `Question: "Did you use AI-based tools in creating text, images, or translations in your book?"`,
    `Answer: YES`,
    "",
    `Which categories contain AI-generated content? ${cats.length ? cats.join(", ") : "None"}`,
    `Text: ${f.aiTextUsed ? "AI-generated content that I reviewed and edited" : "No AI-generated text"}`,
    `Images: ${f.aiImagesUsed ? "AI-generated images that I reviewed and selected" : "No AI-generated images"}`,
    `Translations: No AI-generated translations`,
    "",
    typeof f.humanEditedPercent === "number"
      ? `Degree of human editing: substantial — approximately ${f.humanEditedPercent.toFixed(0)}% of tracked changes to this manuscript were made directly by the author (see HUMAN-AUTHORSHIP-LOG.txt).`
      : "Degree of human editing: the author reviewed and revised the AI output before publication.",
    `Tools used: ${toolLine(f)}`,
    "",
    "Note: KDP treats AI-generated content as publishable when disclosed. This",
    "declaration is provided so the submission is accurate and compliant.",
  ].join("\n");
}

/** Audible / ACX: narration source must be declared (human vs synthesised). */
export function acxDisclosure(f: DisclosureFacts): string {
  return [
    "AUDIBLE / ACX — NARRATION & AI DECLARATION",
    `Title: ${f.title || "Untitled"}`,
    `Author: ${f.author || "Unknown"}`,
    "",
    `Narration type: ${f.aiVoiceUsed ? "SYNTHETIC / AI-GENERATED (text-to-speech)" : "Human narration"}`,
    f.aiVoiceUsed
      ? "Narrator credit: AI narration produced with ElevenLabs text-to-speech, commissioned and directed by the rights holder."
      : "Narrator credit: human narrator.",
    `Underlying text: ${f.aiTextUsed ? "AI-assisted, reviewed and edited by the author" : "Written by the author"}`,
    "",
    "Rights confirmation: the rights holder holds commercial usage rights to the",
    "synthetic voice used and to the manuscript being narrated.",
    "",
    "IMPORTANT: ACX distribution rules for AI narration change by territory and",
    "programme. Confirm your title is enrolled in a programme that accepts",
    "virtual voice narration before submitting.",
    `Tools used: ${toolLine(f)}`,
  ].join("\n");
}

/** YouTube: "altered or synthetic content" disclosure in Studio upload flow. */
export function youtubeDisclosure(f: DisclosureFacts): string {
  return [
    "YOUTUBE — ALTERED OR SYNTHETIC CONTENT DISCLOSURE",
    `Title: ${f.title || "Untitled"}`,
    `Channel owner: ${f.author || "Unknown"}`,
    "",
    `In YouTube Studio → Upload → Altered content, answer: YES`,
    "Tick the items that apply to this upload:",
    `  [${f.aiImagesUsed ? "x" : " "}] Realistic-looking scenes or imagery that were generated with AI`,
    `  [${f.aiVoiceUsed ? "x" : " "}] A synthetic voice that sounds like a real person`,
    `  [ ] Making a real person appear to say or do something they did not`,
    "",
    "Suggested description line (paste into the video description):",
    `  "Created with AI assistance using ${toolLine(f)}. Written${f.humanEditedPercent ? ` and edited (${f.humanEditedPercent.toFixed(0)}% human-revised)` : ""} by ${f.author || "the channel owner"}."`,
  ].join("\n");
}

export function allDisclosures(f: DisclosureFacts): Record<string, string> {
  return {
    "DISCLOSURE-KDP.txt": kdpDisclosure(f),
    "DISCLOSURE-ACX-AUDIBLE.txt": acxDisclosure(f),
    "DISCLOSURE-YOUTUBE.txt": youtubeDisclosure(f),
  };
}

/** One combined summary for quick copy/paste. */
export function combinedDisclosure(f: DisclosureFacts): string {
  return [kdpDisclosure(f), "", "=".repeat(60), "", acxDisclosure(f), "", "=".repeat(60), "", youtubeDisclosure(f)].join("\n");
}
