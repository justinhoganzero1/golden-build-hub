import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Mic, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMembership } from "@/hooks/useMembership";
import { useAuth } from "@/contexts/AuthContext";
import { markGeminiSetupDone } from "@/hooks/useGeminiSetupGate";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";

type Step = { id: string; oracleSays: string; notice: string };
type Status = {
  steps: Step[];
  agreed_steps: string[];
  has_key: boolean;
  verified: boolean;
  key_status: string | null;
  key_problem: string | null;
  key_page: string;
  terms_page: string;
};

async function setupCall(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gemini-key-setup", { body });
  if (error) {
    const res: Response | undefined = (error as any)?.context;
    const detail = res && typeof res.clone === "function" ? await res.clone().json().catch(() => null) : null;
    throw new Error(detail?.message || "Something went wrong. Please try again.");
  }
  return data;
}

const openOutside = (url: string) => {
  const w = window.open(url, "_blank");
  if (w) { try { w.opener = null; } catch { /* ignore */ } } else window.location.href = url;
};

/** Listens once and returns what was said (device speech service; nothing paid or stored as audio). */
function listenOnce(): Promise<string> {
  return new Promise((resolve, reject) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { reject(new Error("Voice isn't available on this device — tap I agree instead.")); return; }
    const rec = new SR();
    rec.lang = "en-AU";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let heard = "";
    rec.onresult = (e: any) => { heard = String(e?.results?.[0]?.[0]?.transcript || ""); };
    rec.onerror = (e: any) => reject(new Error(e?.error === "not-allowed" ? "Microphone permission was refused." : "I didn't catch that — try again or tap I agree."));
    rec.onend = () => (heard ? resolve(heard) : reject(new Error("I didn't hear anything — try again or tap I agree.")));
    try { rec.start(); } catch { reject(new Error("Voice couldn't start — tap I agree instead.")); }
  });
}

