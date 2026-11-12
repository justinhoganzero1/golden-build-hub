import { describe, expect, it } from 'vitest';
import { PLANS, priceIdFor, resolvePlan, yearlySavingAud, pagePlan, planAllows } from './plans';

describe('plan prices', () => {
  it('Plus is A$9.99 a month or A$99.90 a year', () => {
    expect(PLANS.plus.monthlyAud).toBe(9.99);
    expect(PLANS.plus.yearlyAud).toBe(99.9);
  });
  it('Pro is A$24.99 a month or A$249.90 a year', () => {
    expect(PLANS.pro.monthlyAud).toBe(24.99);
    expect(PLANS.pro.yearlyAud).toBe(249.9);
  });
  it('yearly billing gives two months free', () => {
    expect(yearlySavingAud('plus')).toBeCloseTo(PLANS.plus.monthlyAud * 2, 2);
    expect(yearlySavingAud('pro')).toBeCloseTo(PLANS.pro.monthlyAud * 2, 2);
  });
  it('maps plans to the checkout price ids', () => {
    expect(priceIdFor('plus', 'month')).toBe('plus_monthly');
    expect(priceIdFor('pro', 'year')).toBe('pro_yearly');
  });
});

describe('included monthly AI credit', () => {
  it('Plus includes about A$3 and Pro about A$10 of wallet credit', () => {
    expect(PLANS.plus.monthlyCreditCents).toBe(200);
    expect(PLANS.pro.monthlyCreditCents).toBe(650);
  });
});

describe('who is on which plan', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  it('new accounts are Free (no trial)', () => {
    expect(resolvePlan({ plan: 'free' }, false)).toBe('free');
  });
  it('an expired paid plan falls back to Free', () => {
    expect(resolvePlan({ plan: 'pro', plan_active_until: past }, false)).toBe('free');
  });
  it('A$1 Founders get Plus-level access', () => {
    expect(resolvePlan({ plan: 'free', founder_number: 7 }, false)).toBe('founder');
    expect(planAllows('founder', 'plus')).toBe(true);
    expect(planAllows('founder', 'pro')).toBe(false);
  });
  it('a Founder who buys Pro gets Pro', () => {
    expect(resolvePlan({ plan: 'pro', plan_active_until: future, founder_number: 7 }, false)).toBe('pro');
  });
  it('the owner is exempt from everything', () => {
    expect(resolvePlan(null, true)).toBe('owner');
    expect(planAllows('owner', 'pro')).toBe(true);
  });
});

describe('page tiers', () => {
  it('video and build tools are Pro, creative tools Plus, safety Free', () => {
    expect(pagePlan('/movie-studio-pro')).toBe('pro');
    expect(pagePlan('/app-builder/new')).toBe('pro');
    expect(pagePlan('/story-writer')).toBe('plus');
    expect(pagePlan('/crisis-hub')).toBe('free');
  });
});
