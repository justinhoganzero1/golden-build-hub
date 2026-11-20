import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Call the Oracle News controller and surface its real error message. */
export async function callNews<T = any>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("news-controller", { body: { action, ...extra } });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try { const j = await error.context.json(); msg = j?.error || j?.message || msg; } catch { /* keep message */ }
    }
    throw new Error(typeof msg === "string" ? msg : "The news room couldn't finish that.");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/** Plain-language summary of a controller reply for the owner. */
export function describeResult(action: string, r: any): string {
  if (!r) return "Done.";
  if (r.busy) return "Another news job is already running. Try again in a few minutes.";
  if (r.skipped) return r.note ?? "Nothing to do.";
  switch (action) {
    case "scan": return `Checked ${r.scanned} sources (${r.ok} worked). ${r.added} new headlines, ${r.new_stories} new stories, ${r.updated_stories} updated.${r.breaking?.length ? ` Breaking: ${r.breaking.join("; ")}` : ""}`;
    case "daily_open": return `Today's news scan is done${r.scan ? `: ${r.scan.added ?? 0} new headlines, ${r.scan.new_stories ?? 0} new stories` : ""}. Oracle now knows today's news.`;
    case "check_sources": return `${r.ok} of ${r.checked} sources answered.`;
    case "analyse": return r.note ?? `Analysed ${r.analysed} stories and read ${r.article_texts_read} article pages.`;
    case "find_footage": return r.note ?? `Checked ${r.stories} stories: ${r.nasa} NASA clips saved, ${r.youtube} embeddable videos found. ${(r.notes ?? []).join(" ")}`;
    case "generate_script": return `Script written: ${r.stories} stories, about ${Math.round((r.seconds ?? 0) / 60)} min.${r.shorter_than_requested ? " Shorter than asked — not enough verified stories, nothing was padded." : ""}`;
    case "approve": return "Approved. Press Produce Broadcast to film it in the newsroom studio.";
    case "publish": return "Published. Members can now watch it under Oracle News past editions.";
    case "unpublish": return "Taken down. Members can no longer see it.";
    case "delete_broadcast": return "Broadcast deleted.";
    case "set_rights": return "Footage rights saved.";
    case "add_footage": return "Added to the footage register.";
    case "add_source": return "Source added. It will be checked on the next scan.";
    case "save_settings": return "Settings saved.";
    default: return "Done.";
  }
}
