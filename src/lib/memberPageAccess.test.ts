import { expect, it } from 'vitest';
import { memberPageAccess } from './memberPageAccess';
const member = { signedIn: true, owner: false, active: true, founder: true, monthly: false, path: '/oracle' };
it('requires sign-in even for preview query links', () => {
  expect(memberPageAccess({ ...member, signedIn: false, path: '/oracle?preview=1' })).toBe('sign-in');
});
it('allows lifetime members the Oracle, Story Writer and Library', () => {
  for (const path of ['/oracle', '/story-writer', '/media-library']) expect(memberPageAccess({ ...member, path })).toBe('allow');
});
it('requires lifetime members to upgrade for paid studio pages', () => {
  for (const path of ['/movie-studio-pro', '/photography-hub', '/app-builder']) expect(memberPageAccess({ ...member, path })).toBe('upgrade');
});
it('allows active monthly members and the owner full page access', () => {
  expect(memberPageAccess({ ...member, monthly: true, path: '/app-builder' })).toBe('allow');
  expect(memberPageAccess({ ...member, owner: true, active: false, path: '/app-builder' })).toBe('allow');
});
it('keeps wallet available but locks features for inactive members', () => {
  expect(memberPageAccess({ ...member, active: false, path: '/wallet' })).toBe('allow');
  expect(memberPageAccess({ ...member, active: false })).toBe('upgrade');
});