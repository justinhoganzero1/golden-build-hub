import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import UniversalBackButton from "@/components/UniversalBackButton";

type Chapter = { title?: string; content?: string };

export default function BookReaderPage() {
  const { bookId = "", chapter } = useParams();
  const [title, setTitle] = useState("");
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState("");
  const n = chapter ? Number(chapter) : 0;

  useEffect(() => {
    let live = true;
    supabase.rpc("get_story_writer_document", { _story_id: bookId }).then(({ data, error }) => {
      if (!live) return;
      if (error) return setError("This book couldn't be opened. Make sure you're signed in to the account that owns it.");
      const d = (data ?? {}) as { title?: string; metadata?: { chapters?: Chapter[] } };
      setTitle(d.title ?? "Untitled");
      setChapters(d.metadata?.chapters ?? []);
    });
    return () => { live = false; };
  }, [bookId]);

  useEffect(() => { window.scrollTo(0, 0); }, [n]);

  if (error) return <main className="min-h-screen bg-background p-6 pt-16 text-foreground">{error}</main>;
  if (!chapters) return <main className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></main>;

  const words = (s = "") => (s.trim() ? s.trim().split(/\s+/).length : 0);
  const ch = n >= 1 ? chapters[n - 1] : null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <SEO title={`${title}${ch ? ` — ${ch.title}` : ""}`} description={`Read ${title} chapter by chapter.`} path={`/read/${bookId}`} />
      <UniversalBackButton />
      <article className="max-w-2xl mx-auto px-5 pt-16">
        <Link to={`/read/${bookId}`} className="text-xs text-primary flex items-center gap-1 mb-4"><BookOpen className="w-4 h-4" />{title}</Link>
        {!ch ? (
          <>
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground mb-6">{chapters.length} chapters · {chapters.reduce((a, c) => a + words(c.content), 0).toLocaleString()} words</p>
            <ol className="space-y-2">
              {chapters.map((c, i) => (
                <li key={i}>
                  <Link to={`/read/${bookId}/${i + 1}`} className="flex justify-between gap-3 rounded-xl border border-border px-4 py-3 hover:border-primary">
                    <span>{c.title || `Chapter ${i + 1}`}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{words(c.content).toLocaleString()} words</span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-6">{ch.title || `Chapter ${n}`}</h1>
            <div className="space-y-4 text-base leading-relaxed">
              {(ch.content ?? "").split(/\n\s*\n/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
            </div>
            <nav className="flex justify-between mt-10 gap-3">
              {n > 1 ? <Link to={`/read/${bookId}/${n - 1}`} className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm"><ChevronLeft className="w-4 h-4" />Previous</Link> : <span />}
              {n < chapters.length ? <Link to={`/read/${bookId}/${n + 1}`} className="flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">Next<ChevronRight className="w-4 h-4" /></Link> : <Link to={`/read/${bookId}`} className="rounded-lg border border-border px-4 py-2 text-sm">Back to chapters</Link>}
            </nav>
          </>
        )}
      </article>
    </div>
  );
}
