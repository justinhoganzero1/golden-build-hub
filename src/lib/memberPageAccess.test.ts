import { expect, it } from 'vitest';
import { memberPageAccess } from './memberPageAccess';

it('requires sign-in even for preview query links', () => {
  expect(memberPageAccess({ signedIn: false, plan: 'pro', path: '/oracle?preview=1' })).toBe('sign-in');
});
it('lets Free accounts open only no-cost pages', () => {
  for (const path of ['/oracle', '/calendar', '/media-library', '/crisis-hub', '/wallet', '/membership']) {
    expect(memberPageAccess({ signedIn: true, plan: 'free', path })).toBe('allow');
  }
  for (const path of ['/story-writer', '/photography-hub', '/movie-studio-pro']) {
    expect(memberPageAccess({ signedIn: true, plan: 'free', path })).toBe('upgrade');
  }
});
it('gives Founders the same pages as Plus', () => {
  for (const plan of ['founder', 'plus'] as const) {
    expect(memberPageAccess({ signedIn: true, plan, path: '/story-writer' })).toBe('allow');
    expect(memberPageAccess({ signedIn: true, plan, path: '/movie-studio-pro' })).toBe('upgrade');
    expect(memberPageAccess({ signedIn: true, plan, path: '/app-builder' })).toBe('upgrade');
  }
});
it('opens Pro tools for Pro members and the owner', () => {
  expect(memberPageAccess({ signedIn: true, plan: 'pro', path: '/video-editor' })).toBe('allow');
  expect(memberPageAccess({ signedIn: true, plan: 'owner', path: '/app-builder' })).toBe('allow');
});
