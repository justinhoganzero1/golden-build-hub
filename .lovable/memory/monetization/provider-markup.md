---
name: Provider Cost Pass-Through + 25% Markup
description: Universal billing rule — every provider call (Lovable AI, ElevenLabs, HeyGen, Runway, Replicate, Twilio, GitHub Actions, Stripe, Supabase storage/bandwidth) is billed at provider_cost + 25% platform fee
type: feature
---
## Rule
Every paid service (internal Lovable AI compute + external providers + infra) is billed as:
**`provider_cost_cents + ceil(provider_cost_cents * 0.25)`** (rounded UP).

Helper: `supabase/functions/_shared/pricing.ts` → `markupCents()` + `PROVIDER_RATES`.

## Why 25% (bumped from 5%)
Single buffer covers EVERYTHING the platform pays for:
- Lovable AI Gateway (Gemini, GPT, image gen)
- ElevenLabs voice / SFX / music / clones
- HeyGen avatar video
- Runway, Replicate, Twilio
- GitHub Actions / Codemagic build minutes
- Supabase storage + bandwidth + edge invocations
- Stripe processing fees on top-ups

## Free preview limit
`PHOTO_TRIAL_LIMIT = 1` (was 6). One free generation per user across the photo flow, then wallet pays.

## Movie Studio caps unchanged — see existing tier matrix in `src/lib/moviePaywall.ts`.
