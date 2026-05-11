import { supabase } from "@/integrations/supabase/client";

/**
 * Universal "save to user library" helper.
 *
 * Anything any app/user creates is funnelled through here so it lands in
 * `user_media` and shows up in My Library automatically.
 *
 * RESILIENCY: tries up to 50 times across three strategies (RPC →
 * direct insert → edge function) with exponential backoff before giving up.
 * Failed attempts are queued in localStorage and retried in the background.
 */
export type LibraryMediaType = "text" | "image" | "video" | "audio" | "app" | "document" | "gif";

export interface SaveToLibraryInput {
  media_type: LibraryMediaType;
  title: string;
  url: string;
  source_page: string;
  thumbnail_url?: string;
  metadata?: Record<string, unknown>;
  is_public?: boolean;
  shop_enabled?: boolean;
  shop_price_cents?: number;
}

const MAX_ATTEMPTS = 50;
const QUEUE_KEY = "oracle-lunar-library-save-queue-v1";

function loadQueue(): SaveToLibraryInput[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function persistQueue(items: SaveToLibraryInput[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-50))); } catch { /* ignore */ }
}
function enqueue(input: SaveToLibraryInput) {
  const q = loadQueue();
  q.push(input);
  persistQueue(q);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function trySaveOnce(
  input: SaveToLibraryInput,
  isPublic: boolean,
  strategy: "rpc" | "insert" | "edge",
): Promise<string | null> {
  if (strategy === "rpc") {
    const { data, error } = await (supabase as any).rpc("save_library_item", {
      _media_type: input.media_type,
      _title: input.title,
      _url: input.url,
      _source_page: input.source_page,
      _thumbnail_url: input.thumbnail_url ?? null,
      _metadata: input.metadata ?? {},
      _is_public: isPublic,
    });
    if (error) throw new Error(`rpc:${error.message}`);
    return (data as string) || null;
  }

  if (strategy === "insert") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("not_authenticated");
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
    if (error) throw new Error(`insert:${error.message}`);
    return data?.id ?? null;
  }

  // edge fallback — last-resort, uses a service-role edge function
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("not_authenticated");
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-library-item`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ ...input, is_public: isPublic }),
  });
  if (!r.ok) throw new Error(`edge:HTTP ${r.status}`);
  const j = await r.json().catch(() => ({}));
  return j?.id ?? null;
}

export async function saveToLibrary(input: SaveToLibraryInput): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn("[saveToLibrary] queued — user not signed in");
      enqueue(input);
      return null;
    }

    const wantsShop = !!input.shop_enabled && (input.shop_price_cents ?? 0) > 0;
    const isPublic = !!input.is_public || wantsShop;

    let savedId: string | null = null;
    let lastErr: any = null;

    // Rotate strategies across up to MAX_ATTEMPTS retries.
    const strategies: Array<"rpc" | "insert" | "edge"> = ["rpc", "insert", "edge"];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const strategy = strategies[(attempt - 1) % strategies.length];
      try {
        savedId = await trySaveOnce(input, isPublic, strategy);
        if (savedId) break;
      } catch (e: any) {
        lastErr = e;
        // Don't keep hammering on auth failures — queue for later.
        if (/not_authenticated/.test(String(e?.message))) {
          enqueue(input);
          return null;
        }
      }
      // Exponential backoff capped at 4s.
      await sleep(Math.min(150 * Math.pow(1.4, attempt), 4000));
    }

    if (!savedId) {
      console.warn("[saveToLibrary] all 50 attempts failed — queued for background retry", lastErr?.message);
      enqueue(input);
      return null;
    }

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
    enqueue(input);
    return null;
  }
}

/**
 * Background drain: re-attempt every queued save. Called automatically when
 * the app starts and whenever the user signs in or comes back online.
 */
export async function drainLibraryQueue(): Promise<void> {
  const queue = loadQueue();
  if (queue.length === 0) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const remaining: SaveToLibraryInput[] = [];
  for (const item of queue) {
    const id = await saveToLibrary(item).catch(() => null);
    if (!id) remaining.push(item);
  }
  persistQueue(remaining);
}

if (typeof window !== "undefined") {
  // Drain on auth + network events.
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void drainLibraryQueue();
    });
    window.addEventListener("online", () => void drainLibraryQueue());
    setTimeout(() => void drainLibraryQueue(), 2500);
  } catch { /* noop */ }
}

/**
 * Convenience: persist an Oracle (or any AI agent) text turn as a note.
 */
export function saveOracleTextTurn(opts: {
  userMessage: string;
  assistantMessage: string;
  oracleName: string;
  source?: string;
}) {
  const ans = (opts.assistantMessage || "").trim();
  if (ans.length < 12) return;
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
