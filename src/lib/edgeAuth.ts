// Helper: get an Authorization header value for calling Supabase Edge Functions.
// Always prefer the user's JWT (so paid AI endpoints can identify + charge),
// fall back to the anon publishable key for fully-public endpoints.
import { supabase } from "@/integrations/supabase/client";

let cached: string | null = null;

export async function getEdgeAuthToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();
  // Refresh a token that is missing or about to expire, otherwise paid
  // endpoints reject the call with auth_required.
  const expiresAt = (session?.expires_at ?? 0) * 1000;
  if (session && expiresAt && expiresAt - Date.now() < 60_000) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) session = data.session;
  }
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  cached = token;
  return token;
}

/** True when we have a real signed-in user token (not the public anon key). */
export async function hasUserSession(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session?.access_token;
}

export function getEdgeAuthTokenSync(): string {
  return cached || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
}

// Warm the cache on import so sync callers (rare) still get a JWT after first signin.
supabase.auth.onAuthStateChange((_e, session) => {
  cached = session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
});
supabase.auth.getSession().then(({ data: { session } }) => {
  cached = session?.access_token || (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
});
