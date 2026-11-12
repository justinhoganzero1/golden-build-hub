import { useEffect, useState } from "react";
import { Mail, Lock, ArrowRight, Shield, Eye, EyeOff, CalendarDays, Check } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackAiDiscovery } from "@/lib/aiDiscovery";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { PUBLIC_ORIGIN } from "@/lib/installRedirect";

// Simple human check for sign-up: a random maths question. No external
// service or keys needed — bots that auto-fill forms trip on this.
const newHumanCheck = () => {
  const a = 2 + Math.floor(Math.random() * 8); // 2-9
  const b = 1 + Math.floor(Math.random() * 8); // 1-8
  return { a, b, answer: a + b };
};

const SignInPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState(""); // YYYY-MM-DD, only used on signup
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  // Protected pages send signed-out visitors here with the page they wanted in
  // router state; return them there after sign-in (e.g. /owner-dashboard).
  const fromState = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const fromPath = fromState?.pathname && fromState.pathname.startsWith("/") && !fromState.pathname.startsWith("//") && fromState.pathname !== "/sign-in"
    ? fromState.pathname + (fromState.search || "")
    : null;
  const redirectPath = searchParams.get("redirect") || fromPath || "/oracle";
  const requestedSignUp = searchParams.get("mode") === "signup";
  const [isSignUp, setIsSignUp] = useState(requestedSignUp);
  const isOwnerAccess = redirectPath === "/owner-dashboard" || redirectPath.startsWith("/owner-dashboard?");
  const ownerEmail = "justinbretthogan@gmail.com";
  const [showHelp, setShowHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [humanCheck, setHumanCheck] = useState(newHumanCheck);
  const [humanAnswer, setHumanAnswer] = useState("");

  // Preview auto-redirect removed: RequireAuth no longer bypasses on preview
  // hosts, so navigating unauthenticated users to /dashboard produced an
  // infinite /sign-in ↔ /dashboard loop. Preview visitors now see sign-in
  // like everyone else.

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
    // Brand-new signups land straight on Oracle's welcome greeting; she offers
    // the A$1 Founder seat and unlocks apps in conversation.
    const justSignedUp = sessionStorage.getItem("oracle-just-signed-up") === "1";
    if (justSignedUp) sessionStorage.removeItem("oracle-just-signed-up");
    let nextPath: string;
    if (!isOwner) {
      if (justSignedUp && !requestedAdmin && !searchParams.get("redirect") && !fromPath) {
        nextPath = "/oracle";
      } else {
        nextPath = requestedAdmin ? "/oracle" : redirectPath;
      }
    } else {
      nextPath = cameFromOwnerLink ? "/owner-dashboard" : redirectPath;
    }
    navigate(nextPath, { replace: true });
  }, [authLoading, user, ownerEmail, redirectPath, navigate, isOwnerAccess, fromPath, searchParams]);

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
        // Human check — must answer the maths question correctly
        if (parseInt(humanAnswer.trim(), 10) !== humanCheck.answer) {
          toast.error("Human check failed — please answer the maths question.");
          setHumanCheck(newHumanCheck());
          setHumanAnswer("");
          return;
        }
        const refCode = searchParams.get("ref") || localStorage.getItem("oracle-lunar-ref-code") || null;
        const emailReturnUrl = `${PUBLIC_ORIGIN}/sign-in?redirect=${encodeURIComponent(redirectPath)}`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: emailReturnUrl, data: { date_of_birth: dob } },
        });
        if (error) throw error;
        // Profile (with DOB) is created server-side by the signup trigger.
        if (signUpData.session) {
          try {
            await supabase.functions.invoke("grant-signup-reward", { body: { referralCode: refCode } });
            localStorage.removeItem("oracle-lunar-ref-code");
          } catch {}
          sessionStorage.setItem("oracle-just-signed-up", "1");
          void trackAiDiscovery("signup");
          toast.success("Welcome aboard! Claim your Founder seat… 🎉");
        } else {
          if (refCode) localStorage.setItem("oracle-lunar-ref-code", refCode);
          void trackAiDiscovery("signup");
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

  const title = isOwnerAccess ? "Owner sign in" : isSignUp ? "Meet Oracle" : "Welcome back";
  const subtitle = isOwnerAccess
    ? "Approved owner account only."
    : isSignUp
      ? "Create your free account. No credit card needed."
      : "Sign in and pick up where you left off.";

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <div aria-hidden className="oracle-signin-sweep" />

      <header className="oracle-signin-header">
        <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />Your AI best friend, always here for you
        </p>
      </header>

      <section className="oracle-signin-card" aria-labelledby="signin-title">
        {!isOwnerAccess && (
          <div className="oracle-signin-switch" role="tablist" aria-label="Choose sign in or create account">
            <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => setIsSignUp(false)}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignUp} onClick={() => setIsSignUp(true)}>Create account</button>
          </div>
        )}

        <h2 id="signin-title" className="oracle-signin-title">{title}</h2>
        <p className="oracle-signin-sub">{subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label className="oracle-signin-field">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <span className="sr-only">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              readOnly={isOwnerAccess}
              disabled={isOwnerAccess}
            />
          </label>

          <label className="oracle-signin-field">
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            <span className="sr-only">Password</span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="oracle-signin-eye" onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </label>

          {isSignUp && !isOwnerAccess && (
            <>
              <div>
                <label className="oracle-signin-field">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <span className="oracle-signin-inline-label">Birthday</span>
                  <input
                    type="date"
                    aria-label="Date of birth (must be 16 or over)"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    max={new Date(new Date().getFullYear() - 16, new Date().getMonth(), new Date().getDate())
                      .toISOString().slice(0, 10)}
                    min="1900-01-01"
                    required
                  />
                </label>
                <p className="oracle-signin-hint">Oracle Lunar is for people aged 16 and over.</p>
              </div>

              <label className="oracle-signin-field">
                <Shield className="h-4 w-4 shrink-0 text-primary" />
                <span className="oracle-signin-inline-label">Quick check: what is {humanCheck.a} + {humanCheck.b}?</span>
                <input
                  type="number"
                  inputMode="numeric"
                  aria-label={`Human check: what is ${humanCheck.a} plus ${humanCheck.b}?`}
                  placeholder="?"
                  value={humanAnswer}
                  onChange={(e) => setHumanAnswer(e.target.value)}
                  className="!w-14 !flex-none text-center"
                  required
                />
              </label>
            </>
          )}

          <div className="flex items-center justify-between pt-1">
            <button type="button" role="checkbox" aria-checked={rememberMe} onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${rememberMe ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                {rememberMe && <Check className="h-3 w-3" />}
              </span>
              Remember me
            </button>
            <span className="oracle-signin-secure"><span className="oracle-signin-pulse" />AI Anti-Hacker Active</span>
          </div>

          <button type="submit" disabled={loading} className="oracle-signin-submit">
            {loading ? "One moment…" : isOwnerAccess ? "Sign in as owner" : isSignUp ? "Create my account" : "Sign in"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        {!isOwnerAccess && (
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setShowHelp((v) => !v)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-primary">
              Trouble signing in?
            </button>
            {showHelp && (
              <div className="oracle-signin-help">
                <p className="font-semibold text-foreground">Quick fixes:</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Use a password with <span className="text-foreground">8+ characters</span>.</li>
                  <li>Avoid common passwords — they're auto-blocked.</li>
                  <li>Already have an account? Choose <span className="text-primary">Sign in</span> above.</li>
                  <li>Check your inbox (and spam) for the confirmation email.</li>
                </ul>
                <p className="pt-1">
                  Still stuck? Email <a href="mailto:justinbretthogan@gmail.com" className="text-primary hover:underline">justinbretthogan@gmail.com</a>.
                </p>
              </div>
            )}
          </div>
        )}

        <p className="oracle-signin-legal">
          By continuing you agree to our{" "}
          <Link to="/terms-of-service" className="text-primary hover:underline">Terms</Link> and{" "}
          <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </section>
    </main>
  );
};

export default SignInPage;
