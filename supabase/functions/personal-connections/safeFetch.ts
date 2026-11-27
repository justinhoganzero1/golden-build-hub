import https from 'node:https';
import { resolve4 } from 'node:dns/promises';
import { validatePluginUrl, isPublicAddress } from '../_shared/pluginSafety.ts';
/** Pins TLS connections to a checked DNS answer; retains hostname certificate validation. */
export async function safePluginFetch(input: string | URL | Request, init: RequestInit = {}): Promise<Response> {
  const url = validatePluginUrl(input instanceof Request ? input.url : String(input));
  const addresses = await resolve4(url.hostname);
  if (!addresses.length || addresses.some(ip => !isPublicAddress(ip))) throw new Error('The plugin must resolve only to public internet addresses.');
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined)));
    const request = https.request(url, { method: init.method ?? 'POST', headers, lookup: (_host, _options, callback) => callback(null, addresses[0], 4), timeout: 20000 }, response => {
      const chunks: Uint8Array[] = []; let size = 0;
      response.on('data', chunk => { size += chunk.length; if (size > 131072) { request.destroy(new Error('Plugin response exceeds 128 KB.')); } else chunks.push(chunk); });
      response.on('end', () => {
        const status = response.statusCode ?? 502;
        if (status >= 300 && status < 400) { reject(new Error('Plugin redirects are blocked. Save the final HTTPS address instead.')); return; }
        const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const responseHeaders = new Headers();
        for (const [key,value] of Object.entries(response.headers)) if (value && !['set-cookie','content-encoding','transfer-encoding','content-length'].includes(key)) responseHeaders.set(key, Array.isArray(value) ? value.join(',') : value);
        resolve(new Response(status === 204 ? null : bytes, { status, headers: responseHeaders }));
      });
    });
    request.on('timeout', () => request.destroy(new Error('Plugin timed out. Its action may have run; check the service before trying again.')));
    request.on('error', () => reject(new Error('Plugin connection failed. Its action may have run; check the service before trying again.')));
    if (init.signal) { const abort = () => request.destroy(new Error('Cancelled')); if (init.signal.aborted) abort(); else init.signal.addEventListener('abort', abort, { once: true }); request.on('close', () => init.signal?.removeEventListener('abort', abort)); }
    if (typeof init.body === 'string') request.write(init.body);
    request.end();
  });
}
