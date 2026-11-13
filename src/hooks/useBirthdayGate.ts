import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { needsBirthdayStep, signedInWithGoogle } from "@/lib/birthdayGate";

// Remembers per account whether the birthday step is done, so pages don't re-check.
const doneFor = new Set<string>();
// The owner account never sees the step (keeps the owner dashboard one tap away).
const OWNER_EMAIL = "justinbretthogan@gmail.com";

export function markBirthdayDone(userId: string) {
  doneFor.add(userId);
}

/** Returns whether the signed-in Google account still needs to give a birthday. */
export function useBirthdayGate() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ loading: boolean; needed: boolean }>({ loading: true, needed: false });

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    const isOwner = (user?.email || "").trim().toLowerCase() === OWNER_EMAIL;
    if (!user || isOwner || doneFor.has(user.id) || !signedInWithGoogle(user)) {
      setState({ loading: false, needed: false });
      return;
    }
    setState({ loading: true, needed: false });
    supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setState({ loading: false, needed: false }); return; } // never lock people out on a network blip
        const needed = needsBirthdayStep(user, data?.date_of_birth ?? null);
        if (!needed) doneFor.add(user.id);
        setState({ loading: false, needed });
      });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return state;
}
