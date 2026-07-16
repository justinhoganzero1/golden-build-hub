import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { fromPostgrestError, fromUnknown, mcpOk, notAuthenticated } from "../lib/errors";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_wallet_balance",
  title: "Get wallet balance",
  description: "Return the signed-in user's Oracle Lunar wallet balance (cents) and currency.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    try {
      const { data, error } = await userClient(ctx)
        .from("wallet_balances")
        .select("balance_cents, currency, updated_at")
        .maybeSingle();
      if (error) return fromPostgrestError(error);
      const payload = data ?? { balance_cents: 0, currency: "USD", updated_at: null };
      return mcpOk(payload);
    } catch (err) {
      return fromUnknown(err);
    }
  },
});
