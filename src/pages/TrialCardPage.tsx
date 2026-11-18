import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Film, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { confirmTrialCard, getTrialStatus, type TrialStatus } from "@/lib/trialCard";
import { generateImage, InsufficientCreditsError } from "@/lib/imageGen";
import { generateMemberVideo, VideoPendingError } from "@/lib/videoGeneration";
import officeBackdrop from "@/assets/oracle-office-empty.jpg";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";

/** Free trial home: make the 3 trial pictures and 1 trial video (no card check). */
const TrialCardPage = () => {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [making, setMaking] = useState<null | "image" | "video">(null);
  const [result, setResult] = useState<{ kind: "image" | "video"; url: string } | null>(null);
  const confirmed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let s: TrialStatus;
        if (sessionId && !confirmed.current) {
          confirmed.current = true;
          s = await confirmTrialCard(sessionId);
          if (!cancelled) toast.success("Card verified — your free trial is on!");
          setParams({}, { replace: true });
        } else {
          s = await getTrialStatus();
        }
        if (!cancelled) setStatus(s);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Something went wrong.");
        try { const s = await getTrialStatus(); if (!cancelled) setStatus(s); } catch { /* ignore */ }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const refresh = async () => { try { setStatus(await getTrialStatus()); } catch { /* ignore */ } };

  const make = async (kind: "image" | "video") => {
    const text = prompt.trim();
    if (text.length < 3) { toast.error("Tell me what to make first."); return; }
    setMaking(kind);
    setResult(null);
    try {
      if (kind === "image") {
        const r = await generateImage({ prompt: text, libraryFallback: false, noCache: true });
        setResult({ kind, url: r.url });
        toast.success("Your picture is ready — it's saved in your Library.");
      } else {
        const r = await generateMemberVideo({ prompt: text, duration: 8 });
        setResult({ kind, url: r.video_url });
        toast.success("Your video is ready — it's saved in your Library.");
      }
    } catch (e: any) {
      if (e instanceof InsufficientCreditsError) { /* the trial or upgrade pop-up is already showing */ }
      else if (e instanceof VideoPendingError) toast("Your video is still being made. Check your Library in a few minutes.");
      else toast.error(e?.message || "That didn't work. Your trial item was given back.");
    } finally {
      setMaking(null);
      void refresh();
    }
  };

  const isPaid = status && status.plan !== "free";

  return (
    <main data-no-tab-glow className="oracle-signin">
      <img src={officeBackdrop} alt="" aria-hidden className="oracle-signin-bg" width={848} height={1264} />
      <div aria-hidden className="oracle-signin-scrim" />
      <header className="oracle-signin-header">
        <h1 className="font-semibold text-foreground">Oracle <span className="font-normal text-primary">Lunar</span></h1>
        <p className="mt-1 text-xs text-muted-foreground">Free trial</p>
      </header>

      <section className="oracle-signin-card" aria-labelledby="trial-title">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking…</div>
        ) : isPaid ? (
          <>
            <h2 id="trial-title" className="oracle-signin-title">You're all set</h2>
            <p className="oracle-signin-sub">Your plan already includes these tools — no trial needed.</p>
            <Button asChild className="mt-5 w-full"><Link to="/oracle">Back to Oracle</Link></Button>
          </>
        ) : status?.trial_blocked ? (
          <>
            <h2 id="trial-title" className="oracle-signin-title">Free trial already used</h2>
            <p className="oracle-signin-sub">{status.trial_blocked_message}</p>
            <Button asChild size="lg" className="mt-5 w-full"><Link to="/membership">Upgrade to keep going</Link></Button>
            <Button asChild variant="ghost" className="mt-2 w-full"><Link to="/oracle">Back to Oracle</Link></Button>
          </>
        ) : !status ? (
          <>
            <h2 id="trial-title" className="oracle-signin-title">Free trial</h2>
            <p role="alert" className="oracle-signin-sub">{error || "Your trial details didn't load. Please try again."}</p>
            <Button className="mt-5 w-full" onClick={() => window.location.reload()}>Try again</Button>
          </>
        ) : (
          <>
            <h2 id="trial-title" className="oracle-signin-title flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />{status?.trial_open ? "Your free trial is on" : "Your free trial has finished"}
            </h2>
            <p className="oracle-signin-sub">
              {status?.trial_open ? `No card needed. Trial ends ${fmtDate(status.trial_ends_at)}.` : "Upgrade to keep creating."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-2xl font-bold text-primary">{status.trial_open ? status.images_left : 0}</p>
                <p className="text-xs text-muted-foreground">pictures left</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="text-2xl font-bold text-primary">{status.trial_open ? status.videos_left : 0}</p>
                <p className="text-xs text-muted-foreground">8-second video left</p>
              </div>
            </div>

            {status.trial_open && (status.images_left > 0 || status.videos_left > 0) ? (
              <div className="mt-4 space-y-3">
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={500} rows={3}
                  placeholder="Describe what to make, e.g. a golden retriever surfing at sunset" aria-label="What to make" />
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => make("image")} disabled={!!making || status.images_left < 1}>
                    {making === "image" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />}Picture
                  </Button>
                  <Button variant="secondary" onClick={() => make("video")} disabled={!!making || status.videos_left < 1}>
                    {making === "video" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Film className="mr-1.5 h-4 w-4" />}8-sec video
                  </Button>
                </div>
                {making === "video" && <p className="text-xs text-muted-foreground">Videos take a minute or two — keep this page open.</p>}
              </div>
            ) : (
              <Button asChild size="lg" className="mt-4 w-full"><Link to="/membership">Upgrade to keep creating</Link></Button>
            )}

            {result && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
                {result.kind === "image"
                  ? <img src={result.url} alt="Your trial picture" className="w-full" />
                  : <video src={result.url} controls playsInline className="w-full" />}
              </div>
            )}
            <Button asChild variant="ghost" className="mt-3 w-full"><Link to="/media-library">Open my Library</Link></Button>
          </>
        )}
      </section>
    </main>
  );
};

export default TrialCardPage;
