import { useEffect, useRef, useState } from "react";
import { Mail, Lock, ArrowRight, Shield, Sparkles, Heart, Brain, Camera, Eye, Mic, Users, Wand2, Megaphone, Video, Wallet, Calendar, GraduationCap } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import earthOrbitBg from "@/assets/earth-orbit-stardust.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { PUBLIC_ORIGIN } from "@/lib/installRedirect";
import { setAIFullControl } from "@/lib/aiControl";
import { lovable } from "@/integrations/lovable";

const ORBIT_TILES = [
  { icon: Heart, label: "Crisis Hub" },
  { icon: Brain, label: "Mind Hub" },
  { icon: Camera, label: "Photography" },
  { icon: Eye, label: "Live Vision" },
  { icon: Mic, label: "Voice Studio" },
  { icon: Users, label: "AI Companion" },
  { icon: Wand2, label: "Magic Hub" },
  { icon: Megaphone, label: "Marketing" },
  { icon: Video, label: "Video Editor" },
  { icon: Wallet, label: "Wallet" },
  { icon: Calendar, label: "Calendar" },
  { icon: GraduationCap, label: "AI Tutor" },
];



const SignInPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [aiFullControl, setAiFullControlState] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const redirectBasePath = redirectPath.split(/[?#]/)[0];
  const requestedSignUp = searchParams.get("mode") === "signup";
  const freshAuth = searchParams.get("fresh") === "1";
  const [isSignUp, setIsSignUp] = useState(requestedSignUp);
  const isOwnerAccess = redirectBasePath === "/owner-dashboard";
  const ownerEmail = "justinbretthogan@gmail.com";
  const [showHelp, setShowHelp] = useState(false);
  const freshSignOutStartedRef = useRef(false);


  useEffect(() => {
    if (isOwnerAccess) return;
    setIsSignUp(requestedSignUp);
  }, [requestedSignUp, isOwnerAccess]);

  useEffect(() => {
    if (!freshAuth || authLoading || !user) return;
    if (freshSignOutStartedRef.current) return;
    freshSignOutStartedRef.current = true;
    supabase.auth.signOut({ scope: "local" })
      .catch(() => {})
      .finally(() => {
        // Strip ?fresh=1 so the next successful sign-in isn't immediately
        // logged out again by this same effect.
        const params = new URLSearchParams(searchParams);
        params.delete("fresh");
        setSearchParams(params, { replace: true });
      });
  }, [freshAuth, authLoading, user, searchParams, setSearchParams]);

  useEffect(() => {
    if (freshAuth) return;
    if (authLoading || !user) return;
    const isOwner = (user.email || "").trim().toLowerCase() === ownerEmail;
    const requestedAdmin = redirectBasePath.startsWith("/owner-dashboard") || redirectBasePath.startsWith("/admin");
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
  }, [freshAuth, authLoading, user, ownerEmail, redirectPath, redirectBasePath, navigate, isOwnerAccess]);

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
        if (!acceptTerms) {
          toast.error("Please accept the Terms & Privacy Policy to continue.");
          return;
        }
        // Persist the AI Full Control preference (user can flip in Settings anytime)
        setAIFullControl(aiFullControl);
        const refCode = searchParams.get("ref") || localStorage.getItem("oracle-lunar-ref-code") || null;
        const emailReturnUrl = `${PUBLIC_ORIGIN}/sign-in?redirect=${encodeURIComponent(redirectPath)}`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: emailReturnUrl },
        });
        if (error) throw error;
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
    <div
      data-no-tab-glow
      className="min-h-screen relative flex flex-col items-center justify-start pt-6 px-4 pb-10"
      style={{
        backgroundImage: `linear-gradient(180deg, hsl(0 0% 0% / 0.55) 0%, hsl(0 0% 0% / 0.78) 100%), url(${earthOrbitBg})`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundAttachment: "fixed, fixed",
        backgroundRepeat: "no-repeat, no-repeat",
      }}
    >
      <style>{`
        [data-no-tab-glow] [role="tab"]::before,
        [data-no-tab-glow] [role="tab"]::after,
        [data-no-tab-glow] [role="tablist"] > button::before,
        [data-no-tab-glow] [role="tablist"] > button::after { content: none !important; display: none !important; }
        @keyframes orbit-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .orbit-marquee-track { display: flex; gap: 14px; width: max-content; animation: orbit-marquee 38s linear infinite; }
      `}</style>

      {/* Right-to-left orbit of feature tiles — like satellites streaming across the sky */}
      <div className="w-full max-w-3xl overflow-hidden mb-6 py-2 mask-fade-x">
        <div className="orbit-marquee-track">
          {[...ORBIT_TILES, ...ORBIT_TILES].map((t, i) => {
            const Icon = t.icon;
            return (
              <div
                key={`${t.label}-${i}`}
                className="flex items-center gap-2 rounded-full border border-primary/40 bg-black/60 backdrop-blur-md px-3 py-2 shadow-[0_0_18px_hsl(45_100%_55%/0.35)] whitespace-nowrap"
              >
                <span className="h-6 w-6 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </span>
                <span className="text-[11px] font-semibold text-foreground">{t.label}</span>
              </div>
            );
          })}
        </div>
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

        {!isOwnerAccess && (
          <div className="mt-4 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={async () => {
                const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${redirectPath}` });
                if (r.error) toast.error(r.error.message || "Google sign-in failed");
              }}
              className="flex items-center justify-center gap-2.5 py-3 rounded-[14px] font-semibold text-sm bg-black text-white border border-white/20 hover:opacity-90 transition-opacity shadow-[0_0_18px_hsl(280_90%_60%/0.3)]"
            >
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </span>
              Google
            </button>
            <button
              type="button"
              onClick={async () => {
                const r = await lovable.auth.signInWithOAuth("apple", { redirect_uri: `${window.location.origin}${redirectPath}` });
                if (r.error) toast.error(r.error.message || "Apple sign-in failed");
              }}
              className="flex items-center justify-center gap-2.5 py-3 rounded-[14px] font-semibold text-sm bg-black text-white border border-white/20 hover:opacity-90 transition-opacity shadow-[0_0_18px_hsl(280_90%_60%/0.3)]"
            >
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="black"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              </span>
              Apple
            </button>
          </div>
            <div className="flex items-center gap-3 mt-5">
              <div className="flex-1 h-px bg-primary/20" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or use email</span>
              <div className="flex-1 h-px bg-primary/20" />
            </div>
          </div>
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

          {isSignUp && (
            <div className="space-y-2.5 rounded-[14px] p-3.5"
                 style={{ background: "hsl(0 0% 4% / 0.55)", border: "1px solid hsl(45 100% 55% / 0.25)" }}>
              <button
                type="button"
                onClick={() => setAcceptTerms(!acceptTerms)}
                className="w-full flex items-start gap-2.5 text-left"
              >
                <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${acceptTerms ? "bg-primary border-primary" : "border-primary/40"}`} />
                <span className="text-[11px] leading-snug text-muted-foreground">
                  I agree to the{" "}
                  <a href="/terms-of-service" target="_blank" rel="noopener" className="text-primary underline">Terms of Service</a>
                  {" "}and{" "}
                  <a href="/privacy-policy" target="_blank" rel="noopener" className="text-primary underline">Privacy Policy</a>.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAiFullControlState(!aiFullControl)}
                className="w-full flex items-start gap-2.5 text-left pt-2 border-t border-primary/15"
              >
                <span className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${aiFullControl ? "bg-primary border-primary" : "border-primary/40"}`} />
                <span className="text-[11px] leading-snug text-muted-foreground">
                  <span className="text-foreground font-medium">Give Oracle full control.</span>{" "}
                  Allow the Oracle to learn from my messages, draft replies in my voice, and act on my behalf where useful.
                  I can switch this off anytime in <span className="text-primary">Settings → Notifications</span>.
                </span>
              </button>
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
              <span className="text-primary cursor-pointer hover:underline font-semibold" onClick={() => navigate(`${location.pathname}?${isSignUp ? "" : "mode=signup&"}redirect=${encodeURIComponent(redirectPath)}`, { replace: true })}>
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
