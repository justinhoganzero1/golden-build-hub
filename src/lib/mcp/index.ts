import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listDiaryEntriesTool from "./tools/list-diary-entries";
import createDiaryEntryTool from "./tools/create-diary-entry";
import getWalletBalanceTool from "./tools/get-wallet-balance";
import listCalendarEventsTool from "./tools/list-calendar-events";
import { listBooksTool, getBookChaptersTool, saveBookChapterTool } from "./tools/books";

// The OAuth issuer MUST be the direct Supabase host. Read the project ref from
// the Vite-inlined env var so this module stays import-safe (no runtime env
// read at the top level of the entry).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "oracle-lunar-mcp",
  title: "Oracle Lunar",
  version: "0.2.0",
  instructions:
    "Tools for the signed-in Oracle Lunar user. Read and write their Life Diary, view calendar events, check their wallet balance, and read/write their Story Writer books (list_books, get_book_chapters, save_book_chapter — read chapters in small batches). All tools run as the connected user under RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listDiaryEntriesTool,
    createDiaryEntryTool,
    getWalletBalanceTool,
    listCalendarEventsTool,
    listBooksTool,
    getBookChaptersTool,
    saveBookChapterTool,
  ],
});
