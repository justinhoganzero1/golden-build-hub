import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share2, Copy, Youtube, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMovieFormat, type MovieFormat } from "@/lib/movieFormats";
import ResilientVideo from "@/components/ResilientVideo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  title: string;
  /** Format the movie was rendered for. */
  format?: MovieFormat | null;
  description?: string;
  tags?: string[];
}

const safeName = (t: string) =>
  (t || "oracle-lunar-movie").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) ||
  "oracle-lunar-movie";

/**
 * Post-publish share sheet. Always hands over the REAL rendered video file
 * (correct MIME + extension) — never a link back into the app.
 */
const MovieShareDialog = ({ open, onOpenChange, blob, title, format, description, tags }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fmt = getMovieFormat(format?.id);

  const file = useMemo(() => {
    if (!blob) return null;
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const type = blob.type || (ext === "mp4" ? "video/mp4" : "video/webm");
    return new File([blob], `${safeName(title)}.${ext}`, { type });
  }, [blob, title]);

  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  const sizeMb = blob ? (blob.size / (1024 * 1024)).toFixed(1) : "0";

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success(`Saved ${file.name} to your device`);
  };

  const shareFile = async () => {
    if (!file) return;
    setBusy("share");
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title,
          text: description || `${title} — made with Oracle Lunar Movie Studio`,
        });
        toast.success("Shared");
      } else {
        download();
        toast.info("Your browser can't share video files directly — the file downloaded so you can attach it.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("[MovieShare] share failed", e);
        download();
        toast.info("Share sheet unavailable — the file downloaded instead.");
      }
    } finally {
      setBusy(null);
    }
  };

  const copyMeta = async () => {
    const text = [title, description || "", (tags || []).map(t => `#${t.replace(/\s+/g, "")}`).join(" ")]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Title, description and tags copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const openUploader = (dest: "youtube" | "tiktok" | "instagram" | "facebook") => {
    if (file) download();
    const urls: Record<string, string> = {
      youtube: "https://studio.youtube.com/channel/UC/videos/upload",
      tiktok: "https://www.tiktok.com/upload",
      instagram: "https://www.instagram.com/",
      facebook: "https://www.facebook.com/",
    };
    window.open(urls[dest], "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background border-primary/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Share2 className="w-5 h-5" /> Share your movie
          </DialogTitle>
        </DialogHeader>

        <Card className="p-3 space-y-2">
          {previewUrl && (
            <ResilientVideo
              src={previewUrl}
              controls
              className="w-full rounded-md bg-black max-h-64"
            />

          )}
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{file?.name}</strong> · {file?.type || "video"} · {sizeMb} MB ·{" "}
            {fmt.emoji} {fmt.label}
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={shareFile} disabled={!file || busy === "share"} className="h-11">
            {busy === "share" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
            Share the file
          </Button>
          <Button onClick={download} disabled={!file} variant="outline" className="h-11">
            <Download className="w-4 h-4 mr-2" /> Download
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => openUploader("youtube")} disabled={!file} variant="secondary" className="h-10 text-xs">
            <Youtube className="w-4 h-4 mr-2" /> Upload to YouTube
          </Button>
          <Button onClick={() => openUploader("tiktok")} disabled={!file} variant="secondary" className="h-10 text-xs">
            📱 Upload to TikTok
          </Button>
          <Button onClick={() => openUploader("instagram")} disabled={!file} variant="secondary" className="h-10 text-xs">
            📸 Instagram
          </Button>
          <Button onClick={() => openUploader("facebook")} disabled={!file} variant="secondary" className="h-10 text-xs">
            👥 Facebook
          </Button>
        </div>

        <Button onClick={copyMeta} variant="ghost" size="sm" className="text-xs">
          {copied ? <Check className="w-3 h-3 mr-2" /> : <Copy className="w-3 h-3 mr-2" />}
          Copy title, description &amp; hashtags
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          The real video file is handed to the share sheet or uploader — never a link back into the app.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default MovieShareDialog;
