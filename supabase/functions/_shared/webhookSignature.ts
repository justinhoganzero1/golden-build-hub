/** A provider record lookup is NOT proof of webhook origin or body integrity. */
export async function validTwilioSignature(url: string, params: Record<string, string>, token: string, signature: string): Promise<boolean> {
  if (!token || !signature) return false;
  let payload = url;
  for (const key of Object.keys(params).sort()) payload += key + params[key];
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  const expected = btoa(String.fromCharCode(...digest));
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}