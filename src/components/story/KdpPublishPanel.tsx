import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BookMarked, Check, Copy, Download, ExternalLink, Loader2, AlertTriangle, CircleCheck, Send,
} from "lucide-react";

const KDP_DETAILS_URL = "https://kdp.amazon.com/en_US/bookshelf";
const KDP_TAX_URL = "https://kdp.amazon.com/en_US/tax-interview";

export interface KdpFields {
  title: string;
  subtitle: string;
  seriesName: string;
  seriesNumber: string;
  author: string;
  description: string;
  keywords: string[];
  category1: string;
  category2: string;
  language: string;
  isbn: string;
  price: string;
  royalty: "70" | "35";
  adultContent: "no" | "yes";
}

const emptyKdp = (): KdpFields => ({
  title: "", subtitle: "", seriesName: "", seriesNumber: "", author: "",
  description: "", keywords: ["", "", "", "", "", "", ""],
  category1: "Fiction › Thrillers › Crime",
  category2: "Fiction › Action & Adventure",
  language: "English", isbn: "", price: "5.99", royalty: "70", adultContent: "no",
});

const storeKey = (id?: string) => `oracle.kdp.${id ?? "draft"}`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId?: string;
  title: string;
  author: string;
  genre: string;
  blurb?: string;
  premise?: string;
  chapters: { title: string; content: string; images?: string[] }[];
  hasCover: boolean;
  hasBackCover: boolean;
  onDownloadEpub: () => void;
  onSendToKindle: () => void;
}

