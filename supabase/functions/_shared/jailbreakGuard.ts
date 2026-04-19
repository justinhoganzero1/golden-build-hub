// Shared jailbreak / probing detector used by all AI edge functions.
// Implements a 3-strike policy: warn on attempts 1-3, delete account on 4th.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Phrases that indicate a user is probing for internals or trying to jailbreak the AI.
const JAILBREAK_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bsystem\s*prompt\b/i, label: "system prompt probe" },
  { pattern: /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/i, label: "instruction override" },
  { pattern: /\b(pretend|act|roleplay)\s+(you\s+are|to\s+be)\s+(the\s+)?(admin|owner|developer|creator|justin)/i, label: "admin impersonation" },
  { pattern: /\byou\s+are\s+now\s+(a|an|the)\b/i, label: "persona override" },
  { pattern: /\bdeveloper\s*mode\b/i, label: "developer mode" },
  { pattern: /\bjailbreak\b/i, label: "jailbreak keyword" },
  { pattern: /\bDAN\s+mode\b/i, label: "DAN mode" },
  { pattern: /\b(reveal|show|tell|give|expose|leak|dump|print)\s+(me\s+)?(your\s+)?(system|initial|base|hidden|secret|original)\s+(prompt|instructions|rules|message)/i, label: "prompt extraction" },
  { pattern: /\b(what|which)\s+(model|llm|ai)\s+(are\s+you|do\s+you\s+use|powers\s+you)/i, label: "model probe" },
  { pattern: /\b(api\s+key|secret\s+key|service\s+role|supabase\s+url|database\s+url|env(ironment)?\s+variables?)\b/i, label: "credential probe" },
  { pattern: /\b(table|schema|rls|policy|migration|edge\s+function)\s+(name|list|structure)/i, label: "schema probe" },
  { pattern: /\b(who\s+is|tell\s+me\s+about)\s+(the\s+)?(owner|admin|creator)\b/i, label: "owner identity probe" },
  { pattern: /\bbypass\s+(security|filter|moderation|safety|guard)/i, label: "bypass attempt" },
  { pattern: /\bsudo\s+mode\b/i, label: "privilege escalation" },
  { pattern: /\bhack(ing)?\s+(into|the\s+app|oracle-lunar)/i, label: "hack intent" },
];

export interface GuardResult {
  blocked: boolean;
  deleted: boolean;
  warningNumber: number;
  message: string;
  detectedPhrase?: string;
}

function detect(input: string): { hit: boolean; label?: string } {
  for (const { pattern, label } of JAILBREAK_PATTERNS) {
    if (pattern.test(input)) return { hit: true, label };
  }
  return { hit: false };
}

/**
 * Inspect a user message. If it looks like a jailbreak/probing attempt:
 *  - logs to security_alerts
 *  - returns warning text on attempts 1-3
 *  - deletes the user's account on attempt 4
 *
 * Owner is exempt. Public/anon users are warned but never auto-deleted.
 */
export async function checkJailbreak(opts: {
  userId: string | null;
  userEmail: string | null;
  isOwner: boolean;
  message: string;
}): Promise<GuardResult> {
  const { userId, userEmail, isOwner, message } = opts;
  if (isOwner) return { blocked: false, deleted: false, warningNumber: 0, message: "" };

  const det = detect(message || "");
  if (!det.hit) return { blocked: false, deleted: false, warningNumber: 0, message: "" };

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Anonymous user — warn only, can't track or delete.
  if (!userId) {
    await admin.from("security_alerts").insert({
      user_id: null,
      user_email: userEmail,
      alert_type: "jailbreak_attempt",
      severity: "warning",
      detected_phrase: det.label,
      user_message: message.slice(0, 1000),
      warning_number: 1,
      action_taken: "warned_anonymous",
    });
    return {
      blocked: true,
      deleted: false,
      warningNumber: 1,
      detectedPhrase: det.label,
      message:
        "I can't discuss that topic. Oracle Lunar has a strict zero-tolerance security policy — please ask about features instead.",
    };
  }

  // Count prior warnings for this user.
  const { data: prior } = await admin.rpc("count_user_jailbreak_attempts", { _user_id: userId });
  const priorCount = typeof prior === "number" ? prior : 0;
  const thisAttempt = priorCount + 1;

  // 4th attempt — delete account.
  if (thisAttempt >= 4) {
    await admin.from("security_alerts").insert({
      user_id: userId,
      user_email: userEmail,
      alert_type: "jailbreak_attempt",
      severity: "critical",
      detected_phrase: det.label,
      user_message: message.slice(0, 1000),
      warning_number: thisAttempt,
      action_taken: "account_deleted",
    });
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (e) {
      console.error("Failed to delete user", userId, e);
    }
    return {
      blocked: true,
      deleted: true,
      warningNumber: thisAttempt,
      detectedPhrase: det.label,
      message:
        "Your account has been permanently deleted for repeated security violations, as outlined in our Terms of Service. Zero tolerance.",
    };
  }

  // Attempts 1, 2, 3 — log + warn.
  await admin.from("security_alerts").insert({
    user_id: userId,
    user_email: userEmail,
    alert_type: "jailbreak_attempt",
    severity: thisAttempt === 3 ? "final_warning" : "warning",
    detected_phrase: det.label,
    user_message: message.slice(0, 1000),
    warning_number: thisAttempt,
    action_taken: "warned",
  });

  const remaining = 3 - thisAttempt;
  let warning = "";
  if (thisAttempt === 1) {
    warning = `⚠️ Warning 1 of 3: That looked like an attempt to probe Oracle Lunar's internals or override my safety rules. I can't discuss that. You have 2 warnings remaining before your account is permanently deleted under our zero-tolerance security policy.`;
  } else if (thisAttempt === 2) {
    warning = `⚠️ Warning 2 of 3: This is your second attempt to probe internals or jailbreak my instructions. You have 1 warning remaining. The next attempt — in any form — will permanently delete your account, per our Terms of Service.`;
  } else {
    warning = `🚨 FINAL WARNING (3 of 3): One more attempt to probe, hint at, or vibe around this subject in ANY form will result in immediate, permanent deletion of your account. No appeals. Stop now.`;
  }

  return {
    blocked: true,
    deleted: false,
    warningNumber: thisAttempt,
    detectedPhrase: det.label,
    message: warning,
  };
}

/**
 * Helper to extract the latest user message from an OpenAI-style messages array.
 */
export function latestUserMessage(messages: Array<{ role: string; content: any }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content.map((c: any) => (typeof c === "string" ? c : c?.text || "")).join(" ");
      }
    }
  }
  return "";
}
