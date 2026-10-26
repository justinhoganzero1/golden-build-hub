import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Executable database security checks run in the browser integration workflow;
// these tests preserve the concrete manager/worker policy contract in the project.
const sql = readFileSync('drizzle/migrations/0013_reimagined_worker_accounts.sql', 'utf8');
it('worker access is limited to the assigned claim and enabled account', () => {
  expect(sql).toContain('assigned_claim_id=_claim_id');
  expect(sql).toContain('user_id=auth.uid() AND enabled');
});
it('worker messages require the authenticated sender and assigned-claim access', () => {
  expect(sql).toContain('sender_id=auth.uid() AND public.reimagined_can_access_claim(claim_id)');
});
it('workers cannot update a plan; only protected managers may do that', () => {
  const policy = sql.split('CREATE POLICY "Demo managers update worker plan"')[1]?.split('CREATE TABLE')[0];
  expect(policy).toContain("account_kind='manager'");
  expect(policy).not.toContain("account_kind='worker'");
});