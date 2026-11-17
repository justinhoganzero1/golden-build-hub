import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GEMINI_KEY_EVENT, type GeminiKeyDetail } from "@/lib/aiAccessEvents";
import { playAhoogaHorn } from "@/lib/ahoogaHorn";

export const GOOGLE_BILLING_URL = "https://console.cloud.google.com/billing";
export const ALARM_HEADLINE = "CHECK GOOGLE KEY IT IS DENYING ACCESS! POSSIBLY NEEDS CREDIT";

const openOutside = (url: string) => {
  const w = window.open(url, "_blank");
  if (w) { try { w.opener = null; } catch { /* ignore */ } } else window.location.href = url;
};

/**
 * Member's own Google key:
 * - not connected yet → a calm "connect your key" card
 * - refused by Google → full-screen alarm (siren, horn, flashing block letters, huge buttons)
 */
const GeminiKeyAlarm = () => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<GeminiKeyDetail | null>(null);

  useEffect(() => {
    const onKey = (e: Event) => {
      const d = (e as CustomEvent<GeminiKeyDetail>).detail;
      setDetail(d);
      if (d?.kind === "problem") playAhoogaHorn();
    };
    window.addEventListener(GEMINI_KEY_EVENT, onKey);
    return () => window.removeEventListener(GEMINI_KEY_EVENT, onKey);
  }, []);

  const close = () => setDetail(null);
  const go = (path: string) => { close(); navigate(path); };

  if (detail?.kind === "required") {
    return (
      <Dialog open onOpenChange={(o) => !o && close()}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Connect your Google key</DialogTitle>
            <DialogDescription>
              Oracle's chat runs on your own free Google Gemini key. I'll walk you through it — it takes about two minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={() => go("/ai-key-setup")}>Set up my key with Oracle</Button>
            <Button variant="ghost" onClick={close}>Not now</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (detail?.kind !== "problem") return null;

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="gemini-alarm-title" aria-describedby="gemini-alarm-desc"
      className="gemini-alarm-backdrop fixed inset-0 z-[200] flex flex-col overflow-y-auto text-foreground">
      <div aria-hidden className="gemini-alarm-wash pointer-events-none absolute inset-0" />
      <div aria-hidden className="gemini-alarm-grain pointer-events-none absolute inset-0" />

      <button type="button" onClick={close} aria-label="Close"
        className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 rounded-full border border-border bg-background/70 p-2 text-muted-foreground hover:text-foreground">
        <X className="h-5 w-5" />
      </button>

      {/* Old-fashioned police siren */}
      <div aria-hidden className="relative mx-auto mt-[max(20px,env(safe-area-inset-top))] flex flex-col items-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-t-full border-2 border-destructive/70 bg-destructive/30 shadow-[0_0_60px_hsl(var(--destructive)/0.8)]">
          <div className="gemini-siren-beams absolute -inset-10" />
          <div className="absolute inset-x-5 bottom-1 top-5 rounded-t-full bg-destructive/70 gemini-alarm-flash" />
        </div>
        <div className="h-3 w-28 rounded-sm bg-muted-foreground/70" />
      </div>

      <div className="relative z-[1] mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center">
        <h2 id="gemini-alarm-title" className="gemini-alarm-flash text-3xl font-black uppercase leading-tight tracking-wide text-destructive sm:text-4xl">
          {ALARM_HEADLINE}
        </h2>
        <p id="gemini-alarm-desc" className="text-sm text-muted-foreground">
          {detail.message || "Google refused your Gemini key."} Oracle's AI is paused until it works again — nothing has been charged to your wallet.
        </p>

        <div className="flex w-full flex-col gap-4">
          <Button onClick={() => openOutside(GOOGLE_BILLING_URL)}
            className="gemini-alarm-btn-topup h-auto min-h-20 w-full whitespace-normal rounded-2xl py-5 text-xl font-black uppercase tracking-wide shadow-[0_0_40px_hsl(var(--primary)/0.6)]">
            Top up Gemini credits
          </Button>
          <Button onClick={() => go("/membership")} variant="destructive"
            className="gemini-alarm-btn-upgrade h-auto min-h-20 w-full whitespace-normal rounded-2xl py-5 text-xl font-black uppercase tracking-wide shadow-[0_0_40px_hsl(var(--destructive)/0.6)]">
            Upgrade Oracle Lunar account
          </Button>
        </div>

        <div className="flex w-full flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => go("/ai-key-setup?fix=1")}>Paste a new key</Button>
          <Button variant="ghost" onClick={close}>I fixed it — try again</Button>
        </div>
      </div>
    </div>
  );
};

export default GeminiKeyAlarm;