const Row = ({
  label, hint, value, onChange, max, multiline,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true); setTimeout(() => setCopied(false), 1600);
      toast.success(`${label} copied — paste it into Amazon.`);
    } catch { toast.error("Copy failed."); }
  };
  const over = max ? value.length > max : false;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold">{label}</label>
        <div className="flex items-center gap-2">
          {max && (
            <span className={`text-[10px] ${over ? "text-destructive font-bold" : "text-muted-foreground"}`}>
              {value.length}/{max}
            </span>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copy} disabled={!value}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      {multiline ? (
        <Textarea rows={7} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

const KdpPublishPanel = ({
  open, onOpenChange, storyId, title, author, genre, blurb, premise,
  chapters, hasCover, hasBackCover, onDownloadEpub, onSendToKindle,
}: Props) => {
  const [kdp, setKdp] = useState<KdpFields>(emptyKdp);
  const [senderReady, setSenderReady] = useState<boolean | null>(null);
  const [sender, setSender] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Load saved fields, defaulting from the story itself.
  useEffect(() => {
    if (!open) return;
    let saved: Partial<KdpFields> = {};
    try { saved = JSON.parse(localStorage.getItem(storeKey(storyId)) || "{}"); } catch {}
    setKdp({
      ...emptyKdp(),
      title: title || "",
      author: author || "",
      description: (blurb || premise || "").trim(),
      ...saved,
    });
  }, [open, storyId, title, author, blurb, premise]);

  // Persist as the user edits.
  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(storeKey(storyId), JSON.stringify(kdp)); } catch {}
  }, [kdp, open, storyId]);

  const checkSender = async () => {
    setChecking(true);
    try {
      const { data } = await supabase.functions.invoke("send-to-kindle", { body: { probe: true } });
      setSenderReady(!!(data as any)?.ready);
      setSender((data as any)?.sender ?? null);
    } catch {
      setSenderReady(false);
    } finally { setChecking(false); }
  };

  useEffect(() => { if (open) void checkSender(); /* eslint-disable-next-line */ }, [open]);

  const words = useMemo(
    () => chapters.reduce((n, c) => n + c.content.split(/\s+/).filter(Boolean).length, 0),
    [chapters],
  );
  const illustrations = useMemo(
    () => chapters.reduce((n, c) => n + (c.images?.length ?? 0), 0),
    [chapters],
  );

  const checks = [
    { ok: !!kdp.title.trim(), label: "Title entered" },
    { ok: !!kdp.author.trim(), label: "Author name entered" },
    { ok: kdp.description.trim().length >= 200 && kdp.description.length <= 4000, label: "Description between 200 and 4,000 characters" },
    { ok: kdp.keywords.filter((k) => k.trim()).length >= 3, label: "At least 3 of the 7 keyword slots filled" },
    { ok: !!kdp.category1 && !!kdp.category2, label: "Two categories chosen" },
    { ok: hasCover, label: "Front cover artwork ready" },
    { ok: hasBackCover, label: "Back cover artwork ready" },
    { ok: chapters.length > 0 && chapters.every((c) => c.content.trim().length > 200), label: "Every chapter has text" },
    { ok: words > 2500, label: `Manuscript length (${words.toLocaleString()} words)` },
    { ok: illustrations > 0, label: `Illustrations embedded (${illustrations})` },
    { ok: !!Number(kdp.price) && Number(kdp.price) >= 2.99 && Number(kdp.price) <= 9.99, label: "Price inside the 70% royalty band ($2.99–$9.99)" },
  ];
  const failing = checks.filter((c) => !c.ok);

  const copyAll = async () => {
    const text = [
      `Title: ${kdp.title}`,
      kdp.subtitle && `Subtitle: ${kdp.subtitle}`,
      kdp.seriesName && `Series: ${kdp.seriesName} #${kdp.seriesNumber || "1"}`,
      `Author: ${kdp.author}`,
      `Language: ${kdp.language}`,
      `Categories: ${kdp.category1} | ${kdp.category2}`,
      `Keywords: ${kdp.keywords.filter(Boolean).join(" | ")}`,
      kdp.isbn && `ISBN: ${kdp.isbn}`,
      `Price (USD): ${kdp.price}  •  Royalty: ${kdp.royalty}%`,
      `Adult content: ${kdp.adultContent === "yes" ? "Yes" : "No"}`,
      "",
      "Description:",
      kdp.description,
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); toast.success("Every Amazon field copied."); }
    catch { toast.error("Copy failed."); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" /> Kindle publishing — “{title || "Untitled"}”
          </DialogTitle>
          <DialogDescription>
            Everything Amazon asks for, filled in here from your story and checked before you open KDP.
            Copy each field with one tap, or send the finished book straight to your Kindle.
          </DialogDescription>
        </DialogHeader>

        {/* Readiness */}
        <div className="rounded-xl border border-border p-3 space-y-1.5">
          <p className="text-xs font-bold">
            {failing.length === 0 ? "Ready for Amazon" : `${failing.length} thing${failing.length > 1 ? "s" : ""} to fix first`}
          </p>
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2 text-[11px]">
              {c.ok
                ? <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
              <span className={c.ok ? "text-muted-foreground" : "font-semibold"}>{c.label}</span>
            </div>
          ))}
          <div className="flex items-start gap-2 text-[11px] pt-1">
            {checking
              ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 mt-0.5" />
              : senderReady
                ? <CircleCheck className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />}
            <span className={senderReady ? "text-muted-foreground" : "font-semibold"}>
              {checking
                ? "Checking Kindle delivery…"
                : senderReady
                  ? `Kindle delivery live — books are sent from ${sender}`
                  : "Kindle email delivery is not switched on yet — use Download EPUB meanwhile"}
            </span>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <Row label="Book title" value={kdp.title} onChange={(v) => setKdp({ ...kdp, title: v })} max={200} />
          <Row label="Subtitle (optional)" value={kdp.subtitle} onChange={(v) => setKdp({ ...kdp, subtitle: v })} max={200} />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Row label="Series name (optional)" value={kdp.seriesName} onChange={(v) => setKdp({ ...kdp, seriesName: v })} />
            </div>
            <Row label="Book number" value={kdp.seriesNumber} onChange={(v) => setKdp({ ...kdp, seriesNumber: v })} />
          </div>
          <Row label="Author" value={kdp.author} onChange={(v) => setKdp({ ...kdp, author: v })} />
          <Row
            label="Description (Amazon sales page)"
            value={kdp.description}
            onChange={(v) => setKdp({ ...kdp, description: v })}
            max={4000}
            multiline
            hint="Amazon rejects anything over 4,000 characters — the counter above is live."
          />

          <div>
            <p className="text-xs font-bold pb-1">7 keyword slots</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {kdp.keywords.map((k, i) => (
                <Input
                  key={i}
                  placeholder={`Keyword ${i + 1}`}
                  value={k}
                  onChange={(e) => {
                    const next = [...kdp.keywords]; next[i] = e.target.value;
                    setKdp({ ...kdp, keywords: next });
                  }}
                />
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <Row label="Category 1" value={kdp.category1} onChange={(v) => setKdp({ ...kdp, category1: v })} />
            <Row label="Category 2" value={kdp.category2} onChange={(v) => setKdp({ ...kdp, category2: v })} />
          </div>

          <div className="grid sm:grid-cols-3 gap-2">
            <Row label="Language" value={kdp.language} onChange={(v) => setKdp({ ...kdp, language: v })} />
            <Row label="ISBN (leave blank for a free Amazon one)" value={kdp.isbn} onChange={(v) => setKdp({ ...kdp, isbn: v })} />
            <Row label="Price (USD)" value={kdp.price} onChange={(v) => setKdp({ ...kdp, price: v })} />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="font-bold">Royalty</label>
            {(["70", "35"] as const).map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input type="radio" checked={kdp.royalty === r} onChange={() => setKdp({ ...kdp, royalty: r })} />
                {r}%
              </label>
            ))}
            <label className="font-bold pl-3">Adult content</label>
            {(["no", "yes"] as const).map((a) => (
              <label key={a} className="flex items-center gap-1">
                <input type="radio" checked={kdp.adultContent === a} onChange={() => setKdp({ ...kdp, adultContent: a })} />
                {a === "no" ? "No" : "Yes"}
              </label>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="grid sm:grid-cols-2 gap-2 pt-1">
          <Button onClick={copyAll} variant="outline">
            <Copy className="w-4 h-4 mr-2" /> Copy every Amazon field
          </Button>
          <Button onClick={() => window.open(KDP_DETAILS_URL, "_blank", "noopener,noreferrer")} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" /> Open my KDP bookshelf
          </Button>
          <Button onClick={onDownloadEpub} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Download the illustrated EPUB
          </Button>
          <Button onClick={() => window.open(KDP_TAX_URL, "_blank", "noopener,noreferrer")} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" /> Tax &amp; payment details
          </Button>
          <Button className="sm:col-span-2" onClick={onSendToKindle}>
            <Send className="w-4 h-4 mr-2" /> Send this book to my Kindle
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Amazon has no upload service for other apps to use — the final publish step is always their own
          web form, so Oracle Lunar prepares and checks every field, then hands them over one tap at a time.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default KdpPublishPanel;
