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
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const isOwnerAccess = redirectPath === "/owner-dashboard";
  const ownerEmail = "justinbretthogan@gmail.com";

  useEffect(() => {
    if (authLoading || !user) return;

    const isOwner = (user.email || "").trim().toLowerCase() === ownerEmail;
    const nextPath = isOwner ? "/owner-dashboard" : redirectPath;
    navigate(nextPath, { replace: true });
  }, [authLoading, user, ownerEmail, redirectPath, navigate]);

  // When the owner-access flow is active, lock the email field to the owner
  // email so an attacker can't even type a different one. Belt-and-suspenders
  // alongside the server-side email allowlist + DB role lock.
  useEffect(() => {
    if (isOwnerAccess) setEmail(ownerEmail);
  }, [isOwnerAccess, ownerEmail]);

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
        // Fire-and-forget: grant the 30-day Tier 3 welcome trial + attach referral.
        // If session is already active (auto-confirm on), this runs immediately;
        // otherwise AuthContext picks it up after email confirmation.
        if (signUpData.session) {
          // Auto-confirm is on → user is signed in. Grant the welcome reward
          // and bounce them straight to the portal/dashboard.
          supabase.functions.invoke("grant-signup-reward", {
            body: { referralCode: refCode },
          }).catch(() => {});
          localStorage.removeItem("oracle-lunar-ref-code");
          toast.success("Welcome aboard! Unlocking your portal… 🎉");
          const isAdminEmail = email.trim().toLowerCase() === ownerEmail;
          navigate(isAdminEmail ? "/owner-dashboard" : redirectPath, { replace: true });
        } else {
          // Email confirmation required → preserve the ref code and flip the
          // form back to Sign-In so the user can log in once confirmed.
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
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isOwnerAccess) sessionStorage.setItem("admin-fresh-login", "1");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectPath}`,
    });
    if (result?.error) toast.error(String(result.error));
  };

  const handleAppleSignIn = async () => {
    if (isOwnerAccess) sessionStorage.setItem("admin-fresh-login", "1");
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
                className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm"
                required
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
          <p className="text-center text-muted-foreground text-sm mt-4">
            {isSignUp ? "Already have an account?" : "New here?"}{" "}
            <span
              className="text-primary cursor-pointer hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Sign in" : "Create an account"}
            </span>
          </p>
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