/** Oracle walks the member through connecting their own Google Gemini key, one agreement at a time. */
const AiKeySetupPage = () => {
  const [params] = useSearchParams();
  const fixMode = params.get("fix") === "1";
  const { plan } = useMembership();
  const { user, signOut } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "tap" | "voice" | "key">(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(fixMode);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try { setStatus(await setupCall({ action: "status" })); setLoadError(null); }
    catch (e: any) { setLoadError(e?.message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [status?.agreed_steps.length, replacing]);

  const steps = status?.steps ?? [];
  const agreed = new Set(status?.agreed_steps ?? []);
  const current = steps.find((s) => !agreed.has(s.id));
  const allAgreed = steps.length > 0 && !current;

  const agree = async (method: "tap" | "voice") => {
    if (!current) return;
    setBusy(method);
    setHeard(null);
    try {
      let spoken: string | undefined;
      if (method === "voice") {
        toast("Listening… say \"Yes, I agree\"");
        spoken = await listenOnce();
        setHeard(spoken);
      }
      const r = await setupCall({ action: "consent", step: current.id, method, spoken_words: spoken });
      setStatus((s) => (s ? { ...s, agreed_steps: r.agreed_steps } : s));
    } catch (e: any) {
      toast.error(e?.message);
    } finally {
      setBusy(null);
    }
  };

  const saveKey = async () => {
    setBusy("key");
    setKeyError(null);
    try {
      await setupCall({ action: "save_key", key: key.trim() });
      if (user) markGeminiSetupDone(user.id);
      setKey("");
      setReplacing(false);
      toast.success("Your Google key works — Oracle is ready to chat!");
      await load();
    } catch (e: any) {
      setKeyError(e?.message);
    } finally {
      setBusy(null);
    }
  };

  const connected = status?.verified && status.key_status !== "failed";

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <header className="oracle-signin-header">
        <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
        <p className="mt-1 text-xs text-muted-foreground">Connect your Google Gemini key</p>
      </header>

      <section className="oracle-signin-card" aria-labelledby="key-title">
        <h2 id="key-title" className="oracle-signin-title flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Your own AI key</h2>

        {!status && !loadError && <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>}
        {loadError && (
          <div className="mt-3 space-y-3">
            <p role="alert" className="text-sm text-destructive">{loadError}</p>
            <Button onClick={() => void load()} className="w-full">Try again</Button>
          </div>
        )}

        {status && (
          <div className="mt-3 space-y-3" aria-live="polite">
            {/* Agreements already given */}
            {steps.filter((s) => agreed.has(s.id)).map((s) => (
              <div key={s.id} className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{s.notice}</span>
              </div>
            ))}

            {/* Current agreement */}
            {current && (
              <div className="space-y-3">
                <p className="rounded-2xl rounded-tl-sm bg-background/60 p-3 text-sm text-foreground">
                  <span className="font-semibold text-primary">Oracle: </span>{current.oracleSays}
                </p>
                <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Agreement {steps.indexOf(current) + 1} of {steps.length}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{current.notice}</p>
                  {current.id === "age_and_google_terms" && (
                    <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => openOutside(status.terms_page)}>Read Google's Gemini terms</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => void agree("tap")} disabled={!!busy}>
                    {busy === "tap" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}I agree
                  </Button>
                  <Button variant="outline" onClick={() => void agree("voice")} disabled={!!busy}>
                    {busy === "voice" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mic className="mr-1.5 h-4 w-4" />}Say "yes"
                  </Button>
                </div>
                {heard && <p className="text-xs text-muted-foreground">I heard: "{heard}"</p>}
                <p className="text-xs text-muted-foreground">Each agreement is kept on your account as a record (words only — no voice recording).</p>
              </div>
            )}

            {/* Key step */}
            {allAgreed && (!connected || replacing) && (
              <div className="space-y-3">
                <p className="rounded-2xl rounded-tl-sm bg-background/60 p-3 text-sm text-foreground">
                  <span className="font-semibold text-primary">Oracle: </span>
                  {status.key_problem && fixMode
                    ? "Google stopped accepting your key. Let's pop in a fresh one."
                    : "Thank you! Now let's get your key. Google needs you to make it yourself — I'll wait right here."}
                </p>
                <ol className="space-y-1 text-sm text-foreground">
                  <li>1. Tap <strong>Open Google AI Studio</strong> and sign in with Google.</li>
                  <li>2. Tap <strong>Create API key</strong>, then copy it.</li>
                  <li>3. Come back and paste it below.</li>
                </ol>
                <Button variant="outline" className="w-full" onClick={() => openOutside(status.key_page)}>
                  <ExternalLink className="mr-1.5 h-4 w-4" />Open Google AI Studio
                </Button>
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Paste your key (starts with AIza or AQ.)"
                  autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Your Google Gemini key" />
                {keyError && <p role="alert" className="text-sm text-destructive">{keyError}</p>}
                <Button className="w-full" onClick={() => void saveKey()} disabled={busy === "key" || key.trim().length < 20}>
                  {busy === "key" ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Checking with Google…</> : "Check and save my key"}
                </Button>
                <p className="text-xs text-muted-foreground">Your key is stored privately on your account and only used for your own AI requests.</p>
              </div>
            )}

            {allAgreed && connected && !replacing && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-foreground"><CheckCircle2 className="h-5 w-5 text-primary" />Your Google key is connected and working.</p>
                {plan === "free" && (
                  <p className="rounded-md border border-border/60 bg-background/40 p-2 text-xs text-muted-foreground">
                    Chatting with Oracle's AI also needs a Plus or Pro plan. <Link to="/membership" className="text-primary underline">See plans</Link>
                  </p>
                )}
                <Button asChild className="w-full"><Link to="/oracle">Chat with Oracle</Link></Button>
                <Button variant="ghost" className="w-full" onClick={() => setReplacing(true)}>Replace my key</Button>
              </div>
            )}
          </div>
        )}
        {!connected && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Connecting your Google key is the last step of setting up your account.{" "}
            <Link to="/crisis-hub" className="text-primary underline">Need help now?</Link>{" · "}
            <button type="button" className="text-primary underline" onClick={() => void signOut()}>Sign out</button>
          </p>
        )}
        <div ref={bottom} />
      </section>
    </main>
  );
};

export default AiKeySetupPage;
