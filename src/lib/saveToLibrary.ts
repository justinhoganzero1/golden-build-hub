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
  is_public?: boolean;
  /** Optional: list this item in the Creators Shop. Implies is_public=true. */
  shop_enabled?: boolean;
  /** Optional: price in cents when shop_enabled is true. */
  shop_price_cents?: number;
}

export async function saveToLibrary(input: SaveToLibraryInput): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn("[saveToLibrary] skipped — user not signed in");
      return null;
    }

    const wantsShop = !!input.shop_enabled && (input.shop_price_cents ?? 0) > 0;
    const isPublic = !!input.is_public || wantsShop;

    let savedId: string | null = null;

    const { data: rpcId, error: rpcError } = await (supabase as any).rpc("save_library_item", {
      _media_type: input.media_type,
      _title: input.title,
      _url: input.url,
      _source_page: input.source_page,
      _thumbnail_url: input.thumbnail_url ?? null,
      _metadata: input.metadata ?? {},
      _is_public: isPublic,
    });
    if (!rpcError && rpcId) {
      savedId = rpcId as string;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn("[saveToLibrary] skipped — user not signed in");
        return null;
      }
      const { data, error } = await supabase
        .from("user_media")
        .insert([{
          media_type: input.media_type,
          title: input.title,
          url: input.url,
          source_page: input.source_page,
          thumbnail_url: input.thumbnail_url ?? null,
          metadata: input.metadata ?? {},
          is_public: isPublic,
          user_id: user.id,
        } as any])
        .select("id")
        .single();
      if (error) {
        console.warn("[saveToLibrary] insert failed", error.message, error);
        return null;
      }
      savedId = data?.id ?? null;
    }

    // Apply shop fields as a post-save update (RPC doesn't accept them)
    if (savedId && wantsShop) {
      const { error: updErr } = await supabase
        .from("user_media")
        .update({
          shop_enabled: true,
          shop_price_cents: input.shop_price_cents ?? 0,
          is_public: true,
        } as any)
        .eq("id", savedId);
      if (updErr) console.warn("[saveToLibrary] shop update failed", updErr.message);
    }

    try {
      window.dispatchEvent(new CustomEvent("library:updated", { detail: { id: savedId } }));
    } catch { /* noop */ }
    return savedId;
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
