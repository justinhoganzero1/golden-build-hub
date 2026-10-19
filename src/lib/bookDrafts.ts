/** IndexedDB keeps large illustrated manuscripts out of the small localStorage quota. */
const DB = "oracle-member-drafts";
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