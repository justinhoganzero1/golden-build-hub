import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { fromPostgrestError, fromUnknown, mcpOk, notAuthenticated } from "../lib/errors";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_diary_entries",
  title: "List diary entries",
  description: "List the signed-in user's Life Diary entries, most recent first. RLS restricts results to this user only.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of entries to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    try {
      const { data, error } = await userClient(ctx)
        .from("diary_entries")
        .select("id, entry_date, title, content, mood, tags, category, created_at")
        .order("entry_date", { ascending: false })
        .limit(limit);
      if (error) return fromPostgrestError(error);
      return mcpOk({ entries: data ?? [] });
    } catch (err) {
      return fromUnknown(err);
    }
  },
});
