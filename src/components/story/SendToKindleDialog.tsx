import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BookMarked, Check, Copy, Download, ExternalLink, Loader2, Share2, ArrowDown, CircleCheck,
} from "lucide-react";

const KINDLE_EMAIL_KEY = "oracle.kindle.email";
const APPROVED_KEY = "oracle.kindle.approved";
const KINDLE_SETTINGS_URL = "https://www.amazon.com/hz/mycd/myx#/home/settings/payment";
const SEND_TO_KINDLE_WEB = "https://www.amazon.com/sendtokindle";
const DEFAULT_SENDER = "kindle@oracle-lunar.online";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Builds the finished EPUB file (null = nothing to send). */
  buildEpub: () => Promise<File | null>;
  title: string;
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Couldn't read the book file."));
    r.readAsDataURL(file);
  });

/** Big numbered step with a pointing arrow and a speech bubble. */
const Step = ({
  n, title, done, children, bubble,
}: { n: number; title: string; done?: boolean; children?: React.ReactNode; bubble?: string }) => (
  <div className="relative">
    <div className={`rounded-2xl border-2 p-4 transition-colors ${done ? "border-primary/60 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-black text-base ${done ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          {done ? <CircleCheck className="w-5 h-5" /> : n}
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-base font-extrabold italic leading-tight">{title}</p>
          {bubble && (
            <div className="relative inline-block rounded-xl bg-primary/10 border border-primary/40 px-3 py-2 text-xs text-foreground">
              <span className="absolute -top-1.5 left-4 w-3 h-3 rotate-45 bg-primary/10 border-l border-t border-primary/40" />
              {bubble}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
    <div className="flex justify-center py-1 text-primary/70">
      <ArrowDown className="w-5 h-5 animate-bounce" />
    </div>
  </div>
);

const SendToKindleDialog = ({ open, onOpenChange, buildEpub, title }: Props) => {
  const [kindleEmail, setKindleEmail] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState<"send" | "download" | "share" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sender, setSender] = useState(DEFAULT_SENDER);

  useEffect(() => {
    if (!open) return;
    try {
      setKindleEmail(localStorage.getItem(KINDLE_EMAIL_KEY) ?? "");
      setApproved(localStorage.getItem(APPROVED_KEY) === "1");
    } catch {}
    setSentTo(null);
  }, [open]);

  const emailValid = useMemo(
    () => /^[^\s@]+@(kindle\.com|free\.kindle\.com)$/i.test(kindleEmail.trim()),
    [kindleEmail],
  );

  const copySender = async () => {
    try {
      await navigator.clipboard.writeText(sender);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Sender address copied — paste it into Amazon's approved list.");
    } catch {
      toast.error("Copy failed — the address is " + sender);
    }
  };

  const sendNow = async () => {
    if (!emailValid) { toast.error("Enter your @kindle.com address first."); return; }
    setBusy("send");
    try {
      const file = await buildEpub();
      if (!file) return;
      const fileBase64 = await toBase64(file);
      const { data, error } = await supabase.functions.invoke("send-to-kindle", {
        body: { kindleEmail: kindleEmail.trim(), filename: file.name, title, fileBase64 },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.sender) setSender((data as any).sender);
      try { localStorage.setItem(KINDLE_EMAIL_KEY, kindleEmail.trim()); } catch {}
      setSentTo(kindleEmail.trim());
      toast.success(`Sent — “${title}” lands on your Kindle in a few minutes.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't send to Kindle.");
    } finally {
      setBusy(null);
    }
  };

  const downloadEpub = async () => {
    setBusy("download");
    try {
      const file = await buildEpub();
      if (!file) return;
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded “${file.name}”.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't build the EPUB.");
    } finally {
      setBusy(null);
    }
  };

  const shareEpub = async () => {
    setBusy("share");
    try {
      const file = await buildEpub();
      if (!file) return;
      const nav = navigator as any;
      if (nav?.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title, text: title });
      } else {
        toast.error("This device has no share sheet — use Download instead.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message || "Share failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" />
            Send “{title}” to your Kindle
          </DialogTitle>
          <DialogDescription>
            Follow the three steps. Once they're done, one tap delivers the finished book
            straight into your Kindle library — no cables, no uploading, no computer.
          </DialogDescription>
        </DialogHeader>

        <Step
          n={1}
          done={approved}
          title="Let Oracle Lunar send books to your Kindle"
          bubble="Amazon only accepts books from addresses you approve. Add ours once — it takes 30 seconds and you never do it again."
        >
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-2 py-1 text-xs font-mono">{sender}</code>
            <Button size="sm" variant="outline" onClick={copySender}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              Copy address
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(KINDLE_SETTINGS_URL, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Open Amazon settings
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            On Amazon: <b>Preferences</b> → <b>Personal Document Settings</b> → under
            <b> Approved Personal Document E-mail List</b> tap <b>Add a new approved e-mail address</b>,
            paste the address above and save.
          </p>
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => {
                setApproved(e.target.checked);
                try { localStorage.setItem(APPROVED_KEY, e.target.checked ? "1" : "0"); } catch {}
              }}
            />
            I've added it to my approved list
          </label>
        </Step>

        <Step
          n={2}
          done={emailValid}
          title="Enter your personal Kindle address"
          bubble="It's on the same Amazon page, under Send-to-Kindle E-Mail Settings — it always ends in @kindle.com."
        >
          <Input
            type="email"
            placeholder="yourname_a1b2c3@kindle.com"
            value={kindleEmail}
            onChange={(e) => setKindleEmail(e.target.value)}
            onBlur={() => { try { localStorage.setItem(KINDLE_EMAIL_KEY, kindleEmail.trim()); } catch {} }}
          />
          {kindleEmail && !emailValid && (
            <p className="text-[11px] text-destructive">That address must end in @kindle.com.</p>
          )}
        </Step>

        <Step
          n={3}
          done={!!sentTo}
          title="Tap send — we do the rest"
          bubble="We build the Kindle-formatted EPUB (cover, chapters, table of contents) and email it to Amazon for you."
        >
          <Button className="w-full" onClick={sendNow} disabled={busy !== null || !emailValid || !approved}>
            {busy === "send" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookMarked className="w-4 h-4 mr-2" />}
            {busy === "send" ? "Delivering to Kindle…" : "Send this book to my Kindle now"}
          </Button>
          {!approved && (
            <p className="text-[11px] text-muted-foreground">Tick step 1 once you've approved our address.</p>
          )}
          {sentTo && (
            <p className="text-xs text-primary font-semibold">
              ✅ Delivered to {sentTo}. Open your Kindle and sync — it appears within a few minutes.
            </p>
          )}
        </Step>

        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold">Prefer to do it yourself?</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={downloadEpub} disabled={busy !== null}>
              {busy === "download" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download EPUB
            </Button>
            <Button variant="outline" className="flex-1" onClick={shareEpub} disabled={busy !== null}>
              {busy === "share" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              Share to Kindle app
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => window.open(SEND_TO_KINDLE_WEB, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Send to Kindle web
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The same EPUB also uploads directly to Kobo Writing Life, Apple Books, Google Play Books and B&amp;N Press.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToKindleDialog;
