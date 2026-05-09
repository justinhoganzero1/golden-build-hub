import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Mail, Phone, Share2, Check, ExternalLink, MessageCircle, Facebook, Twitter, Send, Linkedin, Link2, AlertTriangle, HelpCircle, LogIn, FileText } from "lucide-react";
import { toast } from "sonner";

const FB_SIGNIN_KEY = "oracle-lunar-fb-signed-in";
const FB_PENDING_KEY = "oracle-lunar-fb-pending-share";

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

// Open a URL reliably across web, in-app webviews, iframes, and Capacitor native.
// In iframes (Lovable preview), programmatic anchor clicks with target=_blank are
// often blocked silently — so we try window.open first and fall back to top-level
// navigation when in an iframe.
const isInIframe = (): boolean => {
  try { return window.self !== window.top; } catch { return true; }
};

const robustOpen = async (href: string): Promise<boolean> => {
  // 1. Capacitor native Browser (installed app)
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: href });
      return true;
    }
  } catch {}

  // 2. window.open — most reliable in standalone PWAs and webviews
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w && !w.closed) return true;
  } catch {}

  // 3. Anchor click fallback
  try {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 100);
  } catch {}

  // 4. If in an iframe (Lovable preview), break out to top-level navigation
  if (isInIframe()) {
    try { (window.top as Window).location.href = href; return true; } catch {}
  }

  // 5. Last resort — same-tab navigation
  try { window.location.href = href; return true; } catch {}

  return false;
};

