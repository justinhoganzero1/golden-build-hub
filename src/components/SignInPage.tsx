import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, Shield } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import oracleLunarBanner from "@/assets/oracle-lunar-banner.jpg";
import { useAuth } from "@/contexts/AuthContext";

const SignInPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const requestedSignUp = searchParams.get("mode") === "signup";
  const [isSignUp, setIsSignUp] = useState(requestedSignUp);
  const isOwnerAccess = redirectPath === "/owner-dashboard";
  const ownerEmail = "justinbretthogan@gmail.com";

  useEffect(() => {
    if (isOwnerAccess) return;
    setIsSignUp(requestedSignUp);
  }, [requestedSignUp, isOwnerAccess]);

  useEffect(() => {
    if (authLoading || !user) return;

    const isOwner = (user.email || "").trim().toLowerCase() === ownerEmail;
    const nextPath = isOwner ? "/owner-dashboard" : redirectPath;
    navigate(nextPath, { replace: true });
  }, [authLoading, user, ownerEmail, redirectPath, navigate]);

  useEffect(() => {
    if (isOwnerAccess) setEmail(ownerEmail);
  }, [isOwnerAccess, ownerEmail]);

  // Track sign-in vs sign-up page landings so we can measure submit drop-off
  useEffect(() => {
    if (isOwnerAccess) return;
    const pageKey = isSignUp ? "sign-in-signup" : "sign-in";
    const sessionKey = `oracle-lunar-visit-${pageKey}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    supabase.from("page_views").insert({
      page: pageKey,
      user_agent: navigator.userAgent.slice(0, 200),
      referrer: document.referrer ? document.referrer.slice(0, 500) : null,
    }).then(() => {}, () => {});
  }, [isSignUp, isOwnerAccess]);

  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isOwnerAccess && email.trim().toLowerCase() !== ownerEmail) {
      toast.error("Owner access only accepts the approved admin email.");
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        if (isOwnerAccess) {
          toast.error("Owner access is sign-in only.");
          return;
        }

        const refCode = searchParams.get("ref") || localStorage.getItem("oracle-lunar-ref-code") || null;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        if (signUpData.session) {
          try {
            await supabase.functions.invoke("grant-signup-reward", {
              body: { referralCode: refCode },
            });
            localStorage.removeItem("oracle-lunar-ref-code");
          } catch {
            // AuthContext retries this on SIGNED_IN; do not block entry.
          }

          toast.success("Welcome aboard! Unlocking your portal… 🎉");
          const isAdminEmail = email.trim().toLowerCase() === ownerEmail;
          navigate(isAdminEmail ? "/owner-dashboard" : redirectPath, { replace: true });
        } else {
          if (refCode) localStorage.setItem("oracle-lunar-ref-code", refCode);
          toast.success(
            "Account created! Check your email to confirm, then sign in to enter your portal.",
            { duration: 7000 }
          );
          setIsSignUp(false);
          setPassword("");
        }
      } else {
        // Hard email gate for owner dashboard — only the owner email can sign in to /owner-dashboard
        if (isOwnerAccess && email.trim().toLowerCase() !== ownerEmail) {
          toast.error("Admin access is restricted to the owner account.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Mark this tab as a fresh admin login so the dashboard guard lets it through once.
        if (isOwnerAccess) {
          sessionStorage.setItem("admin-fresh-login", "1");
          sessionStorage.removeItem("admin-pending-login");
        }
        // Admin auto-routes to owner dashboard unless an explicit redirect was given.
        const isAdminEmail = email.trim().toLowerCase() === ownerEmail;
        const finalPath =
          isAdminEmail && (redirectPath === "/dashboard" || redirectPath === "/")
            ? "/owner-dashboard"
            : redirectPath;
        navigate(finalPath);
      }
    } catch (error: any) {
      // Log failed signups so the owner dashboard can see who tried to join but couldn't
      if (isSignUp) {
        try {
          await supabase.from("signup_failures").insert({
            email: email.trim().toLowerCase() || null,
            reason: error?.message || "unknown signup error",
            error_code: error?.code || error?.status?.toString() || null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            source_page: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          });
        } catch { /* never block UX on logging */ }
      }
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isOwnerAccess) {
      toast.error("Owner access is password-only — OAuth disabled for the admin portal.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectPath}`,
    });
    if (result?.error) toast.error(String(result.error));
  };

  const handleAppleSignIn = async () => {
    if (isOwnerAccess) {
      toast.error("Owner access is password-only — OAuth disabled for the admin portal.");
      return;
    }
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: `${window.location.origin}${redirectPath}`,
    });
    if (result?.error) toast.error(String(result.error));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-4 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl mb-6">
        <img src={oracleLunarBanner} alt="Oracle Lunar Banner" className="w-full h-auto object-cover" width={1024} height={512} />
      </div>

      <div className="w-full max-w-md border border-border rounded-2xl p-8 bg-card animate-slide-up">
        <h2 className="text-2xl font-bold text-primary text-center mb-2">
          {isOwnerAccess ? "Owner Sign In" : isSignUp ? "Create Account" : "Sign In"}
        </h2>
        {isOwnerAccess && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            Approved owner account only.
          </p>
        )}

        {!isOwnerAccess && (
          <>
            <button onClick={handleGoogleSignIn} className="w-full flex items-center justify-center gap-3 py-3 border border-border rounded-lg text-primary hover:bg-secondary transition-colors mb-3">
              <span className="text-lg font-bold" style={{ color: '#4285F4' }}>G</span>
              Continue with Google
            </button>
            <button onClick={handleAppleSignIn} className="w-full flex items-center justify-center gap-3 py-3 border border-border rounded-lg text-primary hover:bg-secondary transition-colors mb-4">
              <span className="text-lg">🍎</span>
              Continue with Apple
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-muted-foreground text-xs">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm mb-1 block">Email</label>
            <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-input">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm disabled:opacity-70"
                required
                readOnly={isOwnerAccess}
                disabled={isOwnerAccess}
              />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-sm mb-1 block">Password</label>
            <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-input">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-muted-foreground text-sm cursor-pointer">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  rememberMe ? "bg-primary border-primary" : "border-border"
                }`}
              />
              Remember me
            </label>
            <span className="text-primary text-xs flex items-center gap-1">
              <Shield className="w-3 h-3" /> Secure login
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : isOwnerAccess ? "Sign In as Owner" : isSignUp ? "Create Account" : "Sign In"} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {!isOwnerAccess && (
          <>
            <p className="text-center text-muted-foreground text-sm mt-4">
              {isSignUp ? "Already have an account?" : "New here?"}{" "}
              <span
                className="text-primary cursor-pointer hover:underline"
                onClick={() => setIsSignUp(!isSignUp)}
              >
                {isSignUp ? "Sign in" : "Create an account"}
              </span>
            </p>

            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
              >
                Trouble signing up?
              </button>
              {showHelp && (
                <div className="mt-3 text-left text-xs text-muted-foreground border border-border rounded-lg p-3 bg-secondary/30 space-y-2">
                  <p className="text-foreground font-semibold">Quick fixes:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Use a password with <span className="text-foreground">8+ characters</span> — mix letters &amp; numbers.</li>
                    <li>Avoid common passwords (e.g. <em>password123</em>) — they're auto-blocked.</li>
                    <li>Already have an account? Tap <span className="text-primary">Sign in</span> above.</li>
                    <li>Check your inbox (and spam) for a confirmation email after signup.</li>
                  </ul>
                  <p className="pt-1">
                    Still stuck? Email{" "}
                    <a href="mailto:justinbretthogan@gmail.com" className="text-primary hover:underline">
                      justinbretthogan@gmail.com
                    </a>{" "}
                    — we'll get you in.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs" style={{ borderColor: 'hsl(160, 84%, 39%)', color: 'hsl(160, 84%, 39%)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} />
            AI ANTI-HACKER ACTIVE
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} />
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs mt-4 mb-8">
        By continuing, you agree to our{" "}
        <span className="text-primary cursor-pointer">Terms of Service</span>
      </p>
    </div>
  );
};

export default SignInPage;
