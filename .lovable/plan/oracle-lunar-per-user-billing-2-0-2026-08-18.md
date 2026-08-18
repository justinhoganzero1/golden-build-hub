# Oracle Lunar Per-User Billing 2.0

## Expert verdict
Three independent reviews—a principal fintech architect, an adversarial payments reviewer, and an AI FinOps architect—rejected the current implementation for production approval.

Key blockers:
- Many paid AI/provider routes do not debit a user's wallet at all.
- Stripe webhook retries can credit the same top-up more than once.
- Movie rendering uses a race-prone manual balance update outside the billing engine.
- Most charges are estimates, not actual tokens, characters, seconds, images, or provider cost.
- Failed work can remain charged because there is no universal hold, settlement, cancellation, and refund lifecycle.
- “Unlimited” and admin paths hide real economic cost from reporting.
- Provider pricing and markup rules are duplicated and inconsistent.

## Target experience
Every signed-in member receives an isolated billing account. Every paid operation follows one auditable lifecycle:

```text
Authenticated user
  -> unique usage request
  -> server-calculated quote
  -> wallet hold
  -> provider execution
  -> actual usage measurement
  -> settlement at provider cost + 10%
  -> unused hold released
  -> immutable receipt and ledger entry
```

A provider failure cancels the hold. A partial streamed result settles only measured usage. A retry cannot charge twice. Promotional access uses separately funded promotional credits—it never erases real provider costs.

## Implementation

### 1. Stop current revenue and wallet integrity leaks
- Make Stripe top-ups exactly-once using unique Stripe event, checkout session, and payment-intent identifiers in one atomic credit operation.
- Replace movie rendering's manual balance update with the central transactional billing engine.
- Add server-approved minimum/maximum top-up packs; ignore client-supplied prices and user IDs.
- Record and alert on unhandled completed Stripe sessions.
- Confirm wallet-mutating database functions cannot be called by anonymous or normal client roles.

### 2. Introduce an immutable financial ledger
- Add per-user billing accounts, usage requests, wallet holds, ledger entries, refunds, and reconciliation records.
- Use integer minor units plus micro-unit precision for sub-cent provider costs; round only during settlement.
- Make ledger records append-only, including against accidental privileged updates; corrections use compensating entries.
- Backfill each current wallet balance as a signed opening-balance entry.

### 3. Add transactional reserve, settle, cancel, and refund operations
- `authorize`: lock the user's account and reserve a server-calculated maximum before work starts.
- `settle`: apply actual provider cost plus `ceil(actual cost × 10%)`, post the ledger entries, and release unused funds atomically.
- `cancel`: release the full hold when no paid work is delivered.
- `refund`: post a traceable credit linked to the original charge; never rewrite history.
- Give every operation a unique idempotency key and terminal status.

### 4. Meter actual provider usage
- Build provider adapters for tokens, characters, generated images, audio seconds, video seconds, call minutes, SMS segments, compute time, storage, and bandwidth.
- Store provider, model, modality, input/output units, provider request ID, estimate, actual cost, fee, total, and variance.
- Use a versioned server-side rate registry with effective dates when a provider does not return per-request cost.
- Reconcile those estimates against provider usage/invoices and automatically true-up or refund differences.

### 5. Route every paid function through one billing wrapper
- Cover chat, multi-agent fallback, coding, research, tutoring, moderation, image generation, voice, transcription, cloning, music, video, movies, living GIFs, telephony, web crawling, autonomous builds, storage, and bandwidth.
- Require server-validated identity for every paid path; never accept identity, cost, provider, model, or completion status from the client.
- Treat BYOK as externally paid usage: still meter and attribute it, but do not charge provider cost to the Oracle Lunar wallet unless a separately disclosed platform fee applies.
- Add a repository test that fails whenever a provider call exists without the billing wrapper.

### 6. Preserve truthful promotion and owner accounting
- Remove admin/unlimited exemptions from cost accounting.
- Represent trials, rewards, and lifetime benefits as funded promotional credits so provider expense remains visible.
- Replace hardcoded owner-email billing authorization with server-side role checks.
- Alert on unusual promotional-credit issuance and spend velocity.

### 7. Harden Stripe funding and reversals
- Bind one Stripe customer record to one authenticated billing account.
- Credit wallets only after verified paid status and server-matched amount/currency.
- Handle completed checkout, successful/failed payment, refund, dispute, and chargeback events.
- Reverse the correct user's funds through compensating ledger entries and flag unresolved negative balances.

### 8. Add user spend controls and receipts
- Wallet displays available, held, promotional, and spent balances separately.
- Add daily/monthly budgets, hard stops, low-balance alerts, and optional auto top-up.
- Every receipt shows service/model, measured units, actual provider cost, 10% fee, final total, status, and request ID.
- Users can view only their own billing data.

### 9. Add owner FinOps and reconciliation
- Show provider liability, revenue, exact margin, open holds, failed settlements, refunds, disputes, negative balances, and unreconciled usage.
- Compare metered totals with provider invoices and Stripe funding.
- Alert on duplicate events, missing settlements, stale holds, cost variance, and any effective margin below 10%.

### 10. Roll out without risking existing balances
1. Add the ledger and actual-usage recording in shadow mode with no billing change.
2. Migrate Stripe top-ups and expensive video/movie paths first.
3. Compare old and new totals and resolve variance.
4. Migrate all remaining provider routes.
5. Atomically make the new ledger authoritative while preserving compatibility views.

## Required automated proof
- Parallel requests cannot overspend one wallet.
- Replayed client requests and Stripe events cannot double-charge or double-credit.
- Spoofed user IDs, costs, plans, models, and completion states are rejected.
- Failed operations release holds; partial operations settle measured usage only.
- Refunds, disputes, and chargebacks reverse the correct account exactly once.
- Every successful paid operation creates one attributable usage record and balanced ledger transaction.
- Provider cost plus fee equals the settled total, with an effective 10% markup at the defined precision.
- Ledger totals reconstruct every wallet balance and reconcile with Stripe/provider totals.
- Every paid provider route is covered by the metering-enforcement test.

## Thumbs-up gate
The specialists recommend approval only after all tests above pass, 100% of paid routes are covered, Stripe replay is proven idempotent, provider failures are proven non-chargeable, and reconciliation reports no unexplained balance drift.
