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

type Chapter = { title?: string; content?: string; images?: unknown };
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

async function loadDoc(ctx: ToolContext, bookId: string) {
  const { data, error } = await userClient(ctx).rpc("get_story_writer_document", { _story_id: bookId });
  if (error) throw error;
  const doc = (data ?? {}) as { title?: string; metadata?: { chapters?: Chapter[] } & Record<string, unknown> };
  return { title: doc.title ?? "", metadata: doc.metadata ?? {}, chapters: doc.metadata?.chapters ?? [] };
}

export const listBooksTool = defineTool({
  name: "list_books",
  title: "List my books",
  description: "List the signed-in user's Story Writer books with id, title, chapter count and word count.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    try {
      const { data, error } = await userClient(ctx)
        .from("user_media")
        .select("id, title, metadata, updated_at")
        .eq("user_id", ctx.getUserId()!)
        .eq("media_type", "story")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) return fromPostgrestError(error);
      const books = (data ?? []).map((r) => {
        const ch = ((r.metadata as { chapters?: Chapter[] } | null)?.chapters ?? []);
        return {
          id: r.id,
          title: r.title ?? "Untitled",
          chapters: ch.length,
          words: ch.reduce((n, c) => n + words(c.content ?? ""), 0),
          updated_at: r.updated_at,
        };
      });
      return mcpOk({ books });
    } catch (err) {
      return fromUnknown(err);
    }
  },
});

export const getBookChaptersTool = defineTool({
  name: "get_book_chapters",
  title: "Read book chapters",
  description: "Read the full text of a range of chapters (1-based, up to 5 at a time) from one of the user's books.",
  inputSchema: {
    book_id: z.string().uuid().describe("Book id from list_books."),
    from_chapter: z.number().int().min(1).default(1).describe("First chapter number."),
    count: z.number().int().min(1).max(5).default(3).describe("How many chapters to return (max 5)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ book_id, from_chapter, count }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    try {
      const doc = await loadDoc(ctx, book_id);
      const slice = doc.chapters.slice(from_chapter - 1, from_chapter - 1 + count).map((c, i) => ({
        number: from_chapter + i,
        title: c.title ?? "",
        words: words(c.content ?? ""),
        content: c.content ?? "",
      }));
      return mcpOk({ book_title: doc.title, total_chapters: doc.chapters.length, chapters: slice });
    } catch (err) {
      return fromUnknown(err);
    }
  },
});

export const saveBookChapterTool = defineTool({
  name: "save_book_chapter",
  title: "Save a book chapter",
  description:
    "Replace an existing chapter's title and text, or add a new chapter at the end (chapter_number = total + 1). Existing pictures on that chapter are kept.",
  inputSchema: {
    book_id: z.string().uuid().describe("Book id from list_books."),
    chapter_number: z.number().int().min(1).describe("Chapter to replace, or total+1 to add a new one."),
    title: z.string().trim().min(1).max(200).describe("Chapter title."),
    content: z.string().trim().min(50).describe("Full chapter text."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ book_id, chapter_number, title, content }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    try {
      const doc = await loadDoc(ctx, book_id);
      const chapters = [...doc.chapters];
      if (chapter_number > chapters.length + 1) {
        return mcpOk({ saved: false, message: `Book has ${chapters.length} chapters; use ${chapters.length + 1} to add a new one.` });
      }
      const prev = chapters[chapter_number - 1];
      chapters[chapter_number - 1] = { ...(prev ?? {}), title, content };
      const { error } = await userClient(ctx).rpc("save_story_writer_document", {
        _story_id: book_id,
        _title: doc.title,
        _metadata: { ...doc.metadata, chapters } as never,
      });
      if (error) return fromPostgrestError(error);
      return mcpOk({ saved: true, chapter_number, words: words(content), total_chapters: chapters.length });
    } catch (err) {
      return fromUnknown(err);
    }
  },
});
