import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, Shield, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import oracleLunarBanner from "@/assets/oracle-lunar-banner.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { PUBLIC_ORIGIN } from "@/lib/installRedirect";

const SignInPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD, only used on signup
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const requestedSignUp = searchParams.get("mode") === "signup";
  const [isSignUp, setIsSignUp] = useState(requestedSignUp);
  const isOwnerAccess = redirectPath === "/owner-dashboard";
  const ownerEmail = "justinbretthogan@gmail.com";
  const [showHelp, setShowHelp] = useState(false);

  // Lovable preview visitors skip sign-in entirely and view the dashboard.
  useEffect(() => {
    const isLovablePreview =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("lovable.app") ||
        searchParams.get("preview") === "1");
    if (isLovablePreview && !isOwnerAccess) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, searchParams, isOwnerAccess]);

  useEffect(() => {
    if (isOwnerAccess) return;
    setIsSignUp(requestedSignUp);
  }, [requestedSignUp, isOwnerAccess]);

  useEffect(() => {
    if (authLoading || !user) return;
    const isOwner = (user.email || "").trim().toLowerCase() === ownerEmail;
    const requestedAdmin = redirectPath.startsWith("/owner-dashboard") || redirectPath.startsWith("/admin");
    // Non-owners may NOT visit admin routes — bounce to user dashboard.
    // Owners may visit ANY route, including the regular user dashboard. Only
    // force them into the owner dashboard when they didn't ask for somewhere
    // specific (i.e. arrived at /sign-in with no redirect).
    const cameFromOwnerLink = isOwnerAccess; // explicit ?redirect=/owner-dashboard
    let nextPath: string;
    if (!isOwner) {
      nextPath = requestedAdmin ? "/dashboard" : redirectPath;
    } else {
      nextPath = cameFromOwnerLink ? "/owner-dashboard" : redirectPath;
    }
    navigate(nextPath, { replace: true });
  }, [authLoading, user, ownerEmail, redirectPath, navigate, isOwnerAccess]);

  useEffect(() => { if (isOwnerAccess) setEmail(ownerEmail); }, [isOwnerAccess, ownerEmail]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwnerAccess && email.trim().toLowerCase() !== ownerEmail) {
      toast.error("Owner access only accepts the approved admin email.");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        if (isOwnerAccess) { toast.error("Owner access is sign-in only."); return; }
        // Hard 16+ age gate at signup
        if (!dob) { toast.error("Date of birth is required."); return; }
        const dobDate = new Date(dob);
        if (isNaN(dobDate.getTime())) { toast.error("Please enter a valid date of birth."); return; }
        const today = new Date();
        const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
        if (dobDate > sixteenYearsAgo) {
          toast.error("You must be at least 16 years old to use Oracle Lunar.");
          return;
        }
        const refCode = searchParams.get("ref") || localStorage.getItem("oracle-lunar-ref-code") || null;
        const emailReturnUrl = `${PUBLIC_ORIGIN}/sign-in?redirect=${encodeURIComponent(redirectPath)}`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: emailReturnUrl },
        });
        if (error) throw error;
        // Persist DOB to profiles (server-side trigger re-validates 16+)
        if (signUpData.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            user_id: signUpData.user.id,
            date_of_birth: dob,
          });
          if (profileError) {
            // If under-age trigger blocks, sign them out and stop
            await supabase.auth.signOut();
            throw new Error(profileError.message);
          }
        }
        if (signUpData.session) {
          try {
            await supabase.functions.invoke("grant-signup-reward", { body: { referralCode: refCode } });
            localStorage.removeItem("oracle-lunar-ref-code");
          } catch {}
          toast.success("Welcome aboard! Taking you into your portal… 🎉");
        } else {
          if (refCode) localStorage.setItem("oracle-lunar-ref-code", refCode);
          toast.success("Account created! Check your email to confirm, then sign in.", { duration: 7000 });
          setIsSignUp(false);
          setPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (isOwnerAccess) {
          sessionStorage.setItem("admin-fresh-login", "1");
          sessionStorage.removeItem("admin-pending-login");
        }
        toast.success("Signed in — opening your portal now.");
      }
    } catch (error: any) {
      if (isSignUp) {
        try {
          await supabase.from("signup_failures").insert({
            email: email.trim().toLowerCase() || null,
            reason: error?.message || "unknown signup error",
            error_code: error?.code || error?.status?.toString() || null,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            source_page: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          });
        } catch {}
      }
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Defeat any inherited pink tab glow on this page by scoping a wrapper.
  return (
    <div data-no-tab-glow className="min-h-screen bg-background flex flex-col items-center justify-start pt-6 px-4 pb-10">
      <style>{`
        [data-no-tab-glow] [role="tab"]::before,
        [data-no-tab-glow] [role="tab"]::after,
        [data-no-tab-glow] [role="tablist"] > button::before,
        [data-no-tab-glow] [role="tablist"] > button::after { content: none !important; display: none !important; }
      `}</style>

      <div className="w-full max-w-md overflow-hidden rounded-[22px] mb-6 border border-primary/30 shadow-[0_0_32px_hsl(45_100%_55%/0.25)]">
        <img src={oracleLunarBanner} alt="Oracle Lunar Banner" className="w-full h-auto object-cover" width={1024} height={512} />
      </div>

      <div
        className="w-full max-w-md rounded-[22px] p-7 animate-slide-up"
        style={{
          background: "linear-gradient(160deg, hsl(0 0% 6% / 0.95), hsl(265 35% 9% / 0.92) 50%, hsl(0 0% 4% / 0.95))",
          border: "1.5px solid hsl(45 100% 55% / 0.5)",
          boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.18), 0 0 26px hsl(45 100% 55% / 0.3), 0 0 50px hsl(280 90% 60% / 0.18)",
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-2xl font-bold text-primary text-center">
            {isOwnerAccess ? "Owner Sign In" : isSignUp ? "Create Account" : "Sign In"}
          </h2>
        </div>

        {isOwnerAccess ? (
          <p className="text-center text-sm text-muted-foreground mb-6">Approved owner account only.</p>
        ) : (
          <>
            <p className="text-center text-xs text-muted-foreground mb-2">
              {isSignUp ? "Create your account with email and password." : "Sign in with your email and password."}
            </p>
            {isSignUp && (
              <p className="text-center text-xs text-primary font-medium mb-4">
                ✨ 100% free to join — no credit card required.
              </p>
            )}
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <label className="text-muted-foreground text-xs uppercase tracking-wider mb-1.5 block">Email</label>
            <div
              className="flex items-center gap-3 rounded-[14px] px-4 py-3 transition-colors"
              style={{
                background: "hsl(0 0% 4% / 0.7)",
                border: "1px solid hsl(45 100% 55% / 0.35)",
                boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06)",
              }}
            >
              <Mail className="w-4 h-4 text-primary/80" />
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
            <label className="text-muted-foreground text-xs uppercase tracking-wider mb-1.5 block">Password</label>
            <div
              className="flex items-center gap-3 rounded-[14px] px-4 py-3"
              style={{
                background: "hsl(0 0% 4% / 0.7)",
                border: "1px solid hsl(280 90% 60% / 0.4)",
                boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06)",
              }}
            >
              <Lock className="w-4 h-4 text-primary/80" />
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

          {isSignUp && !isOwnerAccess && (
            <div>
              <label className="text-muted-foreground text-xs uppercase tracking-wider mb-1.5 block">
                Date of Birth <span className="text-primary">(must be 16+)</span>
              </label>
              <div
                className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                style={{
                  background: "hsl(0 0% 4% / 0.7)",
                  border: "1px solid hsl(45 100% 55% / 0.35)",
                  boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.06)",
                }}
              >
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date(new Date().getFullYear() - 16, new Date().getMonth(), new Date().getDate())
                    .toISOString().slice(0, 10)}
                  min="1900-01-01"
                  className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm"
                  required
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Oracle Lunar is restricted to users aged 16 and over.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-muted-foreground text-xs cursor-pointer">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${rememberMe ? "bg-primary border-primary" : "border-primary/40"}`}
              />
              Remember me
            </label>
            <span className="text-primary text-[11px] flex items-center gap-1">
              <Shield className="w-3 h-3" /> Secure login
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-[14px] font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(45 100% 55%), hsl(38 100% 50%))",
              color: "hsl(0 0% 8%)",
              border: "1px solid hsl(45 100% 60% / 0.7)",
              boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.4), 0 0 24px hsl(45 100% 55% / 0.4), 0 4px 14px hsl(45 100% 50% / 0.35)",
            }}
          >
            {loading ? "Loading..." : isOwnerAccess ? "Sign In as Owner" : isSignUp ? "Create Account" : "Sign In"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {!isOwnerAccess && (
          <>
            <p className="text-center text-muted-foreground text-xs mt-5">
              {isSignUp ? "Already have an account?" : "New here?"}{" "}
              <span className="text-primary cursor-pointer hover:underline font-semibold" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? "Sign in" : "Create an account"}
              </span>
            </p>
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => setShowHelp((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
              >
                Trouble signing up?
              </button>
              {showHelp && (
                <div
                  className="mt-3 text-left text-xs text-muted-foreground rounded-[14px] p-3 space-y-2"
                  style={{ background: "hsl(0 0% 4% / 0.6)", border: "1px solid hsl(280 90% 60% / 0.3)" }}
                >
                  <p className="text-foreground font-semibold">Quick fixes:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Use a password with <span className="text-foreground">8+ characters</span>.</li>
                    <li>Avoid common passwords — they're auto-blocked.</li>
                    <li>Already have an account? Tap <span className="text-primary">Sign in</span> above.</li>
                    <li>Check your inbox (and spam) for confirmation.</li>
                  </ul>
                  <p className="pt-1">
                    Still stuck? Email <a href="mailto:justinbretthogan@gmail.com" className="text-primary hover:underline">justinbretthogan@gmail.com</a>.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex justify-center mt-5">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider"
            style={{ border: "1px solid hsl(160 84% 39% / 0.5)", color: "hsl(160 84% 50%)", background: "hsl(160 84% 20% / 0.15)" }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "hsl(160 84% 45%)" }} />
            AI Anti-Hacker Active
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-[11px] mt-5">
        By continuing, you agree to our <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
      </p>
    </div>
  );
};

export default SignInPage;
