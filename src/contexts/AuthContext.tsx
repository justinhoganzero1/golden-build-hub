import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Capture ?ref=CODE from any URL the visitor lands on, before they sign up.
const captureRefFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.length < 64) {
      localStorage.setItem("oracle-lunar-ref-code", ref);
    }
  } catch {}
};

const REWARD_FLAG_PREFIX = "oracle-lunar-reward-granted-";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    captureRefFromUrl();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Best-effort welcome-reward trigger after email-confirmation sign-in.
        // Idempotent on the server, but we add a per-user flag to avoid spam.
        if (event === "SIGNED_IN" && session?.user) {
          const flagKey = `${REWARD_FLAG_PREFIX}${session.user.id}`;
          if (!localStorage.getItem(flagKey)) {
            const refCode = localStorage.getItem("oracle-lunar-ref-code");
            setTimeout(() => {
              supabase.functions.invoke("grant-signup-reward", {
                body: { referralCode: refCode },
              }).then(() => {
                localStorage.setItem(flagKey, "1");
                localStorage.removeItem("oracle-lunar-ref-code");
              }).catch(() => {});
            }, 500);
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error && /refresh token/i.test(error.message)) {
        await supabase.auth.signOut({ scope: "local" });
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
