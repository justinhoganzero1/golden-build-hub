import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { downloadApkWithProgress } from "@/lib/installRedirect";

interface ApkDownloadProgressProps {
  open: boolean;
  /** Download finished (or the browser's own downloader took over) — popup vanishes and the flow continues. */
  onDone: () => void;
  /** User cancelled the download. */
  onCancel: () => void;
}

const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/**
 * Shown while the Android app file downloads. Warns the visitor it can take
 * several minutes so they don't think it failed, shows live progress, and
 * vanishes by itself the moment the file is saved.
 */
const ApkDownloadProgress = ({ open, onDone, onCancel }: ApkDownloadProgressProps) => {
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    settledRef.current = false;
    setLoaded(0);
    setTotal(null);
    const controller = new AbortController();
    abortRef.current = controller;
    downloadApkWithProgress(
      (p) => {
        setLoaded(p.loaded);
        setTotal(p.total);
      },
      controller.signal,
    ).then((result) => {
      if (settledRef.current) return;
      settledRef.current = true;
      if (result.ok) onDone();
      // Aborted → the cancel handler already ran.
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cancel = () => {
    abortRef.current?.abort();
    if (!settledRef.current) {
      settledRef.current = true;
      onCancel();
    }
  };

  const pct = total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) cancel();
      }}
    >
      <DialogContent
        className="max-w-sm"
        data-auth-allow
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary animate-bounce" />
            Downloading Oracle Lunar…
          </DialogTitle>
          <DialogDescription>
            This can take a few minutes depending on your connection — it has
            not failed. Please keep this page open until it finishes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            {pct !== null ? (
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            ) : (
              <div className="h-full w-1/3 bg-primary animate-pulse" />
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {pct !== null
              ? `${pct}% — ${formatMb(loaded)} of ${formatMb(total ?? 0)} MB`
              : `${formatMb(loaded)} MB downloaded…`}
          </p>
        </div>

        <Button variant="ghost" onClick={cancel}>
          <X className="h-4 w-4 mr-1.5" />
          Cancel download
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ApkDownloadProgress;
