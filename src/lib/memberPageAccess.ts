const ALWAYS_AVAILABLE = ['/membership', '/founder-seats', '/wallet', '/profile', '/settings', '/my-account', '/terms-of-service', '/privacy-policy'];
const FOUNDER_AVAILABLE = ['/', '/dashboard', '/welcome', '/get-started', '/oracle', '/chat-oracle', '/free-zone', '/founder-vault', '/my-apps', '/mind-hub', '/crisis-hub', '/calendar', '/media-library', '/story-writer', '/read', '/author-dashboard'];
const matches = (list: string[], path: string) => list.some(p => path === p || (p !== '/' && path.startsWith(`${p}/`)));
export function memberPageAccess(input: { signedIn: boolean; owner: boolean; active: boolean; founder: boolean; monthly: boolean; path: string }): 'sign-in' | 'allow' | 'upgrade' {
  if (!input.signedIn) return 'sign-in';
  if (input.owner || matches(ALWAYS_AVAILABLE, input.path)) return 'allow';
  if (!input.active) return 'upgrade';
  if (input.founder && !input.monthly && !matches(FOUNDER_AVAILABLE, input.path)) return 'upgrade';
  return 'allow';
}