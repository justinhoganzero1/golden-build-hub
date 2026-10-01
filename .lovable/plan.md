# Founding Members, 3-Day Trial and $19.99 Membership

## What members will see
1. **Front page bubble** (light-blue background, white text, styled like the Submit button): "Become a Founding Member — only 500 seats — X left". Tapping it opens sign-up directly.
2. **Sign-up** → a **3-day free trial** starts automatically. During the trial members can use everything that costs you nothing (writing, diary, calendar, library, settings). AI, voices, images and video are still paid from their own wallet credit, as now.
3. **After 3 days** every feature is locked behind a membership screen with two choices:
   - **Founding Member** (while seats last): one **$1 AUD** payment → free membership for life, a numbered seat (#1–500), and a founder-only feature.
   - **Regular Membership**: **$19.99 AUD a month**, cancel any time.
4. Once seat #500 is taken, the bubble and founder option disappear for good.

## Founder-only perks (made up as requested)
- Numbered gold **Founder seat badge** shown on their profile and in the Public Library / Creators Shop.
- **Founder's Vault**: an exclusive gold Oracle theme and voice, plus first access to every new module before anyone else.
- Membership free for life (they still pay their own AI credit — your margin rule stays).

## Selling a seat
- A founder can transfer their seat to another member from their profile. The buyer becomes the founder and gets the number, badge and perks. The seller loses them all and moves to regular membership.
- Payment between the two people happens through the app's existing Creators Shop payout system (70/30 split applies).
- **Terms & Conditions** section added: seats are transferable, limited to 500, and perks are a membership feature only.

**Important:** the terms will **not** promise the seat will go up in value. Selling something as "it will rise when the app goes viral" can count as selling an investment, and that needs a financial licence in Australia. The seat can still be resold. We just won't advertise it as an investment.

## The real $1 test
After this is built, you sign up with a second email, tap the bubble, and pay $1 with your own card. I then confirm the seat (#1), the money in Stripe, and the unlocked app.

## Your account
You stay exempt from everything, as now.

---

## Technical details
- New `memberships` table (user_id, kind: trial|founder|monthly, founder_number unique 1–500, trial_ends_at, status, stripe ids). Grants + RLS (owner reads own row; writes via service role only).
- `handle_new_user` trigger inserts trial row (now()+3 days).
- `claim_founder_seat()` security-definer function: lock + assign next number, refuse past 500.
- `public_founder_seats_left()` for the bubble (anon-safe count only).
- Stripe (existing secret key): create product "Founding Member" $1 AUD one-time and "Oracle Lunar Membership" $19.99 AUD monthly. New `create-membership-checkout` and `verify-membership` functions (session-id verification, idempotent, same pattern as `verify-coin-topup`).
- `MembershipGate` wraps member routes in App.tsx: allow if admin, active trial, founder, or active monthly; else show paywall screen.
- `transfer-founder-seat` function: seller initiates, buyer accepts, number moves atomically, audit logged.
- Update project memory: trial exception (3 days, no-cost features only) replaces the "no trial" rule.
