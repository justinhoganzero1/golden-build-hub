import { useEffect, useState } from "react";
import {
  Download,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  CheckCircle2,
  Circle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  hasDirectApk,
  isAndroidDevice,
} from "@/lib/installRedirect";
import ApkDownloadProgress from "@/components/ApkDownloadProgress";
import { trackInstallEvent } from "@/lib/installAnalytics";
import { cn } from "@/lib/utils";

interface ApkDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The download already started from the Install tap — open straight on the finishing steps. */
  downloadStarted?: boolean;
}

type Phase = "intro" | "guide" | "result" | "help";

/** What Android said when the install failed, with the fix for each. */
export const INSTALL_PROBLEMS = [
  {
    key: "not_installed",
    message: '"App not installed"',
    fix: "An older Oracle Lunar is in the way. Press and hold the Oracle Lunar icon → Uninstall (this only removes the old app; your account and Library stay safe online). Then open oracle-lunar.apk from Downloads again.",
  },
  {
    key: "parse_error",
    message: '"There was a problem parsing the package"',
    fix: "The file didn't finish downloading properly. Delete oracle-lunar.apk from Downloads, then tap Download again below on Wi-Fi.",
  },
  {
    key: "play_protect",
    message: '"Blocked by Play Protect" or "Unsafe app blocked"',
    fix: "Tap More details (or the small arrow), then Install anyway. It's Google's warning for any app that isn't from the Play Store yet.",
  },
  {
    key: "wont_open",
    message: "It installed, but closes or stays blank when opened",
    fix: "Turn the phone off and on, then open Oracle Lunar again. If it still won't open, use the web app instead: close this, tap Install at the top of the page and choose Install when Chrome asks.",
  },
] as const;

const STEPS = [
  {
    key: "download",
    title: "Let the download finish",
    body: 'A bar appears at the bottom of the screen. If it says "File might be harmful", tap Download anyway. Wait until it says Open (about 19 MB — under a minute on Wi-Fi).',
  },
  {
    key: "open",
    title: "Open the file",
    body: "Tap Open on that bar, or open oracle-lunar.apk from your Downloads folder (Files app → Downloads).",
  },
  {
    key: "allow",
    title: 'Android blocks it? Tap Settings — not Cancel',
    body: 'If it says your phone "isn\'t allowed to install unknown apps from this source", tap Settings → turn on "Allow from this source" → press Back. Then tap Install. You only do this once.',
  },
  {
    key: "install",
    title: "Tap Install, then Open",
    body: 'You may see "Play Protect doesn\'t recognise this app" → tap More details → Install anyway. We are safe.',
  },
] as const;

/** Picture of Android's block message with the right button circled. */
const TapSettingsCard = () => (
  <div className="rounded-lg border-2 border-primary bg-primary/10 p-3 space-y-2" data-testid="tap-settings-card">
    <p className="font-semibold text-sm text-foreground">
      Important: when Android shows this, tap <span className="text-primary">Settings</span> — not Cancel
    </p>
    <div className="rounded-2xl bg-card border border-border p-3 text-xs text-muted-foreground shadow-inner" aria-hidden>
      <p className="font-semibold text-foreground mb-1">Chrome</p>
      <p>For your security, your phone currently isn't allowed to install unknown apps from this source…</p>
      <div className="mt-2 flex justify-end gap-4 font-semibold">
        <span className="opacity-50 line-through">Cancel</span>
        <span className="rounded-full px-2 py-0.5 text-primary ring-2 ring-primary animate-pulse">Settings ←</span>
      </div>
    </div>
    <p className="text-xs text-muted-foreground">
      Then switch on <b className="text-foreground">Allow from this source</b>, press <b className="text-foreground">Back</b>, and tap <b className="text-foreground">Install</b>.
      It's a normal Android safety check for apps not from the Play Store, and you only do it once.
      Tapped Cancel by mistake? Open <b className="text-foreground">oracle-lunar.apk</b> from your Downloads again.
    </p>
  </div>
);

