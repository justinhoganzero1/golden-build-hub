import { describe, expect, it } from 'vitest';
import { reviewWorkcoverDemo } from './workcoverReview.js';

describe('WorkCover evidence checks', () => {
  const expense = { id: 'E1', kind: 'expense', provider: 'Demo Physio', invoice: 'INV1', cents: 8500, serviceDate: '2026-10-12', receipt: true };
  it('flags matching invoice details without treating an anomaly as proven fraud', () => {
    const result = reviewWorkcoverDemo([expense, { ...expense, id: 'E2' }], '2026-10-19');
    expect(result.map(r => r.id)).toEqual(['duplicate-E2']);
    expect(result[0].priority).toBe('Review');
  });
  it('does not flag a different invoice as a duplicate', () => {
    expect(reviewWorkcoverDemo([expense, { ...expense, id: 'E2', invoice: 'INV2' }], '2026-10-19')).toEqual([]);
  });
  it('flags an expired certificate but not one valid on the review date', () => {
    const records = [{ id: 'C1', kind: 'certificate', expires: '2026-10-18' }, { id: 'C2', kind: 'certificate', expires: '2026-10-19' }];
    expect(reviewWorkcoverDemo(records, '2026-10-19').map(r => r.id)).toEqual(['expired-C1']);
  });
  it('flags overdue open tasks but not completed tasks', () => {
    const records = [{ id: 'T1', kind: 'task', due: '2026-10-16', owner: 'Amy', status: 'waiting' }, { id: 'T2', kind: 'task', due: '2026-10-16', owner: 'Amy', status: 'done' }];
    expect(reviewWorkcoverDemo(records, '2026-10-19').map(r => r.id)).toEqual(['overdue-T1']);
  });
  it('missing documents request support rather than a fraud finding', () => {
    const result = reviewWorkcoverDemo([{ ...expense, receipt: false }], '2026-10-19');
    expect(result.map(r => r.id)).toEqual(['missing-E1']);
    expect(result[0].priority).toBe('Support');
  });
});