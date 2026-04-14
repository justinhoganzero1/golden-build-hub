---
name: Aggressive Paywall System
description: App-wide paywall gates with tier-based access, lock badges on dashboard, and lifetime membership promo
type: feature
---
## Paywall Tiers (ascending access)
- **Free (tier 0)**: Oracle AI, Crisis Hub, Safety Center, Subscribe, Settings, Profile, Suggestions, Referral, Investor, Creators
- **Starter (tier 1)**: Mind Hub, Vault, Wallet, Media Library, Assistant, AI Tutor, Interpreter, Calendar, Alarm Clock, Diagnostics, Elderly Care, Avatar Gen, Family Hub, Magic Hub, Occasions, POS Learn
- **Monthly/Full Access (tier 2)**: AI Studio, Video Editor, Live Vision, Voice Studio, Photo Studio, Inventor, Pro Hub, Marketing, Companion
- **Quarterly/Pro (tier 3)**: App Builder
- **Golden Heart (tier 6)**: Everything unlimited

## Components
- `PaywallGate` component wraps page content; shows upgrade CTA with lifetime membership promo
- Dashboard tiles show lock badges for locked features; clicking shows toast with upgrade option
- Admin (justinbretthogan@gmail.com) bypasses all paywalls

## Oracle Promotion
- System prompt instructs Oracle to naturally promote FREE lifetime membership via Suggestion Box
- Mentioned at least once per conversation, especially when users hit paywalls
