// Lightweight audio analytics — stores events in localStorage so the Owner
// Dashboard chart can render without a backend round-trip. Events are also
// best-effort logged to console for debugging.
export type AudioEvent =
  | "permission_requested"
  | "permission_granted"
  | "permission_denied"
  | "recording_started"
  | "recording_stopped"
  | "playback_click"
  | "playback_ended"
  | "device_enumerated";

const STORAGE_KEY = "oraclelunar.audio_events.v1";
const MAX_EVENTS = 500;

interface StoredEvent {
  type: AudioEvent;
  ts: number;
  meta?: Record<string, unknown>;
}

export function trackAudioEvent(type: AudioEvent, meta?: Record<string, unknown>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: StoredEvent[] = raw ? JSON.parse(raw) : [];
    list.push({ type, ts: Date.now(), meta });
    if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[audioAnalytics] failed to persist", e);
  }
}

export function readAudioEvents(): StoredEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function summarizeAudioEvents() {
  const events = readAudioEvents();
  const counts: Record<AudioEvent, number> = {
    permission_requested: 0,
    permission_granted: 0,
    permission_denied: 0,
    recording_started: 0,
    recording_stopped: 0,
    playback_click: 0,
    playback_ended: 0,
    device_enumerated: 0,
  };
  for (const e of events) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return { total: events.length, counts, events };
}

export function clearAudioEvents(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
