// When to nudge a paying member to top up their wallet before paid AI stops.
export const LOW_BALANCE_CENTS = 100; // A$1 left
export const REMIND_EVERY_MS = 24 * 60 * 60 * 1000; // at most once a day

export function shouldRemindLowBalance(balanceCents: number, lastShownAt: number | null, now: number): boolean {
  if (!Number.isFinite(balanceCents) || balanceCents >= LOW_BALANCE_CENTS) return false;
  return lastShownAt === null || now - lastShownAt >= REMIND_EVERY_MS;
}
