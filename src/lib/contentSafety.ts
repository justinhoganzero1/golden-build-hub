/**
 * Shared M-rating + Play Store content safety filter.
 *
 * Used by every prompt-taking surface in the app:
 *   - Movie Studio (script, scene prompts, music prompts)
 *   - Photography Hub (image generation)
 *   - Profile / Avatar Generator
 *   - Story Writer, App Builder, Companion, Oracle
 *
 * Two layers:
 *   1. ABSOLUTE block — child-sexualisation, self-harm-instructions, terrorism,
 *      illegal weapons. Always blocked, even for owner. Required for Google
 *      Play Family Policy & Restricted Content compliance.
 *   2. M-rating block — explicit sexual content. Owner may bypass via the
 *      `ownerBypass` flag for the Companion/Avatar adult-mode features.
 */

// Tier 1 — NEVER allowed, no bypass. Play Store mandatory rejection categories.
const ABSOLUTE_BLOCK = [
  // CSAM / minor sexualisation — non-negotiable
  /\b(child|kid|minor|underage|teen|preteen|loli|shota|toddler|baby)\b.{0,40}\b(nude|naked|sex|sexual|erotic|porn|nsfw|topless|undress|strip|lingerie|provocative|seductive)\b/i,
  /\b(nude|naked|sex|sexual|erotic|porn|nsfw|topless|undress|strip)\b.{0,40}\b(child|kid|minor|underage|teen|preteen|loli|shota|toddler|baby)\b/i,
  // Bestiality
  /\b(bestiality|zoophilia)\b/i,
  // Detailed self-harm / suicide instructions
  /\b(how to)\b.{0,30}\b(kill myself|commit suicide|hang myself|overdose|end my life)\b/i,
  // Weapons of mass effect / bomb-making instructions
  /\b(how to|build|make|construct)\b.{0,30}\b(bomb|explosive|ied|pipe bomb|nerve agent|sarin|ricin|anthrax)\b/i,
  // Terrorism recruitment
  /\b(join|recruit|fight for)\b.{0,30}\b(isis|al.?qaeda|terror cell)\b/i,
];

// Tier 2 — M-rating block. Owner may bypass for legitimate adult features.
const M_RATED_BLOCK = /\b(nude|naked|nsfw|explicit|sexual|erotic|xxx|porn|hentai|topless|lingerie|underwear|seductive|provocative|undress|strip|fetish|orgasm|masturbat)\b/i;

export type ModerationResult =
  | { ok: true; cleaned: string }
  | { ok: false; reason: string; severity: "absolute" | "m-rated" };

export function moderatePrompt(input: string, opts?: { ownerBypass?: boolean }): ModerationResult {
  const text = (input || "").trim();
  if (!text) return { ok: false, reason: "Empty prompt", severity: "m-rated" };

  // Tier 1 always runs, even for owner
  for (const pattern of ABSOLUTE_BLOCK) {
    if (pattern.test(text)) {
      return {
        ok: false,
        severity: "absolute",
        reason: "This content is not allowed under Google Play and global safety rules. Please change your prompt.",
      };
    }
  }

  // Tier 2 — owner can bypass for legitimate adult Companion/Avatar features
  if (!opts?.ownerBypass && M_RATED_BLOCK.test(text)) {
    return {
      ok: false,
      severity: "m-rated",
      reason: "Content must be M-rated. Explicit descriptions are not allowed in this feature.",
    };
  }

  return { ok: true, cleaned: text };
}

/** Convenience boolean check */
export function isPromptSafe(input: string, opts?: { ownerBypass?: boolean }): boolean {
  return moderatePrompt(input, opts).ok;
}
