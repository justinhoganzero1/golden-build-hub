import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Shield } from "lucide-react";

const AgeRequiredPage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);

  const maxDate = new Date(
    new Date().getFullYear() - 16,
    new Date().getMonth(),
    new Date().getDate()
  ).toISOString().slice(0, 10);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!dob) { toast.error("Date of birth is required."); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, date_of_birth: dob }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Thanks! Welcome in.");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-[22px] p-7 space-y-5"
        style={{
          background: "linear-gradient(160deg, hsl(0 0% 6% / 0.95), hsl(265 35% 9% / 0.92) 50%, hsl(0 0% 4% / 0.95))",
          border: "1.5px solid hsl(45 100% 55% / 0.5)",
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-primary">Confirm Your Age</h1>
        </div>
        <p className="text-sm text-muted-foreground text-center">
          Oracle Lunar is restricted to users aged <strong className="text-foreground">16 and over</strong>.
          Please enter your date of birth to continue.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="date"
            value={dob}
            max={maxDate}
            min="1900-01-01"
            required
            onChange={(e) => setDob(e.target.value)}
            className="w-full rounded-[14px] px-4 py-3 bg-background/70 border border-primary/40 text-foreground outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-[14px] font-bold text-sm disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(45 100% 55%), hsl(38 100% 50%))",
              color: "hsl(0 0% 8%)",
            }}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
        <button
          onClick={() => signOut()}
          className="w-full text-xs text-muted-foreground hover:text-primary underline"
        >
          Sign out
        </button>
        <p className="text-[10px] text-muted-foreground text-center">
          If you're under 16, you cannot use Oracle Lunar. We do not knowingly collect data
          from anyone under 16.
        </p>
      </div>
    </div>
  );
};

export default AgeRequiredPage;
