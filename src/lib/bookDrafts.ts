/** IndexedDB keeps large illustrated manuscripts out of the small localStorage quota. */
const DB = "oracle-member-drafts";
type DraftBook = { title?: string; premise?: string; chapters?: { content?: string; images?: string[] }[]; coverImage?: string; backImage?: string };
export function hasBookDraftContent(book: DraftBook): boolean {
  return !!(book.title?.trim() || book.premise?.trim() || book.coverImage || book.backImage ||
    book.chapters?.some(chapter => chapter.content?.trim() || chapter.images?.length));
}
/** Ignore absent/empty optional fields and object key order from the account loader. */
export function sameBookDraft(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([key, entry]) => key !== "id" && entry !== undefined && entry !== "" && entry !== false && !(Array.isArray(entry) && !entry.length))
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, normalize(entry)]));
    return value;
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("books");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveBookDraft(userId: string, bookId: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("books", "readwrite");
      tx.objectStore("books").put({ value, savedAt: Date.now() }, `${userId}:${bookId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Draft save interrupted"));
    });
  } finally { db.close(); }
}
export async function loadBookDraft<T>(userId: string, bookId: string): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const req = db.transaction("books").objectStore("books").get(`${userId}:${bookId}`);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}