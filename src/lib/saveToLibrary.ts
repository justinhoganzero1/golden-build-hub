import { supabase } from "@/integrations/supabase/client";

/**
 * Universal "save to user library" helper.
 *
 * Anything the Oracle (or any feature) creates for the user — text answers,
 * generated images, audio clips, videos, app exports, notes, etc. — should
 * be funnelled through this helper so it lands in `user_media` and shows
 * up in the My Library page automatically.
 *
 * Fire-and-forget: never throws, never blocks the calling UI. Failures are
 * logged to the console only.
 *
 * Users own their library and can delete any item (or wipe it entirely)
 * from the My Library page — RLS guarantees row-level ownership.
 */
export type LibraryMediaType = "text" | "image" | "video" | "audio" | "app" | "document";

export interface SaveToLibraryInput {
  media_type: LibraryMediaType;
  title: string;
  /** URL, data URL, or for `text` notes the raw content. */
  url: string;
  /** Source feature/page (e.g. "oracle", "oracle-image", "magic-hub"). */
  source_page: string;
  thumbnail_url?: string;
  metadata?: Record<string, unknown>;
}

export async function saveToLibrary(input: SaveToLibraryInput): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[saveToLibrary] skipped — user not signed in");
      return null;
    }
    const { data, error } = await supabase
      .from("user_media")
      .insert([{ ...input, user_id: user.id } as any])
      .select("id")
      .single();
    if (error) {
      console.warn("[saveToLibrary] insert failed", error.message, error);
      return null;
    }
    // Notify any listeners (Library page) so it refetches immediately
    try { window.dispatchEvent(new CustomEvent("library:updated", { detail: { id: data?.id } })); } catch { /* noop */ }
    return data?.id ?? null;
  } catch (e) {
    console.warn("[saveToLibrary] unexpected", e);
    return null;
  }
}

/**
 * Convenience: persist an Oracle (or any AI agent) text turn as a note in
 * the user's library. Skips trivial / empty content.
 */
export function saveOracleTextTurn(opts: {
  userMessage: string;
  assistantMessage: string;
  oracleName: string;
  source?: string;
}) {
  const ans = (opts.assistantMessage || "").trim();
  if (ans.length < 12) return; // skip tiny acknowledgements
  const titleSeed = (opts.userMessage || ans).trim().replace(/\s+/g, " ");
  const title = `${opts.oracleName}: ${titleSeed.slice(0, 60)}${titleSeed.length > 60 ? "…" : ""}`;
  void saveToLibrary({
    media_type: "text",
    title,
    url: ans,
    source_page: opts.source || "oracle",
    metadata: {
      kind: "chat_note",
      oracle: opts.oracleName,
      user_prompt: opts.userMessage?.slice(0, 500) || "",
      saved_at: new Date().toISOString(),
    },
  });
}
