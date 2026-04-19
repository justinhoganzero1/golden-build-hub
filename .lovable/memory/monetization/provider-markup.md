---
name: Provider Cost Pass-Through + 5% Markup
description: Universal billing rule — every outside provider call (Runway, ElevenLabs, Replicate, Twilio) is passed through at provider_cost + 5% platform fee, on top of internal compute service markup
type: feature
---
## Rule
Every paid third-party service is billed to the user as:
**`provider_cost_cents + ceil(provider_cost_cents * 0.05)`** (always rounded UP to the next cent).

Helper lives in `supabase/functions/_shared/pricing.ts` → `markupCents()` + `PROVIDER_RATES`.

## Internal Compute
- Movie render service markup bumped from 50% → **60%** to cover Lovable AI + storage + bandwidth
- Twilio voice keeps its existing +50% markup via `wallet_charge_call` SQL function

## Movie Studio Tier Caps (`src/lib/moviePaywall.ts`)
| Tier        | Max length | HD  | Captions | 4K upscale | 1-click YouTube |
|-------------|-----------|-----|----------|------------|-----------------|
| Free        | 2 min     | ❌  | ❌       | ❌         | ❌              |
| Starter     | 5 min     | ❌  | ✅       | ❌         | ❌              |
| Full Access | 10 min    | ✅  | ✅       | ❌         | ❌              |
| Pro+        | 30 min    | ✅  | ✅       | ✅         | ✅              |
| Lifetime    | unlimited | ✅  | ✅       | ✅         | ✅              |
| Movie Studio one-time unlock ($1) | unlimited features (wallet still pays providers) |

Admins (`justinbretthogan@gmail.com`) bypass all caps.

## Enforcement Points
- `OracleMovieDirector` blocks duration buttons above tier
- `MovieStudioProPage` shows feature matrix card with upsell CTAs
- `movie-render-charge` edge function bills wallet at provider+5% + 60% internal markup
