# Every member pays for their own usage — no free AI

## What's already in place
- Every sign-up gets their own account, their own wallet and their own usage history.
- Most paid features already charge the member's own wallet (your cost + 20%).

## Gaps found (these are what leak onto your bill)
1. **Free sign-up coins** — every new member is handed welcome coins, so they spend AI on your money. 18 of 19 wallets hold coins, most never paid.
2. **7-day free trial** — new accounts are treated as "trial" and get free AI calls.
3. **Features that never charge the member:** the shared AI tools service (used by Story Writer, Movie Studio, Marketing, Magic Hub, Assistant, App Builder, Living Avatar), voice listing / speech-to-text, the phone call and receptionist features, movie render worker, AI moderation, lead magnet, web outreach.
4. **Free-for-life / unlimited rewards** skip charging entirely.

## Changes
1. **No free coins at sign-up.** New members start at $0 and must top up before any paid feature works. Existing gifted welcome coins are removed (paid top-ups kept).
2. **Trial removed.** The "trial" tier is deleted; no free paid-AI calls.
3. **Charge on every paid feature** listed in gap 3 — each call is held against the member's wallet first, then settled at real cost + 20%. Empty wallet = the "Top up to continue" window, nothing runs.
4. **Free-for-life / unlimited rewards** stop bypassing charges (admin — you — stays exempt). Confirm below.
5. **Still free** (costs you nothing): browsing, Library, Diary, Calendar, Vault, Settings, Crisis Hub safety info, free slideshow preview, the free picture placement.
6. **Sign-up flow:** after joining, the member lands on the Wallet with "Add credit to start".

## Technical details
- Migration: `grant_signup_welcome` no longer credits; `resolve_ai_tier` drops `trial`; `has_unlimited_ai` → admin only.
- Data: reverse unpaid `signup_welcome_coins` grants from wallets.
- Edge functions: wrap listed functions with `getUserFromRequest` + `authorizeAI`/`settleAI`/`cancelAI`, returning 402 via `insufficientCoinsResponse`. Twilio webhooks bill the owning member of the receptionist/call.
- Update memory: trial/welcome-coin rules removed.

## Note
Your Lovable workspace still pays the providers upfront (that's how hosting works); the app recovers it from each member's wallet at cost + 20%, so every member funds their own usage.