const ApkDownloadDialog = ({ open, onOpenChange, downloadStarted = false }: ApkDownloadDialogProps) => {
  const onAndroid = isAndroidDevice();
  const apkReady = hasDirectApk();
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIdx, setStepIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPhase(downloadStarted ? "guide" : "intro");
      setStepIdx(0);
      setProblem(null);
    }
  }, [open, downloadStarted]);

  const startDownload = () => {
    if (!apkReady) return;
    trackInstallEvent("download_start", "android");
    // Show the "can take a few minutes" popup; it vanishes when the file is
    // saved and hands off to the guided checklist.
    setDownloading(true);
  };

  const downloadFinished = () => {
    setDownloading(false);
    trackInstallEvent("guide_open", "android");
    setPhase("guide");
    setStepIdx(0);
  };

  const completeStep = () => {
    const next = stepIdx + 1;
    trackInstallEvent("step_complete", "android", STEPS[stepIdx]?.key);
    if (next >= STEPS.length) {
      setPhase("result");
    } else {
      setStepIdx(next);
    }
  };

  const reportSuccess = () => {
    trackInstallEvent("install_success", "android");
    onOpenChange(false);
  };

  const reportFailure = () => {
    trackInstallEvent("install_failure", "android");
    setPhase("help");
  };

  const [problem, setProblem] = useState<string | null>(null);
  const pickProblem = (key: string) => {
    setProblem(key);
    trackInstallEvent("install_failure", "android", `problem:${key}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" data-auth-allow>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {phase === "intro" && "Install Oracle Lunar on Android"}
            {phase === "guide" && "Almost there — follow these steps"}
            {phase === "result" && "Did the install work?"}
            {phase === "help" && "Let's fix it — what did Android say?"}
          </DialogTitle>
          <DialogDescription>
            {phase === "intro" && "One tap to download, guided steps after — no Play Store account needed."}
            {phase === "guide" && "Tap each step as you complete it on your phone."}
            {phase === "result" && "Your feedback helps us make this smoother."}
            {phase === "help" && "Tap the message that looks most like what you saw."}
          </DialogDescription>
        </DialogHeader>

        {/* INTRO PHASE */}
        {phase === "intro" && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Safe for your device</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Oracle Lunar is built and signed by us. No malware, no trackers,
                  no hidden ads. Uninstall anytime in one tap.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  You'll see scary-looking warnings — that's normal
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  We're a young, growing company and aren't yet on the Play Store,
                  so Android shows the same warnings it shows for any sideloaded
                  app. We'll guide you through them step by step.
                </p>
              </div>
            </div>

            <TapSettingsCard />

            {!onAndroid && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground italic">
                You appear to be on a computer or iPhone — you can still download
                the .apk and transfer it, but it only installs on Android devices.
              </div>
            )}

            {!apkReady && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                The Android app file isn't published yet. Check back very soon!
              </div>
            )}
          </div>
        )}

        {/* GUIDE PHASE — step-by-step checklist */}
        {phase === "guide" && <TapSettingsCard />}
        {phase === "guide" && (
          <ol className="space-y-2">
            {STEPS.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <li
                  key={s.key}
                  className={cn(
                    "rounded-lg border p-3 flex gap-3 transition-all",
                    done && "border-primary/40 bg-primary/5 opacity-70",
                    active && "border-primary bg-primary/10 shadow-md",
                    !done && !active && "border-border bg-muted/20 opacity-60",
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Circle
                      className={cn(
                        "h-5 w-5 shrink-0 mt-0.5",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">
                      {i + 1}. {s.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* RESULT PHASE — capture success/failure */}
        {phase === "result" && (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              If Oracle Lunar opened on your phone — you're done! 🎉 If something
              went wrong, let us know and we'll improve the guide.
            </p>
          </div>
        )}

        {/* HELP PHASE — the fix for the exact message Android showed */}
        {phase === "help" && (
          <ul className="space-y-2" data-testid="install-help">
            {INSTALL_PROBLEMS.map((p) => {
              const picked = problem === p.key;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => pickProblem(p.key)}
                    aria-expanded={picked}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-all",
                      picked ? "border-primary bg-primary/10 shadow-md" : "border-border bg-muted/20",
                    )}
                  >
                    <p className="font-semibold text-sm text-foreground">{p.message}</p>
                    {picked && <p className="text-xs text-muted-foreground mt-1">{p.fix}</p>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          {phase === "intro" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Maybe later
              </Button>
              <Button
                onClick={startDownload}
                disabled={!apkReady}
                className="bg-primary hover:bg-primary/90"
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download .apk
              </Button>
            </>
          )}
          {phase === "guide" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {stepIdx <= 1 && apkReady && (
                <Button variant="outline" onClick={() => { trackInstallEvent("download_start", "android", "retry"); setDownloading(true); }}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download again
                </Button>
              )}
              <Button onClick={completeStep} className="bg-primary hover:bg-primary/90">
                {stepIdx >= STEPS.length - 1 ? "I'm installed" : stepIdx === 0 ? "It finished — next" : "I did this — next"}
              </Button>
            </>
          )}
          {phase === "help" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {apkReady && (
                <Button variant="outline" onClick={() => { trackInstallEvent("download_start", "android", "retry-help"); setDownloading(true); }}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download again
                </Button>
              )}
              <Button onClick={reportSuccess} className="bg-primary hover:bg-primary/90">
                <ThumbsUp className="h-4 w-4 mr-1.5" />
                That fixed it
              </Button>
            </>
          )}
          {phase === "result" && (
            <>
              <Button variant="outline" onClick={reportFailure}>
                <ThumbsDown className="h-4 w-4 mr-1.5" />
                Had a problem
              </Button>
              <Button onClick={reportSuccess} className="bg-primary hover:bg-primary/90">
                <ThumbsUp className="h-4 w-4 mr-1.5" />
                Worked perfectly
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
      <ApkDownloadProgress
        open={downloading}
        onDone={downloadFinished}
        onCancel={() => setDownloading(false)}
      />
    </Dialog>
  );
};

export default ApkDownloadDialog;
