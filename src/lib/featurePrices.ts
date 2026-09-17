// What each feature costs the user, in plain language.
// Mirrors supabase/functions/_shared/pricing.ts: provider cost + a 20% margin.

export const PLATFORM_MARKUP_PCT = 0.2;
export const COINS_PER_DOLLAR = 5.37;

/** Provider cost in cents -> what the user is actually charged, in cents. */
export function chargedCents(providerCents: number): number {
  const provider = Math.max(1, Math.ceil(providerCents));
  const fee = Math.max(1, Math.ceil(provider * PLATFORM_MARKUP_PCT));
  return provider + fee;
}

export function centsToCoins(cents: number): number {
  return (cents / 100) * COINS_PER_DOLLAR;
}

export interface FeaturePrice {
  feature: string;
  unit: string;
  providerCents: number;
  group: "Talk & write" | "Pictures" | "Voice & music" | "Video & movies";
}

export const FEATURE_PRICES: FeaturePrice[] = [
  { group: "Talk & write", feature: "Oracle chat message", unit: "per message", providerCents: 1 },
  { group: "Talk & write", feature: "Deep research / smart answers", unit: "per answer", providerCents: 3 },
  { group: "Talk & write", feature: "Story or script writing (top model)", unit: "per request", providerCents: 5 },
  { group: "Talk & write", feature: "Live vision (camera look)", unit: "per look", providerCents: 1 },

  { group: "Pictures", feature: "Image generation", unit: "per image", providerCents: 4 },
  { group: "Pictures", feature: "High-detail image / book cover", unit: "per image", providerCents: 8 },
  { group: "Pictures", feature: "Upscale to 4x", unit: "per image", providerCents: 2 },
  { group: "Pictures", feature: "Upscale to 8x", unit: "per image", providerCents: 4 },

  { group: "Voice & music", feature: "Narration / text to speech", unit: "per 1,000 characters", providerCents: 30 },
  { group: "Voice & music", feature: "Sound effect", unit: "per clip", providerCents: 8 },
  { group: "Voice & music", feature: "Music", unit: "per 30 seconds", providerCents: 30 },
  { group: "Voice & music", feature: "Clone your own voice", unit: "one-off", providerCents: 100 },

  { group: "Video & movies", feature: "Image to video", unit: "per second", providerCents: 5 },
  { group: "Video & movies", feature: "AI video generation", unit: "per second", providerCents: 20 },
  { group: "Video & movies", feature: "Talking presenter video", unit: "per minute", providerCents: 50 },
  { group: "Video & movies", feature: "Final movie render", unit: "per second of finished film", providerCents: 5 },
];

export const FEATURE_GROUPS = [
  "Talk & write",
  "Pictures",
  "Voice & music",
  "Video & movies",
] as const;
