import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Mail, Phone, Share2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url?: string;
  imageUrl?: string;
  description?: string;
}

const ShareDialog = ({ open, onOpenChange, title, url, imageUrl, description }: ShareDialogProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const shareUrl = url || imageUrl || window.location.href;
  const shareText = description || `Check out "${title}" on Solace!`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const shareViaEmail = () => {
    if (!email.trim()) { toast.error("Enter an email"); return; }
    const subject = encodeURIComponent(`Check this out: ${title}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
    toast.success("Opening email client...");
    setEmail("");
  };

  const shareViaSMS = () => {
    if (!phone.trim()) { toast.error("Enter a phone number"); return; }
    const body = encodeURIComponent(`${shareText} ${shareUrl}`);
    window.open(`sms:${phone}?body=${body}`, "_blank");
    toast.success("Opening messaging app...");
    setPhone("");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url: shareUrl });
      } catch (e: any) {
        if (e.name !== "AbortError") toast.error("Share failed");
      }
    } else {
      toast.error("Native sharing not supported on this device");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="w-5 h-5 text-primary" /> Share "{title}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Copy Link */}
          <button onClick={copyLink} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary transition-all">
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-primary" />}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">{copied ? "Copied!" : "Copy Link"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{shareUrl}</p>
            </div>
          </button>

          {/* Native Share */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button onClick={nativeShare} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <ExternalLink className="w-5 h-5 text-primary" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">Share via Apps</p>
                <p className="text-[10px] text-muted-foreground">WhatsApp, Facebook, Twitter & more</p>
              </div>
            </button>
          )}

          {/* Email */}
          <div className="rounded-xl bg-card border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Share via Email</p>
            </div>
            <div className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="recipient@email.com" className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <button onClick={shareViaEmail} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Send</button>
            </div>
          </div>

          {/* SMS */}
          <div className="rounded-xl bg-card border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Share via SMS</p>
            </div>
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              <button onClick={shareViaSMS} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Send</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
