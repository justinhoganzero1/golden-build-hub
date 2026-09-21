import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import { BookOpen, Copy, Check, Download, Loader2, ArrowLeft, ImageIcon } from "lucide-react";
import { resolveStorageUrl } from "@/lib/signedStorageUrl";
import { toast } from "sonner";

interface BookChapter {
  title: string;
  summary: string;
  words: number | null;
  images: number;
}

interface BookDoc {
  id: string;
  title: string;
  author: string;
  genre: string;
  blurb: string;
  premise: string;
  dedication: string;
  coverImage: string | null;
  backImage: string | null;
  chapters: BookChapter[];
}

const CopyField = ({ label, value, hint }: { label: string; value: string; hint?: string }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      toast.error("Copy failed — select the text and copy manually");
    }
  };
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <button
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-semibold"
        >
          {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{value || "—"}</p>
      <p className="text-[10px] text-muted-foreground mt-2">{value.length.toLocaleString()} characters</p>
    </div>
  );
};

const CoverCard = ({ src: raw, label, file }: { src: string; label: string; file: string }) => {
  const [src, setSrc] = useState(raw);
  useEffect(() => {
    let alive = true;
    resolveStorageUrl(raw, 3600).then((u) => alive && setSrc(u || raw));
    return () => {
      alive = false;
    };
  }, [raw]);
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card/40">
      <img src={src} alt={label} className="w-full object-cover" loading="lazy" />
      <div className="p-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <button
          onClick={download}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-semibold hover:bg-muted/50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Download
        </button>
      </div>
    </div>
  );
};

const BookPage = () => {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<BookDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase.rpc("get_book_page" as any, { _story_id: id } as any);
      if (!alive) return;
      if (error) toast.error(error.message);
      setBook((data as any) || null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const totals = useMemo(() => {
    const chapters = book?.chapters || [];
    return {
      chapters: chapters.length,
      words: chapters.reduce((n, c) => n + (c.words || 0), 0),
      images: chapters.reduce((n, c) => n + (c.images || 0), 0),
    };
  }, [book]);

  const slug = (book?.title || "book").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 text-center">
        <div>
          <BookOpen className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Book not found</h1>
          <Link to="/story-writer" className="text-sm text-primary underline mt-2 inline-block">
            Back to Story Writer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO title={`${book.title} — Book page`} description={book.blurb.slice(0, 150)} />
      <div className="max-w-5xl mx-auto px-5 py-10">
        <Link
          to={`/story-writer?id=${book.id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Story Writer
        </Link>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest text-primary mb-2">{book.genre}</p>
          <h1 className="text-4xl font-bold leading-tight">{book.title}</h1>
          {book.author && <p className="text-sm text-muted-foreground mt-2">by {book.author}</p>}
          <p className="text-xs text-muted-foreground mt-3">
            {totals.chapters} chapters · {totals.words.toLocaleString()} words · {totals.images} illustrations
          </p>
        </header>

        {(book.coverImage || book.backImage) && (
          <section className="grid sm:grid-cols-2 gap-4 mb-10">
            {book.coverImage && <CoverCard src={book.coverImage} label="Front cover" file={`${slug}-front-cover.jpg`} />}
            {book.backImage && <CoverCard src={book.backImage} label="Rear cover" file={`${slug}-rear-cover.jpg`} />}
          </section>
        )}

        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Details for KDP</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <CopyField label="Book title" value={book.title} hint="KDP → Title" />
            <CopyField label="Author" value={book.author} hint="KDP → Primary author" />
            <CopyField label="Description" value={book.blurb} hint="KDP → Description (4,000 char limit)" />
            <CopyField
              label="Keywords"
              value="scam thriller,revenge thriller,australian action,cybercrime,vigilante justice,action adventure,con artist"
              hint="KDP → 7 keyword boxes (one per comma)"
            />
            <CopyField
              label="Categories"
              value={"Fiction > Thrillers > Crime\nFiction > Action & Adventure"}
              hint="KDP → Categories (choose two)"
            />
            <CopyField
              label="Table of contents"
              value={book.chapters.map((c, i) => `${i + 1}. ${c.title}`).join("\n")}
              hint="Handy for your book's front matter"
            />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Table of contents</h2>
          <ol className="space-y-3">
            {book.chapters.map((c, i) => (
              <li key={i} className="rounded-xl border border-border bg-card/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold">{c.title}</h3>
                  <span className="shrink-0 text-[10px] text-muted-foreground flex items-center gap-2">
                    {(c.words || 0).toLocaleString()} words
                    {c.images > 0 && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <ImageIcon className="w-3 h-3" /> {c.images}
                      </span>
                    )}
                  </span>
                </div>
                {c.summary && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.summary}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};

export default BookPage;
