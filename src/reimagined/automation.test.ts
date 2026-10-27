import { describe, it, expect } from 'vitest';
import { freshWorkspace } from './model';
import { prepareCaseload, saveCaseloadPreparation, syntheticCaseload } from './automation';

describe('whole-caseload preparation', () => {
  it.each([500, 1000] as const)('checks %i isolated fictional claims without replacing saved records', size => {
    const w = freshWorkspace();
    const result = prepareCaseload(syntheticCaseload(size, w));
    expect(result).toHaveLength(size);
    expect(new Set(result.map(i => i.claim.id)).size).toBe(size);
    expect(w.claims).toHaveLength(5);
  });
  it('excludes closed claims and retains medical/payment decisions and bookings', () => {
    const w = freshWorkspace(); const items = prepareCaseload(w);
    expect(items.map(i => i.claim.id)).not.toContain('RI-0977');
    expect(items).toHaveLength(4);
    const saved = saveCaseloadPreparation(w, items);
    expect(saved.claims).toEqual(w.claims);
    expect(saved.paymentReviews).toEqual(w.paymentReviews);
    expect(saved.bookings).toEqual(w.bookings);
    expect(saved.drafts).toHaveLength(4);
  });
  it('deduplicates repeated preparation and saves only selected claims', () => {
    const w = freshWorkspace(); const selected = prepareCaseload(w).filter(i => i.claim.id === 'RI-1031');
    const saved = saveCaseloadPreparation(w, selected);
    expect(saved.tasks).toHaveLength(w.tasks.length + 1);
    expect(saved.drafts.map(d => d.claimId)).toEqual(['RI-1031']);
    expect(saveCaseloadPreparation(saved, selected)).toEqual(saved);
  });
  it('rejects work above 1000 claims', () => {
    const w = syntheticCaseload(1000, freshWorkspace());
    w.claims.push({ ...w.claims[0], id: 'extra' });
    expect(() => prepareCaseload(w)).toThrow('at most 1,000');
  });
});