import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns auth state plus an `isReady` flag that flips to true ONLY after
 * Supabase has finished restoring the session from storage.
 *
 * Use this to gate any call to a protected edge function or RLS-protected
 * query so we never fire requests with a stale / missing JWT.
 */
export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session: restored } }) => {
      if (cancelled) return;
      setSession(restored);
      setUser(restored?.user ?? null);
      setIsReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const accessToken = session?.access_token ?? null;

  return { isReady, user, session, accessToken, hasSession: !!accessToken };
}
