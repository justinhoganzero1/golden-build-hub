// Global wallet wall interceptor.
//
// Every paid AI edge function answers with HTTP 402 + {error:"insufficient_coins",
// needed_cents, balance_cents} when the user's wallet can't cover the call.
// Individual call sites used to swallow that (generic toast, or supabase's
// FunctionsHttpError hiding the body), so the top-up modal never appeared.
//
// Patching fetch once catches every path — raw fetch AND supabase.functions.invoke,
// which uses fetch internally — so the "add $10 and keep going" modal always shows.

import { notifyWalletInsufficient } from "./walletPaywall";

let installed = false;

export function installWalletInterceptor() {
  if (installed || typeof window === "undefined" || !window.fetch) return;
  installed = true;

  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await original(input as any, init);
    if (res.status === 402) {
      try {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
        if (url.includes("/functions/v1/")) {
          const body = await res.clone().json().catch(() => null);
          notifyWalletInsufficient({
            service: body?.service,
            requiredCents: body?.needed_cents ?? body?.required_cents,
            balanceCents: body?.balance_cents,
          });
        }
      } catch {
        /* never break the original request */
      }
    }
    return res;
  };
}
