import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fromPostgrestError, fromUnknown, mcpError, mcpOk, notAuthenticated } from "../lib/errors";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default defineTool({
  name: "list_calendar_events",
  title: "List calendar events",
  description: "List the signed-in user's upcoming calendar events, sorted by date.",
  inputSchema: {
    from_date: z.string().optional().describe("Inclusive YYYY-MM-DD start date. Defaults to today."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ from_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (from_date && !DATE_RE.test(from_date)) {
      return mcpError("invalid_input", "from_date must be an ISO date in YYYY-MM-DD format.");
    }
    try {
      const start = from_date ?? new Date().toISOString().slice(0, 10);
      const { data, error } = await userClient(ctx)
        .from("calendar_events")
        .select("id, title, description, event_date, start_time, end_time, category")
        .gte("event_date", start)
        .order("event_date", { ascending: true })
        .limit(limit);
      if (error) return fromPostgrestError(error);
      return mcpOk({ events: data ?? [] });
    } catch (err) {
      return fromUnknown(err);
    }
  },
});
