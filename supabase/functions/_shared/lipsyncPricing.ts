// Lip-sync pricing for the YouTube newsroom host (pure, tested by Vitest).
// Provider: Replicate prunaai/p-video-avatar, billed per second of output video:
// 720p US$0.025/s, 1080p US$0.045/s (replicate.com/prunaai/p-video-avatar, checked 2026-11-20).
// Members pay that provider cost converted to AUD, plus the standard 20% margin
// (also enforced by billing_authorize/billing_settle in the database).

export const LIPSYNC_MODEL = "prunaai/p-video-avatar";
export type LipsyncResolution = "720p" | "1080p";
export const LIPSYNC_USD_PER_SECOND: Record<LipsyncResolution, number> = { "720p": 0.025, "1080p": 0.045 };
/** Used only when the live exchange rate can't be fetched; deliberately on the high side. */
export const FALLBACK_AUD_PER_USD = 1.6;
export const LIPSYNC_MAX_SECONDS = 180;
export const LIPSYNC_MARGIN = 0.2;

export interface LipsyncQuote {
  seconds: number;
  resolution: LipsyncResolution;
  usd_per_second: number;
  aud_per_usd: number;
  provider_cost_cents: number;
  platform_fee_cents: number;
  total_cents: number;
}

/** Provider cost in AUD cents (rounded up to the cent) plus the 20% margin (rounded up). */
export function quoteLipsync(seconds: number, resolution: LipsyncResolution, audPerUsd: number): LipsyncQuote {
  const s = Math.max(0, Number(seconds) || 0);
  const usd = LIPSYNC_USD_PER_SECOND[resolution] ?? LIPSYNC_USD_PER_SECOND["720p"];
  const fx = audPerUsd > 0 ? audPerUsd : FALLBACK_AUD_PER_USD;
  // Work in hundredths of a cent first so float noise never adds a whole cent.
  const provider = Math.max(1, Math.ceil(Math.round(s * usd * fx * 10000) / 100));
  const fee = Math.max(1, Math.ceil(provider * LIPSYNC_MARGIN));
  return { seconds: s, resolution, usd_per_second: usd, aud_per_usd: fx, provider_cost_cents: provider, platform_fee_cents: fee, total_cents: provider + fee };
}

/** Reads the movie length from an MP4's mvhd box, or null when it can't be found. */
export function mp4DurationSeconds(bytes: Uint8Array): number | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 4; i + 32 < bytes.length; i++) {
    if (bytes[i] === 0x6d && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) {
      const d = i + 4;
      const version = bytes[d];
      if (version === 1) {
        const timescale = dv.getUint32(d + 20);
        const duration = Number(dv.getBigUint64(d + 24));
        return timescale ? duration / timescale : null;
      }
      const timescale = dv.getUint32(d + 12);
      const duration = dv.getUint32(d + 16);
      return timescale ? duration / timescale : null;
    }
  }
  return null;
}

/** Storage paths must sit inside the member's own folder. */
export function ownsPath(userId: string, path: unknown): path is string {
  return typeof path === "string" && path.startsWith(`${userId}/`) && !path.includes("..") && path.length < 300;
}
