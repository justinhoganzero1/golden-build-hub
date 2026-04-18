import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Site content cache + realtime subscription.
 * Components read editable text/images via getContent(page, slot, fallback).
 * Admin edits update the DB and broadcast to all clients instantly.
 */
type Row = { page: string; slot: string; value: string; kind: string };
const cache = new Map<string, string>(); // key = `${page}::${slot}`
const listeners = new Set<() => void>();

const key = (page: string, slot: string) => `${page}::${slot}`;

let loaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadAll() {
  if (loaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const { data } = await supabase.from("site_content").select("page,slot,value,kind");
    (data as Row[] | null)?.forEach((r) => cache.set(key(r.page, r.slot), r.value));
    loaded = true;
    listeners.forEach((l) => l());
  })();
  return loadingPromise;
}

// Realtime updates
let channelStarted = false;
function startRealtime() {
  if (channelStarted) return;
  channelStarted = true;
  supabase
    .channel("site_content_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "site_content" },
      (payload: any) => {
        const row = (payload.new || payload.old) as Row;
        if (!row) return;
        if (payload.eventType === "DELETE") {
          cache.delete(key(row.page, row.slot));
        } else {
          cache.set(key(row.page, row.slot), row.value);
        }
        listeners.forEach((l) => l());
      }
    )
    .subscribe();
}

export function useSiteContent() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    loadAll();
    startRealtime();
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return {
    get: (page: string, slot: string, fallback: string) =>
      cache.get(key(page, slot)) ?? fallback,
    isLoaded: loaded,
  };
}

export async function saveContent(
  page: string,
  slot: string,
  value: string,
  kind: "text" | "image" | "url" | "number" | "boolean" = "text"
) {
  const { error } = await supabase
    .from("site_content")
    .upsert({ page, slot, value, kind }, { onConflict: "page,slot" });
  if (error) throw error;
  cache.set(key(page, slot), value);
  listeners.forEach((l) => l());
}

export async function deleteContent(page: string, slot: string) {
  await supabase.from("site_content").delete().eq("page", page).eq("slot", slot);
  cache.delete(key(page, slot));
  listeners.forEach((l) => l());
}

export async function fetchAllContent() {
  const { data } = await supabase
    .from("site_content")
    .select("*")
    .order("page", { ascending: true })
    .order("slot", { ascending: true });
  return data || [];
}
