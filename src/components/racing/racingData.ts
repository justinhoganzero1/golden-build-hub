import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ENGINE_INFO: Array<{ id: string; n: string; name: string; job: string }> = [
  { id: "discovery", n: "1", name: "Global Race Discovery", job: "Finds races worldwide from licensed racing data." },
  { id: "historical", n: "2", name: "Historical Performance", job: "Studies every past run, opposition quality and conditions." },
  { id: "paddock_vision", n: "3", name: "Live Paddock Vision", job: "Watches authorised parade-ring footage for movement and behaviour." },
  { id: "environment", n: "4", name: "Environmental Intelligence", job: "Weather and track conditions at each racecourse." },
  { id: "dynamics", n: "5", name: "Jockey, Trainer & Race Dynamics", job: "Jockeys, trainers, breeding, barriers and expected pace." },
  { id: "race_vision", n: "6", name: "Live Race Vision", job: "Tracks horses through authorised race footage (post-race learning only)." },
  { id: "training_vision", n: "7", name: "Training Footage", job: "Trackwork, trials and gallops for each horse's movement profile." },
  { id: "master", n: "★", name: "Oracle Master Controller", job: "Scores, selects and schedules races, combines engines, locks predictions." },
];

export const STATUS_LABEL: Record<string, string> = {
  running: "Running",
  succeeded: "Working",
  failed: "Error",
  awaiting_configuration: "Awaiting configuration",
  waiting_for_data: "Waiting for data",
  skipped: "Skipped",
  connected: "Connected",
  ready: "Ready",
  error: "Error",
  awaiting_first_run: "Not run yet",
  credentials_saved: "Keys saved",
  credentials_saved_adapter_pending: "Keys saved — connection still to be built",
};

export function statusTone(s?: string | null): "ok" | "wait" | "bad" | "idle" {
  if (!s) return "idle";
  if (["succeeded", "connected", "ready", "credentials_saved"].includes(s)) return "ok";
  if (["failed", "error"].includes(s)) return "bad";
  if (s === "running") return "ok";
  return "wait";
}

export async function callController(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("racing-controller", { body: payload });
  if (error) {
    let detail = error.message;
    try { detail = await (error as any).context?.text?.() || detail; } catch { /* keep message */ }
    throw new Error(detail);
  }
  return data as any;
}

export function useControllerStatus() {
  return useQuery({
    queryKey: ["racing-status"],
    queryFn: () => callController({ action: "status" }),
    refetchInterval: 30_000,
  });
}

export function useRacingTable<T = any>(key: string, fn: () => PromiseLike<{ data: T[] | null; error: any }>, deps: unknown[] = []) {
  return useQuery({
    queryKey: ["racing", key, ...deps],
    queryFn: async () => {
      const { data, error } = await fn();
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 20_000,
  });
}

export function useRacingRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: ["racing"] }); qc.invalidateQueries({ queryKey: ["racing-status"] }); };
}

export function formatInZone(iso: string | null | undefined, tz: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  if (!iso) return "—";
  try { return new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: tz }).format(new Date(iso)); }
  catch { return new Date(iso).toLocaleString(); }
}

export function countdown(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "Started";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} m`;
  return `${Math.floor(h / 24)} days`;
}

export function ago(iso?: string | null) {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
