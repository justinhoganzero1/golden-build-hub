import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Phone, ShieldCheck, Loader2 } from "lucide-react";

const VerifyPhonePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"enter" | "verify">("enter");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const trimmed = phone.trim();
    if (!/^\+\d{8,15}$/.test(trimmed)) {
      toast.error("Enter phone in international format e.g. +614xxxxxxxx");
      return;
    }
    setBusy(true);
    try {
      // Attach phone to existing account, triggers SMS OTP via Supabase Auth
      const { error } = await supabase.auth.updateUser({ phone: trimmed });
      if (error) throw error;
      toast.success("Code sent — check your messages");
      setStage("verify");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: code.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      toast.success("Phone verified — welcome in");
      navigate(redirect, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Verify your phone</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Required once per account. Protects your wallet, content and AI usage.
          Signed in as <span className="text-foreground">{user?.email}</span>.
        </p>

        {stage === "enter" ? (
          <>
            <label className="text-xs text-muted-foreground">Mobile number</label>
            <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3">
              <Phone className="w-4 h-4 text-primary" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+61412345678"
                className="flex-1 bg-transparent py-2 text-sm text-foreground outline-none"
                inputMode="tel"
                autoFocus
              />
            </div>
            <button
              onClick={sendCode}
              disabled={busy}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Send 6-digit code
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-muted-foreground">Enter code sent to {phone}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-center text-xl tracking-widest text-foreground outline-none"
              inputMode="numeric"
              autoFocus
            />
            <button
              onClick={verify}
              disabled={busy}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify & continue
            </button>
            <button
              onClick={() => setStage("enter")}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Use a different number
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyPhonePage;
