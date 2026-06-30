import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function GoogleOAuthCallback() {
  const nav = useNavigate();
  const [msg, setMsg] = useState("Connecting your Google Calendar…");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const err = params.get("error");
      if (err) { setMsg(`Google sign-in cancelled: ${err}`); return; }
      if (!code) { setMsg("Missing authorization code."); return; }

      const redirect_uri = `${window.location.origin}/oauth/google/callback`;
      const { data, error } = await supabase.functions.invoke("google-oauth-callback", {
        body: { code, redirect_uri },
      });
      if (error || (data as any)?.error) {
        setMsg(`Failed to connect: ${error?.message || (data as any)?.error}`);
        return;
      }
      setMsg("Google Calendar connected. Redirecting…");
      setTimeout(() => nav("/admin/voice-receptionist"), 1200);
    })();
  }, [nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">Google Calendar</h1>
        <p className="text-muted-foreground">{msg}</p>
      </div>
    </div>
  );
}
