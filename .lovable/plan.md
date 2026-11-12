# New Oracle Lunar pay structure

Replaces the old 3-day trial and single A$19.99 plan. No one has paid for a plan yet (26 trial accounts, 0 paying members, 0 founders), so nobody loses anything.

## The plans

| | Free | Plus | Pro | Founder (A$1 once) |
|---|---|---|---|---|
| Price | A$0 | A$9.99/mo or A$99.90/yr | A$24.99/mo or A$249.90/yr | A$1 lifetime, 500 seats |
| AI credit included every month | none | A$3 | A$10 | none (top up wallet) |
| Features | Only things that cost nothing to run | Everything except heavy video/build tools | Everything | Same as Plus, for life |

- Yearly = 2 months free.
- Included credit lands in the member's wallet each paid month. When it runs out they top up as now (cost + 20%, unchanged).
- Founders get Plus features forever but no free monthly credit (A$1 cannot cover AI costs; keeps the "no subsidised users" rule).
- Owner stays exempt from everything.

### What each tier unlocks
- **Free:** Home, Oracle's free welcome and guided intro, Calendar & Diary, Library (own files), Book Reader, Crisis Hub and all safety pages, Free Zone, Creator Shop browsing and buying, Wallet, Profile, Settings, Founder pages.
- **Plus:** Full Oracle chat with her premium voice, outfits and look builder, Story Writer and Author tools, Photography Hub and image tools, music and sound effects, Mind Hub and AI Tutor, Oracle Videos library, Agent chats, speech-to-text.
- **Pro:** Movie Studio, Video Editor, YouTube Studio and AI video, App Builder and Oracle coder, Live Vision, Voice Receptionist and phone calls, voice cloning, upscaling.

Free members tapping a locked tool see a clear upgrade card that names the plan needed, with monthly and yearly prices.

## What gets done
1. Create the Plus and Pro products in payments (monthly + yearly prices). Keep the A$1 Founder seat as is; retire the old A$19.99 monthly price from sale.
2. Swap the old trial and paywall checks for one plan system: Free / Plus / Pro / Founder / Owner.
3. Rebuild the Membership page as a clean 3-column pricing page with a Monthly/Yearly switch, plus a "Manage plan" button (cancel, change card, invoices).
4. Lock tools on the dashboard by plan with a small Plus/Pro badge instead of the old trial lock.
5. Oracle for Free members: free scripted welcome stays; typing a real question shows a friendly "Upgrade to Plus to chat with me" card.
6. Server-side safety: every paid AI action checks the member's plan before charging, so locked tools can't be used by going around the app.
7. Monthly credit is added automatically after each successful payment, never twice for the same invoice.
8. Upgrades and downgrades switch immediately with fair part-month charges; cancelling keeps access until the end of the paid period.
9. Tests for prices, which tier unlocks what, credit amounts, and the server plan check.

## Kept as is
Wallet top-ups, 20% margin floor, Creator Shop 80/20 split, Founder seat resale, the Reimagined demo (separate, untouched).

## Technical details
- New `plan` resolver in the database (`member_plan(user)` → free/plus/pro/founder/owner) based on `memberships` + `subscriptions` rows; `is_active_member` keeps working (true for plus/pro/founder/owner) so existing member-only data rules don't break.
- `billing_authorize` gains a plan check by service name: Free blocked; Pro-only list (movie_*, runway_*, replicate_upscale, youtube-host-show, script-to-scenes, app-builder-*, oracle-coder, phone-call, voice-receptionist-*, live-vision, elevenlabs-clone-voice, video gen). Returns a `plan_required` error the app turns into the upgrade card.
- Payments webhook: subscription events set plan + period end; `invoice.paid` grants the monthly credit idempotently (keyed by invoice id); yearly plans grant monthly via a scheduled job keyed by user + month.
- Frontend: one `usePlan` hook and one route→tier map replacing `memberPageAccess` trial/founder logic; old `PaywallGate` repointed to the new map.
- Customer portal edge function for "Manage plan".
