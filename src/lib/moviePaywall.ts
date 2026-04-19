// Movie Studio + Oracle Director paywall rules.
// Tiers cap movie length, scene count, and feature access. Admins + Lifetime bypass everything.
// Wallet billing on top still applies (provider+5%, see supabase/functions/_shared/pricing.ts).

export interface MovieTierLimits {
  maxDurationMin: number;
  allowHD: boolean;
  allowCaptions: boolean;
  allowUpscale4K: boolean;
  allow8KUltimate: boolean;
  allowYouTubeOAuth: boolean;
  allowLongForm: boolean; // 30+ min films
  label: string;
}

const TIER_RANK: Record<string, number> = {
  free: 0, starter: 1, monthly: 2, quarterly: 3,
  biannual: 4, annual: 5, golden: 6, lifetime: 7,
};

export function getMovieLimits(tier: string, isAdmin = false, ownsMovieStudio = false): MovieTierLimits {
  if (isAdmin || TIER_RANK[tier] >= 7) {
    return {
      maxDurationMin: 120,
      allowHD: true, allowCaptions: true, allowUpscale4K: true,
      allow8KUltimate: true, allowYouTubeOAuth: true, allowLongForm: true,
      label: isAdmin ? "Admin Unlimited" : "Lifetime Ultimate",
    };
  }
  if (ownsMovieStudio || TIER_RANK[tier] >= 6) {
    return {
      maxDurationMin: 60,
      allowHD: true, allowCaptions: true, allowUpscale4K: true,
      allow8KUltimate: false, allowYouTubeOAuth: true, allowLongForm: true,
      label: ownsMovieStudio ? "Movie Studio Lifetime" : "Golden Heart",
    };
  }
  const rank = TIER_RANK[tier] ?? 0;
  if (rank >= 3) return {
    maxDurationMin: 30, allowHD: true, allowCaptions: true,
    allowUpscale4K: true, allow8KUltimate: false,
    allowYouTubeOAuth: true, allowLongForm: false, label: "Pro / Quarterly+",
  };
  if (rank >= 2) return {
    maxDurationMin: 10, allowHD: true, allowCaptions: true,
    allowUpscale4K: false, allow8KUltimate: false,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Full Access",
  };
  if (rank >= 1) return {
    maxDurationMin: 5, allowHD: false, allowCaptions: true,
    allowUpscale4K: false, allow8KUltimate: false,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Starter",
  };
  return {
    maxDurationMin: 2, allowHD: false, allowCaptions: false,
    allowUpscale4K: false, allow8KUltimate: false,
    allowYouTubeOAuth: false, allowLongForm: false, label: "Free",
  };
}

export function tierRequiredForDuration(min: number): string {
  if (min <= 2) return "free";
  if (min <= 5) return "starter";
  if (min <= 10) return "monthly";
  if (min <= 30) return "quarterly";
  if (min <= 60) return "lifetime";
  return "lifetime"; // 60-120min = lifetime ultimate
}

export const TIER_UPSELL_LABEL: Record<string, string> = {
  free: "Free", starter: "Starter ($5/mo)", monthly: "Full Access ($10/mo)",
  quarterly: "Pro ($20)", biannual: "6-Month ($40)", annual: "12-Month ($80)",
  golden: "Golden Heart ($1,200/yr)", lifetime: "Lifetime Ultimate ($900)",
};

// ============= QUALITY TIER PRICING (per finished minute, in cents) =============
// All include +5% provider markup baked in. Two paths: "Standard" cheap, "ULTIMATE 8K" outrageous.
export type RenderQualityTier = "sd" | "hd" | "4k" | "8k_ultimate";

export interface QualityTierPricing {
  key: RenderQualityTier;
  label: string;
  resolution: string;
  pricePerMinCents: number;
  description: string;
  badge?: string;
  premium?: boolean;
  ultimate?: boolean;
}

export const QUALITY_TIERS: QualityTierPricing[] = [
  {
    key: "sd",
    label: "Standard",
    resolution: "720p",
    pricePerMinCents: 50, // $0.50/min
    description: "Fast, smooth, social-ready. Real-ESRGAN polish.",
  },
  {
    key: "hd",
    label: "HD Cinema",
    resolution: "1080p",
    pricePerMinCents: 200, // $2/min
    description: "Cinematic 1080p with audio mix and burn-in captions.",
    badge: "Most popular",
  },
  {
    key: "4k",
    label: "4K Pro",
    resolution: "3840×2160",
    pricePerMinCents: 800, // $8/min
    description: "Real-ESRGAN 4K upscale. Cinema-grade detail.",
    badge: "Premium",
    premium: true,
  },
  {
    key: "8k_ultimate",
    label: "🏆 ULTIMATE 8K",
    resolution: "7680×4320",
    pricePerMinCents: 5000, // $50/min — the outrageous one
    description: "Topaz Video AI 8K. Studio-grade. Reserved for Lifetime Ultimate. Up to 120 min.",
    badge: "ULTIMATE",
    premium: true,
    ultimate: true,
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
