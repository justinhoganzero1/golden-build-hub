// Centralized pricing & markup helpers.
// RULE: every external paid provider call (Runway, ElevenLabs, Replicate, OpenAI, Twilio, etc.)
// is passed through to the user at provider_cost + PLATFORM_MARKUP (currently 5%).
// Internal compute (Gemini via Lovable AI) follows the broader Movie Studio pricing schedule.
//
// Use markupCents() in any edge function that bills the user wallet for a third-party call.

// Bumped from 5% → 25% to fully cover ALL provider costs:
//   • Lovable AI compute (Gemini, GPT, image gen) bundled into every flow
//   • ElevenLabs voice / SFX / music
//   • HeyGen avatar video
//   • Runway image-to-video
//   • Replicate upscaling
//   • Twilio voice (in addition to its own +50% in wallet_charge_call)
//   • GitHub Actions / Codemagic build minutes
//   • Supabase storage + bandwidth + edge function invocations
//   • Stripe payment processing fees on top-ups
// Anything we forgot is absorbed by this single buffer.
export const PLATFORM_MARKUP_PCT = 0.25;
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
  // Runway image-to-video Gen-3 Turbo: ~$0.05 per second
  runway_image_to_video_per_second: 5,

  // ElevenLabs
  elevenlabs_tts_per_1000_chars: 30,
  elevenlabs_sfx_per_clip: 8,
  elevenlabs_music_per_30s: 30,
  elevenlabs_voice_clone_flat: 100,

  // HeyGen avatar video: ~$0.50/min on Creator plan
  heygen_avatar_per_minute: 50,
  heygen_photo_avatar_flat: 25,

  // Replicate upscaling
  replicate_upscale_4x: 2,
  replicate_upscale_8x: 4,

  // Twilio (also +50% in wallet_charge_call)
  twilio_voice_per_min_inbound: 1,
  twilio_voice_per_min_outbound: 2,
  twilio_sms_per_segment: 1,

  // Lovable AI Gateway — bill at least 1¢ per call so we never go negative
  lovable_ai_gemini_flash_per_call: 1,
  lovable_ai_gemini_pro_per_call: 3,
  lovable_ai_gpt5_per_call: 5,
  lovable_ai_image_gen_per_image: 4,
  lovable_ai_image_pro_per_image: 8,

  // Infra passthrough
  github_actions_per_build_minute: 1,
  storage_per_gb_month: 2,
  bandwidth_per_gb: 9,
  stripe_topup_overhead_pct: 3, // 2.9% + 30¢ — applied at top-up
} as const;
