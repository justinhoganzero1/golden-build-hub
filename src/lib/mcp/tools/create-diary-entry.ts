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
  name: "create_diary_entry",
  title: "Create diary entry",
  description: "Create a new Life Diary entry for the signed-in user.",
  inputSchema: {
    title: z.string().trim().min(1).describe("Short title for the entry."),
    content: z.string().trim().min(1).describe("Body text of the diary entry."),
    mood: z.string().trim().optional().describe("Optional mood label, e.g. 'calm', 'grateful'."),
    entry_date: z.string().optional().describe("YYYY-MM-DD date. Defaults to today."),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    const row = {
      user_id: ctx.getUserId(),
      title: input.title,
      content: input.content,
      mood: input.mood ?? null,
      entry_date: input.entry_date ?? new Date().toISOString().slice(0, 10),
      tags: input.tags ?? null,
      category: input.category ?? null,
    };
    const { data, error } = await userClient(ctx).from("diary_entries").insert(row).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created diary entry ${data.id}` }],
      structuredContent: { entry: data },
    };
  },
});
