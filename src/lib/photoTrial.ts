// Hard 6-image free trial gate for the Photography Hub.
// Counter is per-user (or per-device for anon) and stored in localStorage.
// Admins always bypass.

export const PHOTO_TRIAL_LIMIT = 1;

const keyFor = (userId?: string | null) =>
  `oraclelunar.photoTrial.count.${userId || "anon"}`;

export function getPhotoTrialCount(userId?: string | null): number {
  try {
    const v = localStorage.getItem(keyFor(userId));
    return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
  } catch { return 0; }
}

export function incrementPhotoTrial(userId?: string | null): number {
  const next = getPhotoTrialCount(userId) + 1;
  try { localStorage.setItem(keyFor(userId), String(next)); } catch {}
  return next;
}

export function getPhotoTrialRemaining(userId?: string | null): number {
  return Math.max(0, PHOTO_TRIAL_LIMIT - getPhotoTrialCount(userId));
}

export function hasPhotoTrialRemaining(userId?: string | null): boolean {
  return getPhotoTrialRemaining(userId) > 0;
}
