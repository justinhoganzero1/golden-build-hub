# State-of-the-Art Per-User AI Billing

## Goal
Replace estimated, fragmented charging with one server-enforced metering platform where every authenticated user has an isolated account, every paid AI/provider operation is attributable to that user, and the final charge is actual provider cost plus a 10% platform markup.

## Architecture
```text
Signed-in user
  -> authenticated AI operation
  -> idempotent usage request
  -> wallet preauthorization hold
  -> provider execution
  -> measured usage / provider receipt
  -> actual-cost settlement (+10%)
  -> immutable ledger + user receipt
  -> reconciliation / automatic refund of unused hold
```

## Build
1. **Create a double-entry billing ledger**
   - Add immutable per-user billing accounts, usage requests, wallet holds, and ledger entries.
   - Store provider, model, modality, units, estimated cost, actual cost, 10% fee, status, idempotency key, provider request ID, and timestamps.
   - Keep wallet balance as a locked projection of posted ledger entries; prevent direct client mutation.

2. **Implement reserve, settle, cancel, and refund operations**
   - Atomically reserve the maximum expected amount before provider work begins.
   - Settle from actual tokens, characters, seconds, images, video duration, calls, storage, or provider-reported cost.
   - Release unused funds automatically; compensate failed/cancelled calls; make retries idempotent.
   - Remove unlimited/admin/free bypasses from provider-cost accounting. Promotional access must be funded as a separate credit ledger, never hide real cost.

3. **Centralize provider metering**
   - Replace the current `chargeAI` estimate-only helper with a shared metered operation wrapper.
   - Add a versioned server-side rate-card registry with effective dates and cost formulas.
   - Route every paid AI/provider function through the wrapper, including chat, agents, image, speech, music, video, movie, research, cloning, telephony, and worker paths.
   - Reject unauthenticated paid operations and never trust a client-supplied user ID, cost, provider, model, or completion status.

4. **Harden Stripe wallet funding**
   - Bind one Stripe customer to one authenticated account.
   - Use fixed server-approved top-up packs and same-origin production redirects.
   - Process signed webhooks exactly once using event/session/payment-intent uniqueness.
   - Post top-ups, disputes, refunds, and chargebacks to the ledger; never credit from metadata alone without confirming payment state and amount.

5. **Give each user modern spend controls**
   - Show available, held, and spent balances separately.
   - Add daily/monthly budgets, low-balance alerts, hard stops, auto top-up controls, and per-service usage receipts.
   - Show actual provider cost, 10% platform fee, final total, status, and request ID for every operation.

6. **Add owner FinOps and reconciliation**
   - Add aggregate margin, provider liability, held funds, failed settlements, negative balances, and unreconciled usage.
   - Reconcile ledger totals against provider usage and Stripe events; alert on missing, duplicate, or margin-below-10% records.

7. **Test and rollout safely**
   - Add concurrency, replay, insufficient-funds, failed-provider, partial-stream, webhook duplication, refund, spoofed-user, and exact-markup tests.
   - Inventory all provider call sites and enforce a CI test that fails when a paid provider call lacks metering.
   - Backfill opening ledger balances, run the new engine in shadow mode, compare totals, then switch charging atomically.

## Technical Rules
- Currency accounting uses integer minor units with higher-precision internal cost units where sub-cent provider pricing requires it; round only at settlement boundaries.
- The 10% fee is `ceil(actual_provider_cost × 0.10)` at the configured precision; the user pays provider cost plus fee.
- Every mutation uses a unique idempotency key and database transaction with row locking.
- Provider failures never become completed charges; streamed partial usage settles only measured consumption.
- BYOK usage is still logged per user, but provider cost is marked externally paid and only an explicitly disclosed platform fee may be charged.
- Existing promotional/free-for-life promises remain visible as funded promotional credits while actual provider costs remain auditable.

## Acceptance Criteria
- 100% of paid provider routes require an authenticated user and produce one attributable usage record.
- No origin, role, grant, client flag, or retry can bypass metering or duplicate a charge.
- Successful operations settle to actual measured cost plus exactly 10%; failed operations release holds.
- Stripe replay cannot double-credit; refunds and disputes reverse the correct user's funds.
- Each user can view only their own wallet, holds, usage, and receipts; owner reporting is server-authorized.
- Automated tests prove isolation, atomicity, idempotency, margin, refunds, and complete provider-route coverage.
