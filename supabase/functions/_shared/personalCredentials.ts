const PREFIX = 'enc:v1:';
async function encryptionKey(secret?: string) {
  const value = secret ?? Deno.env.get('PERSONAL_CONNECTIONS_ENCRYPTION_KEY');
  if (!value) throw new Error('Secure connections are unavailable.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptCredential(value: string, owner: string, secret?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(owner) }, await encryptionKey(secret), new TextEncoder().encode(value));
  return PREFIX + btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}
export async function decryptCredential(value: string | null | undefined, owner: string, secret?: string): Promise<string | null> {
  if (!value) return null;
  // Existing server-only rows remain usable while being encrypted on account status refresh.
  if (!value.startsWith(PREFIX)) return value;
  const [iv, data] = value.slice(PREFIX.length).split(':');
  const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(owner) }, await encryptionKey(secret), decode(data));
  return new TextDecoder().decode(plain);
}
export const isEncryptedCredential = (value: string) => value.startsWith(PREFIX);
export async function loadPersonalKeys(admin: any, userId: string) {
  const { data, error } = await admin.from('user_ai_keys').select('openai_key,gemini_key,claude_key,preferred_provider').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('Unable to load personal AI connections.');
  return { openai: await decryptCredential(data?.openai_key, userId), gemini: await decryptCredential(data?.gemini_key, userId), anthropic: await decryptCredential(data?.claude_key, userId), preferred: data?.preferred_provider ?? 'auto' };
}
