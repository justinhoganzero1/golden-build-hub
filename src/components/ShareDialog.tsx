import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Mail, Phone, Share2, Check, ExternalLink, MessageCircle, Facebook, Twitter, Send } from "lucide-react";
import { toast } from "sonner";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url?: string;
  imageUrl?: string;
  description?: string;
}

// Robust clipboard copy that works in iframes / non-secure contexts
const robustCopy = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

// Open a URL reliably across web, in-app webviews, and Capacitor native.
// Strategy: anchor-click first (preserves user-gesture, avoids popup blockers),
// then Capacitor Browser plugin if present, then window.open as last resort.
const robustOpen = async (href: string): Promise<boolean> => {
  // 1. Anchor click — most reliable for user-gesture-initiated opens (WhatsApp, FB, etc.)
  try {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 100);
    return true;
  } catch {}
  // 2. Capacitor native Browser (when running as installed app)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: href });
      return true;
    }
  } catch {}
  // 3. Last resort
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w) return true;
  } catch {}
  return false;
};

const ShareDialog = ({ open, onOpenChange, title, url, imageUrl, description }: ShareDialogProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);

  // Always share the public production domain — never the lovable preview/editor URL.
  const PUBLIC_ORIGIN = "https://golden-vault-builder.lovable.app";
  const rawUrl = url || imageUrl || (typeof window !== "undefined" ? window.location.href : "");
  const shareUrl = (() => {
    try {
      const u = new URL(rawUrl, PUBLIC_ORIGIN);
      if (u.hostname.includes("lovable.app") || u.hostname.includes("lovableproject.com") || u.hostname.includes("lovable.dev")) {
        return `${PUBLIC_ORIGIN}${u.pathname}${u.search}${u.hash}`;
      }
      return u.toString();
    } catch {
      return `${PUBLIC_ORIGIN}/`;
    }
  })();
  const shareText = description || `Check out "${title}" on Solace!`;

  const copyLink = async () => {
    const ok = await robustCopy(shareUrl);
    if (ok) {
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy automatically. Long-press the link below to copy.");
    }
  };

  const shareViaEmail = async () => {
    if (!email.trim()) { toast.error("Enter an email address"); return; }
    const subject = encodeURIComponent(`Check this out: ${title}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    const ok = await robustOpen(`mailto:${email.trim()}?subject=${subject}&body=${body}`);
    if (ok) { toast.success("Opening your email app…"); setEmail(""); }
    else toast.error("Couldn't open your email app.");
  };

  const shareViaSMS = async () => {
    if (!phone.trim()) { toast.error("Enter a phone number"); return; }
    const body = encodeURIComponent(`${shareText} ${shareUrl}`);
    const ok = await robustOpen(`sms:${phone.trim()}?body=${body}`);
    if (ok) { toast.success("Opening your messaging app…"); setPhone(""); }
    else toast.error("Couldn't open your messaging app.");
  };

  const shareWhatsApp = () => {
    void robustOpen(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`);
    toast.success("Opening WhatsApp…");
  };
  const shareFacebook = () => {
    void robustOpen(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
  };
  const shareTwitter = () => {
    void robustOpen(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`);
  };
  const shareTelegram = () => {
    void robustOpen(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: shareText, url: shareUrl });
        toast.success("Shared!");
      } catch (e: any) {
        if (e?.name !== "AbortError") toast.error("Native share failed — try one of the options below.");
      }
    } else {
      toast.error("Native sharing isn't supported here. Use one of the buttons below.");
    }
  };

  const hasNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Share2 className="w-5 h-5 text-primary" /> Share "{title}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {/* Copy Link */}
          <button onClick={copyLink} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary transition-all">
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-primary" />}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-foreground">{copied ? "Copied!" : "Copy Link"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{shareUrl}</p>
            </div>
          </button>

          {/* Visible selectable URL — manual copy fallback */}
          <div className="rounded-lg bg-muted/50 border border-border p-2">
            <p className="text-[10px] text-muted-foreground mb-1">Or copy manually:</p>
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="w-full bg-transparent text-xs text-foreground outline-none select-all"
            />
          </div>

          {/* Native Share */}
          {hasNativeShare && (
            <button onClick={nativeShare} className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <ExternalLink className="w-5 h-5 text-primary" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">Share via Apps</p>
                <p className="text-[10px] text-muted-foreground">System share sheet</p>
              </div>
            </button>
          )}

          {/* Quick social buttons */}
          <div className="grid grid-cols-4 gap-2">
            <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <span className="text-[10px] text-foreground">WhatsApp</span>
            </button>
            <button onClick={shareFacebook} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Facebook className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] text-foreground">Facebook</span>
            </button>
            <button onClick={shareTwitter} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Twitter className="w-5 h-5 text-sky-400" />
              <span className="text-[10px] text-foreground">Twitter</span>
            </button>
            <button onClick={shareTelegram} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Send className="w-5 h-5 text-cyan-400" />
              <span className="text-[10px] text-foreground">Telegram</span>
            </button>
          </div>

          {/* Email */}
          <div className="rounded-xl bg-card border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Share via Email</p>
            </div>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") shareViaEmail(); }}
                type="email"
                placeholder="recipient@email.com"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
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
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") shareViaSMS(); }}
                type="tel"
                placeholder="+1 234 567 890"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button onClick={shareViaSMS} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium">Send</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
