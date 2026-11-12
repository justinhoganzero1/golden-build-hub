import { pagePlan, planAllows, type PlanId } from './plans';

export type PageAccess = 'sign-in' | 'allow' | 'upgrade';

/** Decides whether a signed-in member's plan opens a page. */
export function memberPageAccess(input: { signedIn: boolean; plan: PlanId; path: string }): PageAccess {
  if (!input.signedIn) return 'sign-in';
  return planAllows(input.plan, pagePlan(input.path)) ? 'allow' : 'upgrade';
}
