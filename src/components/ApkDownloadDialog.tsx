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
  ANDROID_APK_URL,
  ANDROID_APK_VERSION,
  hasDirectApk,
  isAndroidDevice,
} from "@/lib/installRedirect";
import { trackInstallEvent } from "@/lib/installAnalytics";
import { cn } from "@/lib/utils";

interface ApkDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "intro" | "guide" | "result";

const STEPS = [
  {
    key: "download",
    title: "Tap Download .apk",
    body: "The file (~30 MB) saves to your Downloads folder.",
  },
  {
    key: "open",
    title: "Open the file",
    body: "Tap the download notification, or open it from your Downloads folder.",
  },
  {
    key: "allow",
    title: 'Allow "unknown apps" (one time)',
    body: 'Android may ask: "Allow this browser to install apps?" → tap Settings → Allow.',
  },
  {
    key: "install",
    title: "Tap Install, then Open",
    body: 'You may see "Play Protect doesn\'t recognise this app" → tap Install anyway. We are safe.',
  },
] as const;

const ApkDownloadDialog = ({ open, onOpenChange }: ApkDownloadDialogProps) => {
  const onAndroid = isAndroidDevice();
  const apkReady = hasDirectApk();
  const [phase, setPhase] = useState<Phase>("intro");
  const [stepIdx, setStepIdx] = useState(0);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (open) {
      setPhase("intro");
      setStepIdx(0);
    }
  }, [open]);

  const startDownload = () => {
    if (!apkReady) return;
    trackInstallEvent("download_start", "android");
    const a = document.createElement("a");
    a.href = ANDROID_APK_URL;
    a.download = `oracle-lunar-${ANDROID_APK_VERSION}.apk`;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Hand off to the in-app guided checklist.
    trackInstallEvent("guide_open", "android");
    setPhase("guide");
    setStepIdx(1); // step 0 (download) is already done
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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            {phase === "intro" && "Install Oracle Lunar on Android"}
            {phase === "guide" && "Almost there — follow these steps"}
            {phase === "result" && "Did the install work?"}
          </DialogTitle>
          <DialogDescription>
            {phase === "intro" && "One tap to download, guided steps after — no Play Store account needed."}
            {phase === "guide" && "Tap each step as you complete it on your phone."}
            {phase === "result" && "Your feedback helps us make this smoother."}
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

        <DialogFooter className="gap-2 sm:gap-2">
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
              <Button onClick={completeStep} className="bg-primary hover:bg-primary/90">
                {stepIdx >= STEPS.length - 1 ? "I'm installed" : "I did this — next"}
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
    </Dialog>
  );
};

export default ApkDownloadDialog;
