export function validatePluginUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash) throw new Error('Use a public HTTPS address without a login, fragment or custom port.');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.internal') || host === 'localhost' || host.includes(':') || /^[\d.]+$/.test(host)) throw new Error('Private network addresses are not allowed.');
  if (raw.length > 2048) throw new Error('Connection address is too long.');
  return url;
}
export function isPublicAddress(ip: string): boolean {
  if (ip.includes(':')) return false; // Fail closed: use a public IPv4 target.
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b,c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export function requireApproval(value: unknown) {
  if (value !== true) throw new Error('Approve this external request before running it.');
}
export function validateAuthHeader(name: string) {
  if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(name) || /^(host|cookie|set-cookie|content-length|connection|transfer-encoding|proxy-.*|origin|referer|apikey)$/i.test(name)) throw new Error('Choose a safe API-key header name.');
  return name;
}
export function parsePluginCommand(text: string) {
  const match = text.trim().match(/^(?:run|use|ask)\s+(?:my\s+)?plugin\s+["“]([^"”]{1,80})["”](?:\s*[:,-]?\s*(.*))?$/i);
  return match ? { name: match[1], input: (match[2] ?? '').slice(0, 8000) } : null;
}