const ShareDialog = ({ open, onOpenChange, title, url, imageUrl, description }: ShareDialogProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);
  const [fbSignedIn, setFbSignedIn] = useState<boolean>(() => {
    try { return localStorage.getItem(FB_SIGNIN_KEY) === "1"; } catch { return false; }
  });
  const [fbAttempts, setFbAttempts] = useState(0);

  // Always share the public production domain — never the lovable preview/editor URL.
  const PUBLIC_ORIGIN = "https://oracle-lunar.online";
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
  const shareText = description || `Check out "${title}" on Oracle Lunar!`;

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

  const shareWhatsApp = async () => {
    const message = `${shareText} ${shareUrl}`;
    // 1. Native share sheet on mobile lets the user pick WhatsApp directly
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: shareText, url: shareUrl });
        toast.success("Shared!");
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // 2. Mobile devices: wa.me deep-links into the app
    const isMobile = /iPhone|iPad|iPod|Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");
    if (isMobile) {
      void robustOpen(`https://wa.me/?text=${encodeURIComponent(message)}`);
      toast.success("Opening WhatsApp…");
      return;
    }
    // 3. Desktop: go straight to WhatsApp Web (api.whatsapp.com is blocked by Chrome)
    void robustOpen(`https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`);
    toast.success("Opening WhatsApp Web…");
  };
  // Universal share helper: tries native share first, then mobile deep link, then desktop web URL.
  const universalShare = async (
    provider: string,
    urls: { mobile: string; desktop: string },
  ) => {
    const message = `${shareText} ${shareUrl}`;
    // 1. Native share sheet (best on mobile — lets user pick the app directly)
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, text: shareText, url: shareUrl });
        toast.success("Shared!");
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // 2. Platform-specific link
    const isMobile = /iPhone|iPad|iPod|Android/i.test(
      typeof navigator !== "undefined" ? navigator.userAgent : "",
    );
    const target = isMobile ? urls.mobile : urls.desktop;
    const ok = await robustOpen(target);
    if (ok) {
      toast.success(`Opening ${provider}…`);
      return;
    }
    // 3. Last-resort copy fallback
    const copied = await robustCopy(message);
    if (copied) {
      toast.success(`${provider} blocked — link copied so you can paste it.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(`Couldn't open ${provider}. Copy the link manually below.`);
    }
  };

  // Facebook share — copies text first (so user can paste even if FB strips the quote),
  // then opens the Feed composer. Falls back to opening facebook.com so the user can sign in
  // and paste the copied content.
  const shareFacebook = async () => {
    const u = encodeURIComponent(shareUrl);
    const q = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    // Pre-copy so user can paste once signed in
    const copiedOk = await robustCopy(`${shareText}\n\n${shareUrl}`);
    if (copiedOk) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
    toast.message("Opening Facebook…", {
      description: copiedOk
        ? "Sign in to Facebook if asked. Your link & text are copied — just paste into the post."
        : "Sign in to Facebook if asked, then paste your link into the post.",
    });
    await universalShare("Facebook", {
      mobile: `https://m.facebook.com/sharer.php?u=${u}&quote=${q}`,
      desktop: `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
    });
  };
  // Facebook Story — mobile deep link with web fallback
  const shareFacebookStory = async () => {
    const u = encodeURIComponent(shareUrl);
    await robustCopy(`${shareText}\n\n${shareUrl}`);
    toast.message("Opening Facebook Story…", { description: "Paste your link in the story composer." });
    await universalShare("Facebook Story", {
      mobile: `fb://story_composer?link=${u}`,
      desktop: `https://www.facebook.com/stories/create/`,
    });
  };
  // Plain "Open Facebook" — last-resort sign-in helper
  const openFacebook = async () => {
    const ok = await robustCopy(`${shareText}\n\n${shareUrl}`);
    toast.message("Opening Facebook", {
      description: ok ? "Link copied — sign in and paste into a new post." : "Sign in and paste your link.",
    });
    await robustOpen("https://www.facebook.com/");
  };
  const shareTwitter = async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    await universalShare("Twitter/X", {
      mobile: `https://twitter.com/intent/tweet?text=${text}`,
      desktop: `https://twitter.com/intent/tweet?text=${text}`,
    });
  };
  const shareTelegram = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(shareText);
    await universalShare("Telegram", {
      mobile: `tg://msg_url?url=${u}&text=${t}`,
      desktop: `https://t.me/share/url?url=${u}&text=${t}`,
    });
  };
  const shareReddit = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(title);
    const url = `https://www.reddit.com/submit?url=${u}&title=${t}`;
    await universalShare("Reddit", { mobile: url, desktop: url });
  };
  const shareLinkedIn = async () => {
    const u = encodeURIComponent(shareUrl);
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    await universalShare("LinkedIn", { mobile: url, desktop: url });
  };
  const sharePinterest = async () => {
    const u = encodeURIComponent(shareUrl);
    const d = encodeURIComponent(shareText);
    const m = imageUrl ? `&media=${encodeURIComponent(imageUrl)}` : "";
    const url = `https://pinterest.com/pin/create/button/?url=${u}&description=${d}${m}`;
    await universalShare("Pinterest", { mobile: url, desktop: url });
  };
  const shareTumblr = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(title);
    const c = encodeURIComponent(shareText);
    const url = `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${u}&title=${t}&caption=${c}`;
    await universalShare("Tumblr", { mobile: url, desktop: url });
  };
  const shareThreads = async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    const url = `https://www.threads.net/intent/post?text=${text}`;
    await universalShare("Threads", { mobile: url, desktop: url });
  };
  const shareBluesky = async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    const url = `https://bsky.app/intent/compose?text=${text}`;
    await universalShare("Bluesky", { mobile: url, desktop: url });
  };
  const shareLine = async () => {
    const u = encodeURIComponent(shareUrl);
    const url = `https://social-plugins.line.me/lineit/share?url=${u}`;
    await universalShare("LINE", { mobile: url, desktop: url });
  };
  const shareSnapchat = async () => {
    const u = encodeURIComponent(shareUrl);
    const url = `https://www.snapchat.com/scan?attachmentUrl=${u}`;
    await universalShare("Snapchat", { mobile: url, desktop: url });
  };
  const sharePocket = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(title);
    const url = `https://getpocket.com/save?url=${u}&title=${t}`;
    await universalShare("Pocket", { mobile: url, desktop: url });
  };
  const shareVK = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(title);
    const url = `https://vk.com/share.php?url=${u}&title=${t}`;
    await universalShare("VK", { mobile: url, desktop: url });
  };
  // Platforms without a public share intent — copy text + open the app/site so user can paste.
  const shareCopyAndOpen = async (provider: string, target: string) => {
    const message = `${shareText} ${shareUrl}`;
    const ok = await robustCopy(message);
    if (ok) {
      toast.success(`${provider}: link copied — paste it in your post.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    void robustOpen(target);
  };
  const shareInstagram = () => shareCopyAndOpen("Instagram", "https://www.instagram.com/");
  const shareTikTok = () => shareCopyAndOpen("TikTok", "https://www.tiktok.com/upload");
  const shareYouTube = () => shareCopyAndOpen("YouTube", "https://studio.youtube.com/");
  const shareDiscord = () => shareCopyAndOpen("Discord", "https://discord.com/channels/@me");
  const shareMessenger = async () => {
    const u = encodeURIComponent(shareUrl);
    const url = `https://www.facebook.com/dialog/send?link=${u}&app_id=140586622674265&redirect_uri=${u}`;
    await universalShare("Messenger", { mobile: `fb-messenger://share?link=${u}`, desktop: url });
  };
  const shareMastodon = async () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    const url = `https://mastodonshare.com/?text=${text}`;
    await universalShare("Mastodon", { mobile: url, desktop: url });
  };
  const shareXing = async () => {
    const u = encodeURIComponent(shareUrl);
    const url = `https://www.xing.com/spi/shares/new?url=${u}`;
    await universalShare("Xing", { mobile: url, desktop: url });
  };
  const shareHackerNews = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(title);
    const url = `https://news.ycombinator.com/submitlink?u=${u}&t=${t}`;
    await universalShare("Hacker News", { mobile: url, desktop: url });
  };
  const shareWeibo = async () => {
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(`${shareText}`);
    const url = `https://service.weibo.com/share/share.php?url=${u}&title=${t}`;
    await universalShare("Weibo", { mobile: url, desktop: url });
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

          {/* Dedicated Facebook quick-actions row — most-requested platform */}
          <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Facebook className="w-4 h-4 text-blue-500" />
              <p className="text-xs font-semibold text-foreground">Share to Facebook</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={shareFacebook} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-card border border-border hover:border-blue-500 transition-all">
                <Facebook className="w-4 h-4 text-blue-500" />
                <span className="text-[9px] text-foreground leading-tight">Feed Post</span>
              </button>
              <button onClick={shareFacebookStory} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-card border border-border hover:border-blue-500 transition-all">
                <Facebook className="w-4 h-4 text-blue-400" />
                <span className="text-[9px] text-foreground leading-tight">Story</span>
              </button>
              <button onClick={shareMessenger} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-card border border-border hover:border-blue-500 transition-all">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <span className="text-[9px] text-foreground leading-tight">Messenger</span>
              </button>
              <button onClick={openFacebook} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-card border border-border hover:border-blue-500 transition-all">
                <ExternalLink className="w-4 h-4 text-blue-400" />
                <span className="text-[9px] text-foreground leading-tight">Sign in</span>
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Tip: if Facebook asks you to sign in, do that first — your story link & caption are copied so you can paste straight into the post.
            </p>
          </div>

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
            <button onClick={shareLinkedIn} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Linkedin className="w-5 h-5 text-blue-600" />
              <span className="text-[10px] text-foreground">LinkedIn</span>
            </button>
            <button onClick={shareReddit} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-orange-500" />
              <span className="text-[10px] text-foreground">Reddit</span>
            </button>
            <button onClick={sharePinterest} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-red-500" />
              <span className="text-[10px] text-foreground">Pinterest</span>
            </button>
            <button onClick={shareTumblr} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] text-foreground">Tumblr</span>
            </button>
            <button onClick={shareThreads} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-foreground" />
              <span className="text-[10px] text-foreground">Threads</span>
            </button>
            <button onClick={shareBluesky} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-sky-500" />
              <span className="text-[10px] text-foreground">Bluesky</span>
            </button>
            <button onClick={shareLine} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <MessageCircle className="w-5 h-5 text-green-400" />
              <span className="text-[10px] text-foreground">LINE</span>
            </button>
            <button onClick={shareSnapchat} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-yellow-400" />
              <span className="text-[10px] text-foreground">Snapchat</span>
            </button>
            <button onClick={sharePocket} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-pink-500" />
              <span className="text-[10px] text-foreground">Pocket</span>
            </button>
            <button onClick={shareVK} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-blue-400" />
              <span className="text-[10px] text-foreground">VK</span>
            </button>
            <button onClick={shareInstagram} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-pink-400" />
              <span className="text-[10px] text-foreground">Instagram</span>
            </button>
            <button onClick={shareTikTok} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-foreground" />
              <span className="text-[10px] text-foreground">TikTok</span>
            </button>
            <button onClick={shareYouTube} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-red-500" />
              <span className="text-[10px] text-foreground">YouTube</span>
            </button>
            <button onClick={shareDiscord} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <MessageCircle className="w-5 h-5 text-indigo-400" />
              <span className="text-[10px] text-foreground">Discord</span>
            </button>
            <button onClick={shareMessenger} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-[10px] text-foreground">Messenger</span>
            </button>
            <button onClick={shareMastodon} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] text-foreground">Mastodon</span>
            </button>
            <button onClick={shareXing} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-teal-500" />
              <span className="text-[10px] text-foreground">Xing</span>
            </button>
            <button onClick={shareHackerNews} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-orange-400" />
              <span className="text-[10px] text-foreground">HN</span>
            </button>
            <button onClick={shareWeibo} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-card border border-border hover:border-primary transition-all">
              <Link2 className="w-5 h-5 text-rose-500" />
              <span className="text-[10px] text-foreground">Weibo</span>
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Some platforms (Instagram, TikTok, YouTube) don't allow direct web posting — we copy your link and open the app so you can paste it into your post.
          </p>

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
