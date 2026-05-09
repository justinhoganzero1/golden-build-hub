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

  // ============= FACEKBOOK FAIL-PROOF SHARING =============
  // Build a long ordered chain of share/composer endpoints to try in sequence.
  // This is intentionally exhaustive (50+ entries across mobile, desktop, m., mbasic.,
  // app deep links, dialog endpoints, mirrors, language hosts) so even if some are
  // blocked or removed by Facebook, at least one will open.
  const buildFacebookFallbacks = (target: "feed" | "story" | "messenger" | "any"): string[] => {
    const u = encodeURIComponent(shareUrl);
    const q = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    const t = encodeURIComponent(title);
    const APP_ID = "140586622674265";
    const feedFallbacks = [
      `fb://composer?text=${q}`,
      `fb://publish/profile/me?text=${q}`,
      `fb://faceweb/f?href=${u}`,
      `https://m.facebook.com/sharer.php?u=${u}&quote=${q}`,
      `https://m.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://www.facebook.com/sharer.php?u=${u}&quote=${q}`,
      `https://en-gb.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://es-la.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://fr-fr.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://de-de.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://www.facebook.com/dialog/feed?app_id=${APP_ID}&link=${u}&quote=${q}&display=popup&redirect_uri=${u}`,
      `https://www.facebook.com/dialog/share?app_id=${APP_ID}&href=${u}&quote=${q}&display=popup&redirect_uri=${u}`,
      `https://m.facebook.com/dialog/feed?app_id=${APP_ID}&link=${u}&quote=${q}&redirect_uri=${u}`,
      `https://mbasic.facebook.com/sharer.php?u=${u}`,
      `https://mbasic.facebook.com/composer/?text=${q}`,
      `https://touch.facebook.com/sharer/sharer.php?u=${u}&quote=${q}`,
      `https://www.facebook.com/share?u=${u}`,
      `https://www.facebook.com/share/url/?url=${u}`,
    ];
    const storyFallbacks = [
      `fb://story_composer?link=${u}`,
      `fb://reels/create?link=${u}`,
      `fb://camera?link=${u}`,
      `https://m.facebook.com/stories/create/?link=${u}`,
      `https://www.facebook.com/stories/create/?link=${u}`,
      `https://www.facebook.com/stories/create/`,
      `https://m.facebook.com/stories/`,
      `https://www.facebook.com/stories/`,
    ];
    const messengerFallbacks = [
      `fb-messenger://share?link=${u}`,
      `fb-messenger://share/?link=${u}`,
      `fb-messenger://compose?text=${q}`,
      `https://www.messenger.com/new?link=${u}`,
      `https://m.me/?link=${u}`,
      `https://www.facebook.com/dialog/send?app_id=${APP_ID}&link=${u}&redirect_uri=${u}`,
      `https://m.facebook.com/messages/`,
      `https://www.messenger.com/`,
    ];
    const lastResort = [
      `https://m.facebook.com/`,
      `https://mbasic.facebook.com/`,
      `https://www.facebook.com/`,
      `https://touch.facebook.com/`,
      `fb://`,
    ];
    if (target === "feed") return [...feedFallbacks, ...lastResort];
    if (target === "story") return [...storyFallbacks, ...feedFallbacks.slice(0, 6), ...lastResort];
    if (target === "messenger") return [...messengerFallbacks, ...feedFallbacks.slice(0, 4), ...lastResort];
    return [...feedFallbacks, ...storyFallbacks, ...messengerFallbacks, ...lastResort];
  };

  // Open the FB chain progressively. We try the first; if it appears blocked
  // (window.open returns null on web), we move down the list automatically.
  const runFacebookChain = async (target: "feed" | "story" | "messenger" | "any") => {
    const chain = buildFacebookFallbacks(target);
    for (const href of chain) {
      try {
        // App-scheme deep links: just attempt — they fail silently if uninstalled.
        if (href.startsWith("fb://") || href.startsWith("fb-messenger://")) {
          try { window.location.href = href; } catch {}
          await new Promise(r => setTimeout(r, 350));
          continue;
        }
        const ok = await robustOpen(href);
        if (ok) return true;
      } catch {}
    }
    return false;
  };

  const markFbSignedIn = () => {
    try { localStorage.setItem(FB_SIGNIN_KEY, "1"); } catch {}
    setFbSignedIn(true);
    toast.success("Facebook marked as signed in — share buttons unlocked.");
    // Auto-retry pending share if any
    try {
      const pending = localStorage.getItem(FB_PENDING_KEY);
      if (pending) {
        localStorage.removeItem(FB_PENDING_KEY);
        toast.message("Retrying your Facebook share…");
        if (pending === "story") void shareFacebookStory();
        else if (pending === "messenger") void shareMessenger();
        else void shareFacebook();
      }
    } catch {}
  };

  const facebookGate = (target: "feed" | "story" | "messenger"): boolean => {
    if (fbSignedIn) return true;
    try { localStorage.setItem(FB_PENDING_KEY, target); } catch {}
    toast.message("Sign in to Facebook first", {
      description: "Tap 'Open Facebook & Sign in', then tap 'I'm signed in' — we'll auto-retry your share.",
    });
    setShowTroubleshoot(true);
    return false;
  };

  // Facebook share — copy text first, then walk the fallback chain.
  const shareFacebook = async () => {
    if (!facebookGate("feed")) return;
    const copiedOk = await robustCopy(`${shareText}\n\n${shareUrl}`);
    if (copiedOk) { setCopied(true); setTimeout(() => setCopied(false), 2500); }
    setFbAttempts(a => a + 1);
    toast.message("Opening Facebook…", {
      description: copiedOk
        ? "Your link & caption are copied. Paste into the post if it doesn't pre-fill."
        : "Paste your link into the post if it doesn't pre-fill.",
    });
    const ok = await runFacebookChain("feed");
    if (!ok) { setShowTroubleshoot(true); toast.error("Facebook is blocking the share window. Use the troubleshooter below."); }
  };
  const shareFacebookStory = async () => {
    if (!facebookGate("story")) return;
    await robustCopy(`${shareText}\n\n${shareUrl}`);
    setFbAttempts(a => a + 1);
    toast.message("Opening Facebook Story…", { description: "Paste your link in the story composer." });
    const ok = await runFacebookChain("story");
    if (!ok) setShowTroubleshoot(true);
  };
  // Plain "Open Facebook" — last-resort sign-in helper
  const openFacebook = async () => {
    const ok = await robustCopy(`${shareText}\n\n${shareUrl}`);
    toast.message("Opening Facebook", {
      description: ok ? "Link copied — sign in, then tap 'I'm signed in' to retry." : "Sign in, then tap 'I'm signed in'.",
    });
    await runFacebookChain("any");
  };
  // Dedicated copy helpers
  const copyFacebookLink = async () => {
    const ok = await robustCopy(shareUrl);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2500); toast.success("Facebook URL copied!"); }
    else toast.error("Couldn't copy — long-press the URL field above.");
  };
  const copyFacebookCaption = async () => {
    const ok = await robustCopy(shareText);
    if (ok) toast.success("Caption copied — paste it into your Facebook post!");
    else toast.error("Couldn't copy caption.");
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
