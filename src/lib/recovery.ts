export type Recovery = { message: string; automaticReplay: false; action: "sign-in" | "top-up" | "wait" | "review" };
/** Paid or ambiguous operations are never replayed by a generic recovery layer. */
export function recoveryFor(status?: number): Recovery {
  if (status === 401) return { message: "Please sign in again. Your draft is kept on this device.", automaticReplay: false, action: "sign-in" };
  if (status === 402) return { message: "Credits are needed before continuing. Your draft is kept.", automaticReplay: false, action: "top-up" };
  if (status === 403) return { message: "This action is not permitted. No automatic retry was made.", automaticReplay: false, action: "review" };
  if (status === 429) return { message: "The service is busy. Please wait before trying again.", automaticReplay: false, action: "wait" };
  return { message: "The result could not be confirmed. Check the saved result or payment history before trying again.", automaticReplay: false, action: "review" };
}

export function draftKey(userId: string, scope: string): string {
  return `oracle.recovery:${userId}:${scope}`;
}
export function readDraft<T>(userId: string, scope: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, scope));
    return raw ? JSON.parse(raw).value as T : null;
  } catch { return null; }
}
export function writeDraft(userId: string, scope: string, value: unknown): boolean {
  try {
    localStorage.setItem(draftKey(userId, scope), JSON.stringify({ value, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}