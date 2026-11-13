import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { markBirthdayDone } from "@/hooks/useBirthdayGate";
import { checkBirthday, latestAllowedBirthday, MIN_AGE } from "@/lib/birthdayGate";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";

/** One-time birthday step for accounts (e.g. Google sign-ups) that skipped it. */
const AgeRequiredPage = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [tooYoung, setTooYoung] = useState(false);

  if (loading) return <main className="oracle-signin" />;
  if (!user) return <Navigate to="/sign-in" replace />;

  const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const next = from?.pathname && from.pathname !== "/age-required" ? `${from.pathname}${from.search || ""}` : "/oracle";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = checkBirthday(dob);
    if (check === "missing") { toast.error("Please enter your birthday."); return; }
    if (check === "invalid") { toast.error("Please enter a real birthday."); return; }
    if (check === "too-young") { setTooYoung(true); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, date_of_birth: dob }, { onConflict: "user_id" });
      if (error) throw error;
      markBirthdayDone(user.id);
      toast.success("Thanks! Welcome in.");
      navigate(next, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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

      <section className="oracle-signin-card" aria-labelledby="birthday-title">
        {tooYoung ? (
          <>
            <h2 id="birthday-title" className="oracle-signin-title">Sorry, not yet</h2>
            <p className="oracle-signin-sub">
              Oracle Lunar is for people aged {MIN_AGE} and over. Please come back when you're {MIN_AGE}.
              If you need to talk to someone now, Kids Helpline is free on 1800 55 1800.
            </p>
            <button type="button" className="oracle-signin-submit mt-6" onClick={() => signOut()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <h2 id="birthday-title" className="oracle-signin-title">One quick thing</h2>
            <p className="oracle-signin-sub">What's your birthday? Oracle Lunar is for people aged {MIN_AGE} and over. We only ask once.</p>
            <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3">
              <div>
                <label className="oracle-signin-field">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <span className="oracle-signin-inline-label">Birthday</span>
                  <input
                    type="date"
                    aria-label={`Date of birth (must be ${MIN_AGE} or over)`}
                    value={dob}
                    max={latestAllowedBirthday()}
                    min="1900-01-01"
                    required
                    onChange={(e) => setDob(e.target.value)}
                  />
                </label>
                <p className="oracle-signin-hint">Kept private on your account. Never shown to anyone.</p>
              </div>
              <button type="submit" disabled={saving} className="oracle-signin-submit">
                {saving ? "Saving…" : "Continue"}
              </button>
            </form>
            <button type="button" onClick={() => signOut()} className="mt-4 w-full text-xs text-muted-foreground underline hover:text-primary">
              Not you? Sign out
            </button>
          </>
        )}
      </section>
    </main>
  );
};

export default AgeRequiredPage;
