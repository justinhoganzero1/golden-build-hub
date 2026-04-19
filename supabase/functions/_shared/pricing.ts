// Centralized pricing & markup helpers.
// RULE: every external paid provider call (Runway, ElevenLabs, Replicate, OpenAI, Twilio, etc.)
// is passed through to the user at provider_cost + PLATFORM_MARKUP (currently 5%).
// Internal compute (Gemini via Lovable AI) follows the broader Movie Studio pricing schedule.
//
// Use markupCents() in any edge function that bills the user wallet for a third-party call.

export const PLATFORM_MARKUP_PCT = 0.05; // +5% on every outside provider charge
export const MIN_BILLABLE_CENTS = 1;     // never bill 0

export interface MarkedUp {
  provider_cost_cents: number;
  platform_fee_cents: number;
  total_cents: number;
}

/**
 * Apply the standard +5% platform markup to a third-party provider cost.
 * Always rounds the platform fee UP to the nearest cent so we never lose money.
 */
export function markupCents(provider_cost_cents: number): MarkedUp {
  const provider = Math.max(MIN_BILLABLE_CENTS, Math.ceil(provider_cost_cents));
  const fee = Math.max(MIN_BILLABLE_CENTS, Math.ceil(provider * PLATFORM_MARKUP_PCT));
  return {
    provider_cost_cents: provider,
    platform_fee_cents: fee,
    total_cents: provider + fee,
  };
}

// ---------------- Provider rate cards (in cents) ----------------
// These are conservative estimates — adjust as real invoices come in.
// All values are PROVIDER cost. The +5% markup is added on top automatically.
export const PROVIDER_RATES = {
  // Runway image-to-video Gen-3 Turbo: ~$0.05 per second of generated video
  runway_image_to_video_per_second: 5,

  // ElevenLabs TTS: ~$0.30 per 1000 characters on Creator plan
  elevenlabs_tts_per_1000_chars: 30,

  // ElevenLabs SFX: ~$0.08 per generation (avg 4s clip)
  elevenlabs_sfx_per_clip: 8,

  // ElevenLabs Music: ~$0.30 per 30s of music
  elevenlabs_music_per_30s: 30,

  // Replicate Real-ESRGAN: ~$0.012 per upscale (4x). 8x runs twice.
  replicate_upscale_4x: 2,
  replicate_upscale_8x: 4,

  // Twilio voice (already handled in wallet_charge_call helper at +50%, kept for reference)
  twilio_voice_per_min_inbound: 1,
  twilio_voice_per_min_outbound: 2,

  // Lovable AI Gemini Flash (for movie director, oracle): roughly $0.0003 per call — too small to bill individually
  // Bundled into the Movie Studio render fee instead.
} as const;
