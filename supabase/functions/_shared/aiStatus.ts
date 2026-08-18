// Shared mapping for Lovable AI Gateway failures.
// 429 = rate limited (retryable), 402 = out of credits (needs user action),
// everything else = generic upstream failure. Keeping this in one place stops
// each function from inventing its own (usually wrong) status code.

export interface AiGatewayFailure {
  status: number;
  code: "rate_limited" | "payment_required" | "ai_upstream_error";
  message: string;
}

export function mapAiGatewayStatus(status: number): AiGatewayFailure {
  if (status === 429) {
    return { status: 429, code: "rate_limited", message: "AI is busy right now. Please try again in a moment." };
  }
  if (status === 402) {
    return { status: 402, code: "payment_required", message: "AI credits exhausted. Top up your wallet to continue." };
  }
  return { status: 502, code: "ai_upstream_error", message: "The AI service is temporarily unavailable." };
}

/** Build a JSON Response for a failed AI gateway call, with CORS applied. */
export function aiGatewayErrorResponse(
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  const f = mapAiGatewayStatus(status);
  return new Response(JSON.stringify({ error: f.code, message: f.message }), {
    status: f.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Error carrying an upstream gateway status so outer catch blocks can map it. */
export class AiGatewayError extends Error {
  constructor(public readonly upstreamStatus: number, message?: string) {
    super(message ?? `AI gateway error ${upstreamStatus}`);
    this.name = "AiGatewayError";
  }
}
