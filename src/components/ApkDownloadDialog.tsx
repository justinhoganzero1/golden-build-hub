import { Download, ShieldCheck, AlertTriangle, Smartphone } from "lucide-react";
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

interface ApkDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Honest, friendly download dialog for sideloading the Android .apk
 * directly from our portal. Explains the scary Android warnings up
 * front so users don't bail when they see them.
 */
const ApkDownloadDialog = ({ open, onOpenChange }: ApkDownloadDialogProps) => {
  const onAndroid = isAndroidDevice();
  const apkReady = hasDirectApk();

  const handleDownload = () => {
    if (!apkReady) return;
    trackInstallEvent("click", "android");
    // Force a real file download (not navigation) where possible.
    const a = document.createElement("a");
    a.href = ANDROID_APK_URL;
    a.download = `oracle-lunar-${ANDROID_APK_VERSION}.apk`;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Install Oracle Lunar on Android
          </DialogTitle>
          <DialogDescription>
            Direct download from our portal — no Play Store account needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Safety reassurance */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Safe for your device</p>
              <p className="text-muted-foreground text-xs mt-1">
                Oracle Lunar is built and signed by us. We don't collect anything
                we don't need, and the app contains no malware, no trackers, and
                no hidden ads. You can uninstall anytime in one tap.
              </p>
            </div>
          </div>

          {/* Honest warning */}
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">
                You'll see scary-looking warnings — that's normal
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                We're a young, growing company and aren't yet listed on the Google
                Play Store, so Android shows the same warnings it shows for any
                app installed outside Play. Expect:
              </p>
              <ul className="text-muted-foreground text-xs mt-2 space-y-1 list-disc pl-4">
                <li>"This type of file can harm your device"</li>
                <li>"Install unknown apps?" → tap <strong>Settings → Allow</strong></li>
                <li>"Play Protect doesn't recognise this app" → tap <strong>Install anyway</strong></li>
              </ul>
              <p className="text-muted-foreground text-xs mt-2">
                These are Android's default messages for any sideloaded app — not
                a sign that anything is wrong with Oracle Lunar.
              </p>
            </div>
          </div>

          {/* Step-by-step */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-semibold text-foreground mb-2">How to install</p>
            <ol className="text-muted-foreground text-xs space-y-1.5 list-decimal pl-4">
              <li>Tap <strong>Download .apk</strong> below.</li>
              <li>When the file finishes, open it from your notifications or Downloads folder.</li>
              <li>If asked, allow your browser to install apps (one-time setting).</li>
              <li>Tap <strong>Install</strong>, then <strong>Open</strong> — you're in!</li>
            </ol>
            {!onAndroid && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                You appear to be on a computer or iPhone — you can still download
                the .apk and transfer it, but it only installs on Android phones
                and tablets.
              </p>
            )}
          </div>

          {!apkReady && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              The Android app file isn't published yet. We're putting the
              finishing touches on it — check back very soon!
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!apkReady}
            className="bg-primary hover:bg-primary/90"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Download .apk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ApkDownloadDialog;
