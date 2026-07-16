import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const start = from_date ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await userClient(ctx)
      .from("calendar_events")
      .select("id, title, description, event_date, start_time, end_time, category")
      .gte("event_date", start)
      .order("event_date", { ascending: true })
      .limit(limit);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { events: data ?? [] },
    };
  },
});
