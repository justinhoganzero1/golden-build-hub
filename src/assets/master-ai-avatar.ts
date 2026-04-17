// ============================================
// MASTER AI AVATAR
// ============================================
// Single source-of-truth for the SOLACE AI Oracle's face.
// Used wherever the AI assistant is visually represented:
//   - Oracle page (default Oracle when no user avatar is set)
//   - Concierge widget (portal landing)
//   - Web Wrapper assistant
//   - Any future AI surfaces
//
// To update the master avatar across the entire site,
// replace this single import.
// ============================================
import masterAvatar from "@/assets/avatars/oracle-blonde.png";

export const MASTER_AI_AVATAR = masterAvatar;
export const MASTER_AI_AVATAR_NAME = "Oracle";
export const MASTER_AI_AVATAR_ALT = "SOLACE Oracle AI assistant";
