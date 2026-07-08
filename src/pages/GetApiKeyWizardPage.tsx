import { useEffect, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { ExternalLink, ArrowLeft, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type Provider = "openai" | "gemini";

const PROVIDER_CFG: Record<Provider, {
  brand: string;
  agent: string;
  agentPath: string;
  column: "openai_key" | "gemini_key";
  signupUrl: string;
  keysUrl: string;
  billingUrl: string;
  placeholder: string;
  keyLooksLike: string;
}> = {
  openai: {
    brand: "OpenAI",
    agent: "Nova",
    agentPath: "/agents/nova",
    column: "openai_key",
    signupUrl: "https://auth.openai.com/create-account",
    keysUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
    placeholder: "sk-...",
    keyLooksLike: "sk-",
  },
  gemini: {
    brand: "Google Gemini",
    agent: "Lyra",
    agentPath: "/agents/lyra",
    column: "gemini_key",
    signupUrl: "https://accounts.google.com/signup",
    keysUrl: "https://aistudio.google.com/apikey",
    billingUrl: "https://aistudio.google.com/apikey",
    placeholder: "AIza...",
    keyLooksLike: "AIza",
  },
};

// Big italic yes/no page shell — one decision, one page.
const Step = ({
  title,
  body,
  onYes,
  onNo,
  yesLabel = "YES",
  noLabel = "NO",
  extra,
  stepNum,
  total,
  onBack,
}: {
  title: string;
  body?: React.ReactNode;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
  noLabel?: string;
  extra?: React.ReactNode;
  stepNum: number;
  total: number;
  onBack?: () => void;
}) => (
  <div className="min-h-screen bg-background flex flex-col">
    <div className="p-4 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      ) : <div />}
      <div className="text-xs text-muted-foreground">Step {stepNum} of {total}</div>
    </div>

    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full text-center">
      <h1 className="text-3xl sm:text-4xl font-extrabold italic text-foreground leading-tight">
        {title}
      </h1>
      {body && <div className="mt-6 text-lg italic font-semibold text-muted-foreground">{body}</div>}
      {extra && <div className="mt-8 w-full">{extra}</div>}

      <div className="mt-12 w-full grid grid-cols-2 gap-4">
        <button
          onClick={onNo}
          className="h-20 rounded-2xl border-2 border-border bg-card text-2xl font-extrabold italic text-foreground hover:bg-secondary active:scale-95 transition"
        >
          {noLabel}
        </button>
        <button
          onClick={onYes}
          className="h-20 rounded-2xl bg-primary text-primary-foreground text-2xl font-extrabold italic hover:opacity-90 active:scale-95 transition shadow-lg shadow-primary/30"
        >
          {yesLabel}
        </button>
      </div>
    </div>
  </div>
);

const BigLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="w-full inline-flex items-center justify-center gap-2 h-16 rounded-2xl bg-amber-500 text-black text-xl font-extrabold italic hover:bg-amber-400 active:scale-95 transition shadow-lg shadow-amber-500/30"
  >
    {children} <ExternalLink className="w-5 h-5" />
  </a>
);

const GetApiKeyWizardPage = () => {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const cfg = provider && provider in PROVIDER_CFG ? PROVIDER_CFG[provider as Provider] : null;

  const [step, setStep] = useState(1);
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  if (!cfg) return <Navigate to="/agents" replace />;

  const total = 6;
  const back = step > 1 ? () => setStep(step - 1) : () => navigate(cfg.agentPath);

  const save = async () => {
    const clean = keyValue.trim();
    if (clean.length < 10) { toast.error("Hmm — paste your full key first."); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in first."); setSaving(false); return; }
    const { error } = await supabase.from("user_ai_keys").upsert(
      { user_id: user.id, [cfg.column]: clean, updated_at: new Date().toISOString() } as any,
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Done! ${cfg.agent} is now on your own ${cfg.brand} account.`);
    navigate(cfg.agentPath);
  };

  return (
    <>
      <SEO title={`Get your ${cfg.brand} key — Oracle Lunar`} path={`/get-api-key/${provider}`} />

      {step === 1 && (
        <Step
          stepNum={1} total={total} onBack={back}
          title={`Do you want ${cfg.agent} to run on YOUR own ${cfg.brand} account?`}
          body={<>You will pay {cfg.brand} directly. Nothing to us. Ever.</>}
          onYes={() => setStep(2)}
          onNo={() => navigate(cfg.agentPath)}
        />
      )}

      {step === 2 && (
        <Step
          stepNum={2} total={total} onBack={back}
          title={`Do you already have a ${cfg.brand} account?`}
          onYes={() => setStep(4)}
          onNo={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step
          stepNum={3} total={total} onBack={back}
          title={`Tap the gold button. Make your free ${cfg.brand} account.`}
          body={<>Come back here when you are done.</>}
          extra={<BigLink href={cfg.signupUrl}>OPEN {cfg.brand.toUpperCase()} SIGN-UP</BigLink>}
          yesLabel="I MADE IT"
          noLabel="NOT YET"
          onYes={() => setStep(4)}
          onNo={() => { /* stay */ }}
        />
      )}

      {step === 4 && (
        <Step
          stepNum={4} total={total} onBack={back}
          title={`Tap the gold button. It opens your ${cfg.brand} API keys page.`}
          extra={<BigLink href={cfg.keysUrl}>OPEN MY API KEYS PAGE</BigLink>}
          yesLabel="I'M ON THE PAGE"
          noLabel="NOT YET"
          onYes={() => setStep(5)}
          onNo={() => { /* stay */ }}
        />
      )}

      {step === 5 && (
        <Step
          stepNum={5} total={total} onBack={back}
          title={`On that page: click "Create key". Then COPY the key.`}
          body={<>The key starts with <span className="text-primary">{cfg.keyLooksLike}</span></>}
          yesLabel="I COPIED IT"
          noLabel="HELP"
          onYes={() => setStep(6)}
          onNo={() => window.open(cfg.keysUrl, "_blank")}
        />
      )}

      {step === 6 && (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="p-4 flex items-center justify-between">
            <button onClick={back} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="text-xs text-muted-foreground">Step 6 of {total}</div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto w-full text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold italic text-foreground leading-tight">
              Paste your key here.
            </h1>
            <p className="mt-4 text-base italic text-muted-foreground">Then tap SAVE.</p>
            <input
              type="password"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={cfg.placeholder}
              autoComplete="off"
              className="mt-8 w-full h-16 bg-input border-2 border-border rounded-2xl px-4 text-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary text-center"
            />
            <button
              onClick={save}
              disabled={saving || keyValue.trim().length < 10}
              className="mt-6 w-full h-20 rounded-2xl bg-primary text-primary-foreground text-2xl font-extrabold italic disabled:opacity-40 active:scale-95 transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Check className="w-6 h-6" /> SAVE</>}
            </button>
            <p className="mt-6 text-xs text-muted-foreground italic">
              Your key is stored privately. Only you can see it. Only {cfg.agent} uses it.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default GetApiKeyWizardPage;
