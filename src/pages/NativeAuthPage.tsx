import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { appReturnLink, sealSession } from "@/lib/nativeGoogleAuth";

// Opened in Chrome by the installed app: signs in with Google on oraclelunar.com,
// then hands the session back to the app sealed with the app's one-time key.
const PAGE_KEY = "ol_native_auth_page_key";

export default function NativeAuthPage() {
  const [status, setStatus] = useState<"working" | "returning" | "error" | "nokey">("working");
  const [link, setLink] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const m = /[#&]k=([A-Za-z0-9_-]{40,})/.exec(window.location.hash);
    if (m) {
      sessionStorage.setItem(PAGE_KEY, m[1]);
      history.replaceState(null, "", window.location.pathname);
    }
    const k = sessionStorage.getItem(PAGE_KEY);
    if (!k) { setStatus("nokey"); return; }

    const handOff = async (s: { access_token: string; refresh_token: string }) => {
      if (started.current) return;
      started.current = true;
      try {
        const href = appReturnLink(await sealSession(k, s));
        sessionStorage.removeItem(PAGE_KEY);
        setLink(href);
        setStatus("returning");
        window.location.href = href;
      } catch { setStatus("error"); }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void handOff(session);
    });
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return handOff(data.session);
      if (sessionStorage.getItem(PAGE_KEY + "_tried")) return; // came back without a session
      sessionStorage.setItem(PAGE_KEY + "_tried", "1");
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/native-auth` });
      if (r.error) setStatus("error");
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  const retry = async () => {
    sessionStorage.removeItem(PAGE_KEY + "_tried");
    setStatus("working");
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/native-auth` });
    if (r.error) setStatus("error");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Oracle <span className="text-primary">Lunar</span></h1>
        {status === "working" && <p className="text-muted-foreground">Signing you in with Google…</p>}
        {status === "returning" && (
          <>
            <p className="text-muted-foreground">Signed in. Taking you back to the app…</p>
            {link && <Button asChild className="w-full"><a href={link}>Back to Oracle Lunar</a></Button>}
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-muted-foreground">Google sign-in didn't finish.</p>
            <Button className="w-full" onClick={() => void retry()}>Try again</Button>
          </>
        )}
        {status === "nokey" && <p className="text-muted-foreground">Please open this from the Oracle Lunar app's sign-in screen.</p>}
      </div>
    </main>
  );
}
