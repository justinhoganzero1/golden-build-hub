import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mail, Facebook, MessageCircle, Send, Twitter, Linkedin, Link2, Copy, Check,
  Instagram, Smartphone, Share2, Music2, Download, Loader2, FileDown, Headphones,
} from "lucide-react";
import {
  buildStoryFile, downloadFile, shareFiles, STORY_FILE_META,
  type StoryFileFormat, type StoryFileSource,
} from "@/lib/storyFiles";
import { narrateStoryToMp3 } from "@/lib/storyNarration";
import { supabase } from "@/integrations/supabase/client";


const PUBLIC_ORIGIN = "https://oracle-lunar.online";

export interface ShareStory {
  title: string;
  author?: string;
  genre?: string;
  premise?: string;
  blurb?: string;
  dedication?: string;
  prelude?: string;
  coverImage?: string;
  backImage?: string;
  chapters?: { title: string; content: string; images?: string[]; imageAnchors?: number[] }[];
  publishedUrl?: string;
}


type ChannelId =
  | "email" | "facebook" | "messenger" | "whatsapp" | "sms"
  | "x" | "linkedin" | "telegram" | "reddit" | "instagram" | "tiktok" | "link";

interface Channel {
  id: ChannelId;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Max characters the platform comfortably accepts (soft guide). */
  limit?: number;
  /** true = we can't post directly, so we copy a ready-made caption. */
  captionOnly?: boolean;
}

const CHANNELS: Channel[] = [
  { id: "email", label: "Email", hint: "Sends the whole story + images", icon: Mail },
  { id: "facebook", label: "Facebook post", hint: "Story blurb + hashtags", icon: Facebook, limit: 1500 },
  { id: "messenger", label: "Messenger", hint: "Short friendly message", icon: MessageCircle, limit: 400 },
  { id: "whatsapp", label: "WhatsApp", hint: "Short message + link", icon: MessageCircle, limit: 600 },
  { id: "sms", label: "Text message", hint: "One-liner + link", icon: Smartphone, limit: 300 },
  { id: "x", label: "X / Twitter", hint: "Hook under 280 chars", icon: Twitter, limit: 260 },
  { id: "linkedin", label: "LinkedIn", hint: "Professional author note", icon: Linkedin, limit: 1200 },
  { id: "telegram", label: "Telegram", hint: "Short message + link", icon: Send, limit: 600 },
  { id: "reddit", label: "Reddit", hint: "Title + self-text post", icon: MessageCircle, limit: 2000 },
  { id: "instagram", label: "Instagram", hint: "Caption copied for your post", icon: Instagram, limit: 2200, captionOnly: true },
  { id: "tiktok", label: "TikTok", hint: "Caption copied for your video", icon: Music2, limit: 2200, captionOnly: true },
  { id: "link", label: "Copy link", hint: "Just the story link", icon: Link2 },
];

const isMobile = () =>
  /iPhone|iPad|iPod|Android/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "");

const robustCopy = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

const isInIframe = (): boolean => {
  try { return window.self !== window.top; } catch { return true; }
};

/** Installed PWA / standalone window — navigating the top frame away kills the app. */
const isStandalone = (): boolean => {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
};

/** Deep links (mailto:, sms:, fb-messenger:) must use the same tab handoff. */
const isAppScheme = (href: string) => /^(mailto:|sms:|tel:|fb-messenger:)/i.test(href);

const robustOpen = async (href: string): Promise<boolean> => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      if (isAppScheme(href)) {
        window.location.href = href;
        return true;
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: href });
      return true;
    }
  } catch {}
  try {
    const w = window.open(href, "_blank", "noopener,noreferrer");
    if (w && !w.closed) return true;
  } catch {}
  if (isAppScheme(href)) {
    try { window.location.href = href; return true; } catch {}
    return false;
  }
  if (isInIframe()) {
    try { (window.top as Window).location.href = href; return true; } catch {}
  }
  // In an installed PWA, never replace the app's own document with an
  // external page — the user can't get back and the app "fails to reload".
  if (isStandalone()) {
    toast.error("Couldn't open that app. The text is copied — paste it manually.");
    return false;
  }
  try { window.location.href = href; return true; } catch {}
  return false;
};

const plain = (s: string) => (s || "").replace(/\s+/g, " ").trim();

