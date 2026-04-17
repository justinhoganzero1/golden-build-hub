# SOLACE — Google Play Store Readiness Checklist

Last updated: tracked alongside code changes.

This document tracks compliance for an Android (Capacitor) submission of SOLACE
to the Google Play Store. Use it during pre-submission QA.

---

## 1. Content Rating (IARC questionnaire)

| Area | Answer | Notes |
|---|---|---|
| Violence | Mild fantasy / cartoon only | Movie Studio scenes can depict combat at PG-13 level. No gore. |
| Sexual content | None in default mode | Adult Companion/Avatar uses owner-only bypass; M-rated default for all users. |
| Profanity | Mild | TTS sanitisation strips most explicit language. |
| Drugs / alcohol | Reference only | Educational POS Learn may reference; no glamorisation. |
| Gambling | None | No real-money wagering anywhere. |
| User-generated content | YES | Movie Studio, Photography Hub, Story Writer, Comments. **Moderation enforced — see §3.** |
| Online interactions | YES | Oracle chat, Companion, multi-agent. |
| Personal info shared | YES | Diary, Calendar, Wallet, Health. **All RLS-protected — see §6.** |
| In-app purchases | YES | Stripe subscriptions ($5–$50 tiers). |

**Target rating:** Teen (13+) for default features; Mature (17+) tier locked behind owner-only bypass.

---

## 2. Permissions Justification

| Permission | Why we need it | Runtime explanation shown |
|---|---|---|
| `CAMERA` | Live Vision real-time analysis, profile photo capture | "SOLACE uses your camera only when you tap Live Vision or take a photo." |
| `RECORD_AUDIO` | Oracle voice input, voice cloning | "SOLACE uses your microphone only while you're talking to Oracle." |
| `INTERNET` | All AI features | Standard. |
| `ACCESS_FINE_LOCATION` | Oracle navigation (Google Maps deep links) | "Optional. Used only when you ask Oracle for directions." |
| `BLUETOOTH_*` | Wearables sync | "Optional. Only when you connect a fitness tracker." |
| `POST_NOTIFICATIONS` | Calendar reminders, special occasions | "Optional. You can disable in Settings." |

**No background location, no SMS reading, no contacts, no phone state.**

---

## 3. User-Generated Content moderation

All prompt surfaces use the shared filter at `src/lib/contentSafety.ts`:

- **Tier 1 (absolute, no bypass):** CSAM, bestiality, self-harm instructions,
  bomb-making, terror recruitment.
- **Tier 2 (M-rated, owner bypass):** explicit sexual terms.

Surfaces enforcing this filter:

- [x] Movie Studio — script, scene prompts, music prompts, narration
- [x] Photography Hub — generate + edit modes
- [x] Profile / Avatar Generator
- [x] Story Writer
- [x] App Builder
- [x] Companion (M-rated only with owner bypass)
- [x] Oracle chat (server-side via `oracle-chat` system prompt)
- [x] Comments (`creator_comments` table — AI moderation pipeline)
- [x] Image-gen edge function (server-side belt-and-braces)

**Server-side enforcement** is the source of truth. Client-side checks are UX
sugar; the edge function will reject blocked prompts even if the client sends
them.

---

## 4. Data Safety form (Play Console)

| Data type | Collected? | Shared with 3rd parties? | Required? | Purpose |
|---|---|---|---|---|
| Email | Yes | No | Yes | Account |
| Name | Yes (optional) | No | No | Personalisation |
| Photos | Yes | No | No | Avatar, Photography Hub |
| Voice/audio | Yes (transient) | ElevenLabs (TTS only) | No | Oracle voice |
| Camera frames | Transient | Lovable AI (analysis) | No | Live Vision — not stored |
| Health/fitness | Optional | No | No | Wearables module |
| Financial info | Stripe-tokenised only | Stripe | No | Subscriptions |
| Location | Transient | No (Google Maps deep link) | No | Navigation |
| Diary/calendar | Yes | No | No | Personal use |

**No data sold. No data used for ads.** Encryption in transit (TLS) and at rest (Supabase managed).

---

## 5. Subscriptions & Payments

- All recurring billing via Stripe Checkout.
- Cancellation handled via Stripe Customer Portal — link surfaced in `SubscribePage.tsx`.
- No dark patterns: prices clearly shown, free tier always available.
- Refund policy linked from `TermsOfServicePage.tsx`.

> **Note:** Google Play prefers Google Play Billing for digital goods consumed
> inside the app. SOLACE positions paid features as access to a web service
> (Oracle, Live Vision, Movie Studio) — eligible for the "service" carve-out.
> If Play rejects, fall back to Google Play Billing via Capacitor plugin.

---

## 6. Security / Privacy

- Supabase RLS on every user-owned table (verified: see migration files).
- `user_roles` separate table — no role columns on profiles. Prevents
  privilege-escalation attacks.
- API keys never stored in client. All third-party calls proxied through
  Supabase Edge Functions.
- Privacy Policy: `/privacy-policy` (must be reachable from Play Store listing).
- Terms of Service: `/terms-of-service`.

---

## 7. Native build hardening (capacitor.config.ts)

- [x] `server.url` removed (not a "thin wrapper")
- [x] `cleartext: false`
- [x] `allowMixedContent: false`
- [x] `webContentsDebuggingEnabled: false`
- [x] App ID: `app.solace.ai`

---

## 8. Pre-submission QA

- [ ] Run `bun run build` — no errors
- [ ] Open `npx cap sync android` — clean
- [ ] Generate signed AAB
- [ ] Run on physical device (not just emulator) — verify all permissions prompt correctly
- [ ] Test offline mode (`OfflineBanner` shows)
- [ ] Test deep links (`/oracle`, `/photography-hub`, etc.)
- [ ] Verify no console errors in Chrome DevTools while inspecting WebView
- [ ] Verify Stripe checkout opens external browser, not in-app webview
