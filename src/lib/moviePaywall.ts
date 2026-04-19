// Movie Studio paywall rules — slideshow edition.
// The renderer is now a Ken Burns slideshow (still images + AI narration).
// So 4K/8K upscale promises were dropped. Two honest tiers: SD 720p / HD 1080p.
// Free users get exactly ONE 8-second clip, lifetime. Everything after = paywall.

export interface MovieTierLimits {
  /** Max movie duration in MINUTES. Free users only get 8 SECONDS, expressed below as `freeClipSeconds`. */
  maxDurationMin: number;
  /** Free tier clip length in seconds (used when on free tier and no paid unlock). */
  freeClipSeconds: number;
  /** How many free clips this account is ever allowed (lifetime, not per-month). */
  freeClipQuota: number;
  allowHD: boolean;
  allowCaptions: boolean;
  allowYouTubeOAuth: boolean;
  allowLongForm: boolean; // 5+ min films
  label: string;
}

const TIER_RANK: Record<string, number> = {
  free: 0, starter: 1, monthly: 2, quarterly: 3,
  biannual: 4, annual: 5, golden: 6, lifetime: 7,
};

export function getMovieLimits(tier: string, isAdmin = false, ownsMovieStudio = false): MovieTierLimits {
  if (isAdmin || TIER_RANK[tier] >= 7) {
    return {
      maxDurationMin: 60,
      freeClipSeconds: 8, freeClipQuota: 9999,
      allowHD: true, allowCaptions: true,
      allowYouTubeOAuth: true, allowLongForm: true,
      label: isAdmin ? "Admin Unlimited" : "Lifetime Ultimate",
    };
  }
  if (ownsMovieStudio || TIER_RANK[tier] >= 6) {
    return {
      maxDurationMin: 30,
      freeClipSeconds: 8, freeClipQuota: 9999,
      allowHD: true, allowCaptions: true,
      allowYouTubeOAuth: true, allowLongForm: true,
      label: ownsMovieStudio ? "Movie Studio Lifetime" : "Golden Heart",
    };
  }
  const rank = TIER_RANK[tier] ?? 0;
  if (rank >= 3) return {
    maxDurationMin: 15, freeClipSeconds: 8, freeClipQuota: 9999,
    allowHD: true, allowCaptions: true,
    allowYouTubeOAuth: true, allowLongForm: true, label: "Pro / Quarterly+",
  };
  if (rank >= 2) return {
    maxDurationMin: 5, freeClipSeconds: 8, freeClipQuota: 9999,
    allowHD: true, allowCaptions: true,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Full Access",
  };
  if (rank >= 1) return {
    maxDurationMin: 2, freeClipSeconds: 8, freeClipQuota: 9999,
    allowHD: false, allowCaptions: true,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Starter",
  };
  // FREE — exactly one 8-second clip, ever.
  return {
    maxDurationMin: 0, // no minute-based films at all
    freeClipSeconds: 8, freeClipQuota: 1,
    allowHD: false, allowCaptions: true,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Free",
  };
}

/** Returns the lowest tier that supports a given duration in minutes. */
export function tierRequiredForDuration(min: number): string {
  if (min <= 0.15) return "free";   // ≤ 8 seconds
  if (min <= 2)   return "starter";
  if (min <= 5)   return "monthly";
  if (min <= 15)  return "quarterly";
  if (min <= 30)  return "golden";
  return "lifetime";
}

export const TIER_UPSELL_LABEL: Record<string, string> = {
  free: "Free", starter: "Starter ($5/mo)", monthly: "Full Access ($10/mo)",
  quarterly: "Pro ($20)", biannual: "6-Month ($40)", annual: "12-Month ($80)",
  golden: "Golden Heart ($1,200/yr)", lifetime: "Lifetime Ultimate ($900)",
};

// ============= QUALITY TIER PRICING =============
// Slideshow renderer = no real video gen. Two tiers only: SD 720p, HD 1080p.
export type RenderQualityTier = "sd" | "hd";

export interface QualityTierPricing {
  key: RenderQualityTier;
  label: string;
  resolution: string;
  pricePerMinCents: number;
  description: string;
  badge?: string;
  premium?: boolean;
}

export const QUALITY_TIERS: QualityTierPricing[] = [
  {
    key: "sd",
    label: "Standard",
    resolution: "720p",
    pricePerMinCents: 50, // $0.50/min
    description: "Ken Burns pan/zoom slideshow with AI narration. Fast and social-ready.",
  },
  {
    key: "hd",
    label: "HD Cinema",
    resolution: "1080p",
    pricePerMinCents: 200, // $2/min
    description: "1080p Ken Burns slideshow with cinematic narration mix and burn-in captions.",
    badge: "Most popular",
  },
];

export function getQualityTier(key: RenderQualityTier): QualityTierPricing {
  return QUALITY_TIERS.find(t => t.key === key) ?? QUALITY_TIERS[1];
}

/** Estimate total cost for a movie. Includes the 5% provider markup. */
export function estimateMovieCostCents(durationMin: number, quality: RenderQualityTier): number {
  const tier = getQualityTier(quality);
  return Math.ceil(durationMin * tier.pricePerMinCents);
}

/** Cost of the free 8-second clip in cents (always $0 for the user — covered by us). */
export const FREE_CLIP_SECONDS = 8;
