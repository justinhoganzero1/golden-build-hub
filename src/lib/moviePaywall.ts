// Movie Studio + Oracle Director paywall rules.
// Tiers cap movie length, scene count, and feature access. Admins + Lifetime bypass everything.
// Wallet billing on top still applies (provider+5%, see supabase/functions/_shared/pricing.ts).

export interface MovieTierLimits {
  /** Max movie duration in minutes the user can ASK Oracle for. */
  maxDurationMin: number;
  /** Whether HD 1080p export is allowed without a paywall prompt. */
  allowHD: boolean;
  /** Whether captions burn-in is allowed without a paywall prompt. */
  allowCaptions: boolean;
  /** Whether 4K/8K Replicate upscale is unlocked. */
  allowUpscale4K: boolean;
  /** Whether one-click YouTube OAuth upload is unlocked (vs download bundle only). */
  allowYouTubeOAuth: boolean;
  /** Display label for upsells. */
  label: string;
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  monthly: 2,
  quarterly: 3,
  biannual: 4,
  annual: 5,
  golden: 6,
  lifetime: 7,
};

export function getMovieLimits(tier: string, isAdmin = false, ownsMovieStudio = false): MovieTierLimits {
  if (isAdmin || ownsMovieStudio || TIER_RANK[tier] >= 6) {
    return {
      maxDurationMin: 30,
      allowHD: true,
      allowCaptions: true,
      allowUpscale4K: true,
      allowYouTubeOAuth: true,
      label: ownsMovieStudio ? "Movie Studio Lifetime" : "Unlimited",
    };
  }
  const rank = TIER_RANK[tier] ?? 0;
  if (rank >= 3) {
    return {
      maxDurationMin: 30,
      allowHD: true,
      allowCaptions: true,
      allowUpscale4K: true,
      allowYouTubeOAuth: true,
      label: "Pro / Quarterly+",
    };
  }
  if (rank >= 2) {
    return {
      maxDurationMin: 10,
      allowHD: true,
      allowCaptions: true,
      allowUpscale4K: false,
      allowYouTubeOAuth: false,
      label: "Full Access",
    };
  }
  if (rank >= 1) {
    return {
      maxDurationMin: 5,
      allowHD: false,
      allowCaptions: true,
      allowUpscale4K: false,
      allowYouTubeOAuth: false,
      label: "Starter",
    };
  }
  // Free
  return {
    maxDurationMin: 2,
    allowHD: false,
    allowCaptions: false,
    allowUpscale4K: false,
    allowYouTubeOAuth: false,
    label: "Free",
  };
}

/** Minimum tier required to unlock a given duration. Used for upsell copy. */
export function tierRequiredForDuration(min: number): string {
  if (min <= 2) return "free";
  if (min <= 5) return "starter";
  if (min <= 10) return "monthly";
  return "quarterly";
}

export const TIER_UPSELL_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter ($5/mo)",
  monthly: "Full Access ($10/mo)",
  quarterly: "Pro ($20)",
  biannual: "6-Month ($40)",
  annual: "12-Month ($80)",
  golden: "Golden Heart ($1,200/yr)",
  lifetime: "Lifetime Unlock ($900)",
};
