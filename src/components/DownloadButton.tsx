import { ReactNode, useState } from "react";
import { Download, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadFileFromUrl } from "@/lib/utils";

interface DownloadButtonProps {
  url: string;
  filename: string;
  /** Visible label. Defaults to "Download". */
  label?: ReactNode;
  /** Tailwind classes applied to the underlying Button */
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** When true, render only the icon (no label) */
  iconOnly?: boolean;
}

/**
 * Universal, fault-tolerant download button.
 * - Tries fetch+blob (best UX), then direct anchor, then opens in new tab.
 * - Surfaces a toast for every outcome so users always know what happened.
 */
export const DownloadButton = ({
  url,
  filename,
  label = "Download",
  className,
  size = "sm",
  variant = "outline",
  iconOnly = false,
}: DownloadButtonProps) => {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!url) {
      toast.error("Nothing to download yet.");
      return;
    }
    setBusy(true);
    try {
      const result = await downloadFileFromUrl(url, filename);
      if (result === "saved") toast.success("Saved to your device.");
      else if (result === "opened") toast.info("Opened in a new tab — long-press to save.");
      else toast.error("Download failed. Try the Open link instead.");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={handle}
      disabled={busy || !url}
      aria-label={typeof label === "string" ? label : "Download"}
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className={iconOnly ? "w-3.5 h-3.5" : "w-3.5 h-3.5 mr-1"} />
      )}
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
};

/** Sibling open-in-new-tab button for the universal "Download | Open" pair. */
export const OpenButton = ({
  url,
  className,
  size = "sm",
  variant = "outline",
  label = "Open",
}: {
  url: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: ReactNode;
}) => (
  <Button asChild size={size} variant={variant} className={className} disabled={!url}>
    <a href={url} target="_blank" rel="noopener noreferrer">
      <ExternalLink className="w-3.5 h-3.5 mr-1" />
      {label}
    </a>
  </Button>
);

export default DownloadButton;
