// A random ID for this phone, computer or TV, kept in several browser stores so
// clearing one doesn't reset it. It is only used to stop a second free trial;
// installing the app on any number of devices is always allowed.
const KEY = "oracle-device-id";
const COOKIE = "ol_did";
const DB = "oracle-lunar-device";
let cached: string | null = null;

const valid = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9:_-]{8,128}$/.test(v);

function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

function idb<T>(fn: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const req = fn(open.result.transaction("kv", mode).objectStore("kv"));
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}

export async function getTrialDeviceId(): Promise<string | null> {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* blocked storage */ }
  if (!valid(id)) id = readCookie();
  if (!valid(id)) {
    const fromDb = await idb((s) => s.get(KEY) as IDBRequest<string>, "readonly");
    id = valid(fromDb) ? fromDb : null;
  }
  if (!valid(id)) id = `d_${crypto.randomUUID().replace(/-/g, "")}`;
  cached = id;
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  try { document.cookie = `${COOKIE}=${encodeURIComponent(id)}; max-age=${60 * 60 * 24 * 730}; path=/; SameSite=Lax`; } catch { /* ignore */ }
  void idb((s) => s.put(id, KEY), "readwrite");
  return id;
}
