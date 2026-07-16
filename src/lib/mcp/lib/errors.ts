// Consistent error / success shape for every Oracle Lunar MCP tool.
//
// MCP tool results are unstructured by spec, so a bare error string forces the
// calling agent to guess the failure category. We standardize on:
//
//   { code: <machine string>, message: <human sentence>, details?: any }
//
// which is returned both as a JSON `text` content item (so text-only clients
// can still display it) AND as `structuredContent` (so structured clients can
// branch on `code`). `isError: true` is always set on failure.
//
// The `code` values are stable and safe to switch on in agent prompts:
//
//   unauthenticated  — no valid Bearer token / MCP session
//   forbidden        — RLS or a policy rejected the operation
//   invalid_input    — Zod / arg validation failed, bad shape, empty string
//   not_found        — target row does not exist for this user
//   conflict         — unique-violation, optimistic-lock, duplicate
//   rate_limited     — Supabase / gateway throttled us
//   internal         — unexpected Supabase / network error

import type { PostgrestError } from "@supabase/supabase-js";

export type McpErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal";

export interface McpErrorPayload {
  code: McpErrorCode;
  message: string;
  details?: unknown;
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function mcpError(
  code: McpErrorCode,
  message: string,
  details?: unknown,
): McpToolResult {
  const payload: McpErrorPayload = { code, message, ...(details ? { details } : {}) };
  return {
    content: [{ type: "text", text: JSON.stringify({ error: payload }) }],
    structuredContent: { error: payload },
    isError: true,
  };
}

export function mcpOk(structured: Record<string, unknown>, humanText?: string): McpToolResult {
  return {
    content: [{ type: "text", text: humanText ?? JSON.stringify(structured) }],
    structuredContent: structured,
  };
}

export const notAuthenticated = () =>
  mcpError(
    "unauthenticated",
    "Not signed in. Reconnect the Oracle Lunar MCP server and complete the sign-in and consent flow.",
  );

/**
 * Translate a Supabase PostgrestError into a standardized MCP error.
 * RLS denials surface as `42501` (insufficient_privilege) or PGRST codes.
 */
export function fromPostgrestError(err: PostgrestError): McpToolResult {
  const code = err.code ?? "";
  // RLS / permission denied
  if (code === "42501" || /row-level security|permission denied/i.test(err.message)) {
    return mcpError(
      "forbidden",
      "Access denied by row-level security. This tool can only read or modify data that belongs to the signed-in user.",
      { pgCode: code },
    );
  }
  // No rows returned when .single() was expected
  if (code === "PGRST116") {
    return mcpError("not_found", "No matching record found for the signed-in user.", { pgCode: code });
  }
  // Unique / FK / check constraint
  if (code === "23505") {
    return mcpError("conflict", "That record already exists.", { pgCode: code });
  }
  if (code === "23503" || code === "23514" || code === "23502") {
    return mcpError("invalid_input", err.message, { pgCode: code });
  }
  // Explicit rate limiting hints
  if (/rate.?limit|too many/i.test(err.message)) {
    return mcpError("rate_limited", "The backend is rate-limiting requests. Try again shortly.");
  }
  return mcpError("internal", err.message || "Unexpected database error.", { pgCode: code });
}

/** Wrap an unknown thrown value as an internal MCP error. */
export function fromUnknown(err: unknown): McpToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return mcpError("internal", message);
}
