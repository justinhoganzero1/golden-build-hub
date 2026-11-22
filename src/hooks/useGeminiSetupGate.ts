import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isOwnerEmail } from "@/lib/ownerIdentity";

// Accounts whose Google key is connected, so pages don't re-check.
const doneFor = new Set<string>();
// The owner never sees the step (keeps the owner dashboard one tap away).

export function markGeminiSetupDone(userId: string) {
  doneFor.add(userId);
}

/** Whether the signed-in member has connected and checked their own Google key. */
export function useGeminiSetupGate() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<{ loading: boolean; verifiedAt: string | null; isOwner: boolean }>({ loading: true, verifiedAt: null, isOwner: false });

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    const isOwner = isOwnerEmail(user?.email);
    if (!user || isOwner || doneFor.has(user.id)) {
      setState({ loading: false, verifiedAt: user && !isOwner ? "done" : null, isOwner });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    supabase
      .from("member_ai_setup")
      .select("gemini_verified_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // Never lock people out on a network blip; the server still refuses AI without a key.
        if (error) { setState({ loading: false, verifiedAt: "unknown", isOwner }); return; }
        const verifiedAt = data?.gemini_verified_at ?? null;
        if (verifiedAt) doneFor.add(user.id);
        setState({ loading: false, verifiedAt, isOwner });
      });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return state;
}
