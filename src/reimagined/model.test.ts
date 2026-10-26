import { expect, it } from 'vitest';
import { freshWorkspace, preparedReply, evidenceFor, isReimaginedEntry } from './model';
it('prepared examples do not claim to execute payments or communications', () => {
  const w = freshWorkspace();
  expect(preparedReply('transfer payment', w.claims[0], w)).toContain('No bank transfer');
  expect(preparedReply('draft email', w.claims[0], w)).toContain('has not been sent');
});
it('evidence flags are concrete discrepancies for human review', () => {
  const w = freshWorkspace();
  expect(evidenceFor(w.claims[0])).toHaveLength(2);
  expect(evidenceFor(w.claims[0])[0].detail).toContain('1–14 October');
  expect(evidenceFor(w.claims[3])[0].title).toBe('Missing capacity certificate');
});
it('fresh IT workspace has fictional records and no paid actions', () => {
  const w = freshWorkspace();
  expect(w.claims).toHaveLength(5);
  expect(w.paymentReviews).toEqual([]);
  expect(w.tasks.filter(t => !t.done)).toHaveLength(3);
});
it('standalone entry uses exact domain matching, not arbitrary host substrings', () => {
  expect(isReimaginedEntry('reimagined.online', '/oracle')).toBe(true);
  expect(isReimaginedEntry('www.reimagined.online', '/')).toBe(true);
  expect(isReimaginedEntry('fake-reimagined.example', '/oracle')).toBe(false);
  expect(isReimaginedEntry('oraclelunar.com', '/oracle')).toBe(false);
  expect(isReimaginedEntry('localhost', '/reimagined-it')).toBe(true);
});import { contacts, records, prepareContactDraft } from './records';
import { workspaceSchema } from './model';
it('contact drafts are never sent and older saved workspaces still load', () => {
  const w = freshWorkspace();
  const doc = contacts.find(c => c.claimId === 'RI-1031' && c.role === 'Doctor')!;
  const text = prepareContactDraft(doc, w.claims[0], records.filter(r => r.claimId === 'RI-1031'));
  expect(text).toContain('not sent');
  expect(text).toContain('Expired 14 Oct');
  const { drafts, ...old } = w; void drafts;
  expect(workspaceSchema.parse(old).drafts).toEqual([]);
});