const clamp = (s: string, max?: number) => {
  if (!max || s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const hashtags = (story: ShareStory) => {
  const g = (story.genre || "").replace(/[^a-z0-9]/gi, "");
  const tags = ["#OracleLunar", "#AmWriting", g ? `#${g}` : "", "#Storytelling", "#NewRelease"];
  return tags.filter(Boolean).join(" ");
};

const excerpt = (story: ShareStory, chars: number) => {
  const first = story.chapters?.find(c => plain(c.content).length > 40);
  if (!first) return plain(story.premise || "");
  return clamp(plain(first.content), chars);
};

const logline = (story: ShareStory) =>
  clamp(plain(story.premise || `A ${story.genre || "new"} story you can read right now.`), 220);

/** Build the channel-appropriate text for the story. */
export const formatForChannel = (channel: ChannelId, story: ShareStory, url: string): string => {
  const title = story.title || "Untitled Story";
  const by = story.author ? ` by ${story.author}` : "";
  const genre = story.genre ? `${story.genre} • ` : "";
  const tags = hashtags(story);

  switch (channel) {
    case "email":
      return [
        `Hi,`,
        ``,
        `I just finished a ${story.genre || "new"} story called “${title}”${by} and I'd love you to read it.`,
        ``,
        `The whole story — every chapter and every illustration — is in this email, so there's nothing to click and nothing to sign up for. Just scroll and read.`,
        ``,
        `— ${story.author || "Written with Oracle Lunar"}`,
      ].join("\n");


    case "facebook":
      return clamp([
        `📖 ${title}${by}`,
        ``,
        `${genre}${logline(story)}`,
        ``,
        `“${excerpt(story, 380)}”`,
        ``,
        `Read it free here 👉 ${url}`,
        ``,
        tags,
      ].join("\n"), 1500);

    case "messenger":
      return clamp(`Hey! I wrote a ${story.genre || "new"} story called “${title}” — ${logline(story)} Read it here: ${url}`, 400);

    case "whatsapp":
      return clamp(`📖 *${title}*${by}\n\n${logline(story)}\n\nRead it here: ${url}`, 600);

    case "sms":
      return clamp(`I wrote “${title}” — read it here: ${url}`, 300);

    case "x":
      return clamp(`📖 “${title}”${by}\n\n${logline(story)}\n\n${url}\n\n#OracleLunar${story.genre ? ` #${story.genre.replace(/[^a-z0-9]/gi, "")}` : ""}`, 260);

    case "linkedin":
      return clamp([
        `New release: “${title}”${by}`,
        ``,
        `${genre}${logline(story)}`,
        ``,
        `I wrote and illustrated it end-to-end inside Oracle Lunar. You can read it here: ${url}`,
        ``,
        tags,
      ].join("\n"), 1200);

    case "telegram":
      return clamp(`📖 ${title}${by}\n${logline(story)}\n${url}`, 600);

    case "reddit":
      return clamp([
        `${logline(story)}`,
        ``,
        `Excerpt:`,
        ``,
        `> ${excerpt(story, 900)}`,
        ``,
        `Full story: ${url}`,
      ].join("\n"), 2000);

    case "instagram":
    case "tiktok":
      return clamp([
        `📖 ${title}${by}`,
        ``,
        logline(story),
        ``,
        `Full story at the link in bio 👉 ${url}`,
        ``,
        tags,
      ].join("\n"), 2200);

    case "link":
    default:
      return url;
  }
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: ShareStory;
}

const StoryShareDialog = ({ open, onOpenChange, story }: Props) => {
  const [channel, setChannel] = useState<ChannelId>("email");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const raw = story.publishedUrl || `${PUBLIC_ORIGIN}/story-writer`;
    try {
      const u = new URL(raw, PUBLIC_ORIGIN);
      if (/lovable\.(app|dev)|lovableproject\.com/.test(u.hostname)) {
        return `${PUBLIC_ORIGIN}${u.pathname}${u.search}${u.hash}`;
      }
      return u.toString();
    } catch {
      return `${PUBLIC_ORIGIN}/`;
    }
  }, [story.publishedUrl]);

  const active = CHANNELS.find(c => c.id === channel)!;

  // Re-format when the channel changes or the dialog opens.
  // NOTE: `story` is passed as a fresh object literal on every parent render,
  // so depending on it directly wiped the textarea on each keystroke elsewhere
  // and made the tab appear frozen / never reload. Depend on its content only.
  const storyKey = useMemo(
    () => JSON.stringify([story.title, story.author, story.genre, story.premise, story.chapters?.length, story.publishedUrl]),
    [story.title, story.author, story.genre, story.premise, story.chapters?.length, story.publishedUrl],
  );

  useEffect(() => {
    if (!open) return;
    setBody(formatForChannel(channel, story, url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, open, url, storyKey]);

  // ===== Complete-file sharing (the actual story, not just a link) =====
  const [fileFormat, setFileFormat] = useState<StoryFileFormat | "mp3">("epub");
  const [fileBusy, setFileBusy] = useState(false);
  const [audioPct, setAudioPct] = useState(0);

  const fileSource: StoryFileSource = useMemo(() => ({
    title: story.title || "Untitled Story",
    author: story.author,
    genre: story.genre,
    premise: story.premise,
    blurb: story.blurb,
    coverImage: story.coverImage,
    chapters: (story.chapters || []).map(c => ({ title: c.title, content: c.content, images: c.images, imageAnchors: c.imageAnchors })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [storyKey, story.blurb, story.coverImage]);

  const hasText = (story.chapters || []).some(c => (c.content || "").trim().length > 0);

  const makeFile = async (): Promise<File | null> => {
    if (!hasText) {
      toast.error("Write at least one chapter before sharing the file.");
      return null;
    }
    if (fileFormat === "mp3") {
      setAudioPct(1);
      const f = await narrateStoryToMp3(fileSource, setAudioPct);
      setAudioPct(0);
      return f;
    }
    return buildStoryFile(fileSource, fileFormat);
  };

  const shareCompleteFile = async () => {
    if (fileBusy) return;
    setFileBusy(true);
    try {
      const file = await makeFile();
      if (!file) return;
      const result = await shareFiles([file], {
        title: story.title || "Untitled Story",
        text: `${story.title || "Untitled Story"}${story.author ? ` by ${story.author}` : ""}`,
      });
      if (result === "shared") toast.success("Sent — the complete file went with it.");
      else if (result === "downloaded") toast.success(`Saved “${file.name}” — attach it to your message.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't build the file.");
    } finally {
      setFileBusy(false);
      setAudioPct(0);
    }
  };

  const downloadCompleteFile = async () => {
    if (fileBusy) return;
    setFileBusy(true);
    try {
      const file = await makeFile();
      if (!file) return;
      downloadFile(file);
      toast.success(`Downloaded “${file.name}”.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't build the file.");
    } finally {
      setFileBusy(false);
      setAudioPct(0);
    }
  };

  // Emails the WHOLE story — chapters and illustrations rendered inside the
  // message body. One click: type an address, press send. No attachment is
  // built (the base64 EPUB made the request too large to reach the server).
  const [emailBusy, setEmailBusy] = useState(false);
  const emailWholeStory = async () => {
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Enter the recipient's email address first.");
      return;
    }
    if (!hasText) {
      toast.error("Write at least one chapter first.");
      return;
    }
    setEmailBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("email-story", {
        body: {
          to,
          message: body,
          title: story.title || "Untitled Story",
          author: story.author,
          genre: story.genre,
          blurb: story.blurb,
          dedication: story.dedication,
          prelude: story.prelude,
          coverImage: story.coverImage,
          backImage: story.backImage,
          chapters: (story.chapters || []).map(c => ({ title: c.title, content: c.content, images: c.images, imageAnchors: c.imageAnchors })),
        },
      });
      if (error) {
        const detail = await (error as any)?.context?.text?.().catch(() => "");
        let msg = error.message;
        try { msg = JSON.parse(detail)?.error || msg; } catch { if (detail) msg = detail; }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Sent — the complete story is in ${to}'s inbox.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't email the story.");
    } finally {
      setEmailBusy(false);
    }
  };



  const copyBody = async () => {
    const ok = await robustCopy(body);
    if (ok) {
      setCopied(true);
      toast.success("Copied — ready to paste");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy. Select the text and copy manually.");
    }
  };

  const send = async () => {
    const enc = encodeURIComponent(body);
    const encUrl = encodeURIComponent(url);
    const title = story.title || "Untitled Story";

    switch (channel) {
      case "email": {
        await emailWholeStory();
        return;
      }

      case "sms": {
        await robustOpen(`sms:${phone.trim()}?body=${enc}`);
        toast.success("Opening your messages app…");
        return;
      }
      case "facebook": {
        await robustCopy(body);
        await robustOpen(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${enc}`);
        toast.success("Facebook opened — your post text is on the clipboard too.");
        return;
      }
      case "messenger": {
        await robustCopy(body);
        const target = isMobile()
          ? `fb-messenger://share/?link=${encUrl}`
          : `https://www.facebook.com/dialog/send?app_id=140586622674265&link=${encUrl}&redirect_uri=${encUrl}`;
        await robustOpen(target);
        toast.success("Messenger opened — message copied for pasting.");
        return;
      }
      case "whatsapp": {
        const target = isMobile()
          ? `https://wa.me/?text=${enc}`
          : `https://web.whatsapp.com/send?text=${enc}`;
        await robustOpen(target);
        toast.success("Opening WhatsApp…");
        return;
      }
      case "x": {
        await robustOpen(`https://twitter.com/intent/tweet?text=${enc}`);
        toast.success("Opening X…");
        return;
      }
      case "linkedin": {
        await robustCopy(body);
        await robustOpen(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`);
        toast.success("LinkedIn opened — your post text is copied.");
        return;
      }
      case "telegram": {
        await robustOpen(`https://t.me/share/url?url=${encUrl}&text=${enc}`);
        toast.success("Opening Telegram…");
        return;
      }
      case "reddit": {
        await robustOpen(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&text=${enc}`);
        toast.success("Opening Reddit…");
        return;
      }
      case "instagram":
      case "tiktok": {
        await robustCopy(body);
        if (typeof navigator !== "undefined" && (navigator as any).share) {
          try {
            await (navigator as any).share({ title, text: body, url });
            return;
          } catch (e: any) {
            if (e?.name === "AbortError") return;
          }
        }
        await robustOpen(channel === "instagram" ? "https://www.instagram.com/" : "https://www.tiktok.com/upload");
        toast.success("Caption copied — paste it into your post.");
        return;
      }
      case "link":
      default: {
        await copyBody();
      }
    }
  };

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !(navigator as any).share) {
      toast.error("Your device doesn't have a share sheet — pick a channel instead.");
      return;
    }
    try {
      await (navigator as any).share({ title: story.title, text: body, url });
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Share cancelled.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Share “{story.title || "Untitled Story"}”
          </DialogTitle>
          <DialogDescription>
            Pick where you want to share it — the story is automatically rewritten into the right
            format for that place. You can still edit the text before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CHANNELS.map(c => {
            const Icon = c.icon;
            const on = c.id === channel;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Icon className="w-4 h-4 text-primary" />
                  {c.label}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Auto-formatted for {active.label}</span>
            {active.limit && (
              <Badge variant={body.length > active.limit ? "destructive" : "secondary"}>
                {body.length}/{active.limit}
              </Badge>
            )}
          </div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={channel === "email" || channel === "reddit" ? 12 : 7}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setBody(formatForChannel(channel, story, url))}>
              Reset to auto-format
            </Button>
            <Button variant="outline" size="sm" onClick={copyBody}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              Copy
            </Button>
          </div>
        </div>

        {channel === "email" && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-bold">Send the whole book in one click</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Type the email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !emailBusy) void emailWholeStory(); }}
                className="flex-1"
              />
              <Button onClick={() => void emailWholeStory()} disabled={emailBusy} className="sm:w-40">
                {emailBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {emailBusy ? "Sending…" : "Send"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Front cover → dedication → prelude → chapters 1-20 with every illustration in its right
              place → rear cover → back blurb. They just open it and scroll. No link, no sign-up.
            </p>
          </div>
        )}

        {channel === "sms" && (
          <Input
            type="tel"
            placeholder="Phone number (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}

        {!story.publishedUrl && (
          <p className="text-[11px] text-muted-foreground">
            Tip: publish the story first so the link opens the story itself instead of the app home page.
          </p>
        )}

        <div className="rounded-xl border border-border p-3 space-y-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <FileDown className="w-4 h-4 text-primary" />
              Send the complete story as a file
            </p>
            <p className="text-[11px] text-muted-foreground">
              The whole book — cover, chapters and illustrations — packaged in a real file the
              recipient can open, read or listen to without an account.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(STORY_FILE_META) as StoryFileFormat[]).map((f) => {
              const meta = STORY_FILE_META[f];
              const on = fileFormat === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFileFormat(f)}
                  className={`rounded-lg border p-2 text-left transition-colors ${on ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="text-xs font-medium">{meta.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{meta.hint}</div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setFileFormat("mp3")}
              className={`rounded-lg border p-2 text-left transition-colors ${fileFormat === "mp3" ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
            >
              <div className="text-xs font-medium flex items-center gap-1">
                <Headphones className="w-3 h-3 text-primary" /> Audio (MP3)
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">Narrated audiobook</div>
            </button>
          </div>

          {fileFormat === "mp3" && audioPct > 0 && (
            <div className="h-1.5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${audioPct}%` }} />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button className="flex-1" onClick={shareCompleteFile} disabled={fileBusy}>
              {fileBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              {fileBusy && fileFormat === "mp3" ? `Narrating… ${audioPct}%` : "Share the file"}
            </Button>
            <Button variant="outline" onClick={downloadCompleteFile} disabled={fileBusy}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1" onClick={send} disabled={emailBusy}>
            {emailBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
            {channel === "email"
              ? (emailBusy ? "Sending the whole story…" : "Email the entire story")
              : `Share to ${active.label}`}
          </Button>

          <Button variant="outline" onClick={nativeShare}>
            More apps…
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default StoryShareDialog;
