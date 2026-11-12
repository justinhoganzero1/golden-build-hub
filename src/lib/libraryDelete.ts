import { supabase } from "@/integrations/supabase/client";

type LibraryRow = { id: string; user_id?: string | null };

/**
 * Bulk delete only ever touches the signed-in member's own creations, even when
 * the owner is viewing members' work, so nobody wipes someone else's Library.
 */
export function ownSelectedIds(items: LibraryRow[], selected: Iterable<string>, userId: string | null | undefined): string[] {
  if (!userId) return [];
  const wanted = new Set(selected);
  return items.filter((m) => wanted.has(m.id) && m.user_id === userId).map((m) => m.id);
}

/** Every own item in the current view — used by "Select all". */
export function ownItemIds(items: LibraryRow[], userId: string | null | undefined): string[] {
  if (!userId) return [];
  return items.filter((m) => m.user_id === userId).map((m) => m.id);
}

/**
 * Removes Library entries only. Files stay in storage because the same file can
 * still be used by Movie Maker, templates or other saved projects.
 */
export async function deleteLibraryRows(ids: string[], userId: string): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error, count } = await supabase
      .from("user_media")
      .delete({ count: "exact" })
      .in("id", chunk)
      .eq("user_id", userId);
    if (error) throw error;
    deleted += count ?? chunk.length;
  }
  return deleted;
}
