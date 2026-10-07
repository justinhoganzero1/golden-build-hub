import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Loader2, Save, Target, ExternalLink } from "lucide-react";
import SEO from "@/components/SEO";

type Chapter = { title?: string; content?: string };
type Book = {
  id: string;
  title: string;
  chapters: number;
  words: number;
  longest: number;
  asin: string | null;
  amazonUrl: string | null;
  target: number;
  current: number | null;
  notes: string;
};

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export default function AuthorDashboardPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data: stories } = await supabase
        .from("user_media").select("id,title,metadata")
        .eq("user_id", u.user.id).eq("metadata->>kind", "story_doc")
        .order("updated_at", { ascending: false });
      const ids = (stories ?? []).map((s) => s.id);
      const [{ data: links }, { data: goals }] = await Promise.all([
        ids.length ? supabase.from("book_amazon_links").select("*").in("story_id", ids) : Promise.resolve({ data: [] as never[] }),
        ids.length ? supabase.from("book_goals").select("*").in("story_id", ids) : Promise.resolve({ data: [] as never[] }),
      ]);
      const linkBy = new Map((links ?? []).map((l) => [l.story_id as string, l]));
      const goalBy = new Map((goals ?? []).map((g) => [g.story_id as string, g]));
      setBooks((stories ?? []).map((s) => {
        const meta = (s.metadata ?? {}) as { chapters?: Chapter[] };
        const chs = meta.chapters ?? [];
        const counts = chs.map((c) => countWords(c.content ?? ""));
        const l = linkBy.get(s.id) as { asin?: string | null; amazon_url?: string | null } | undefined;
        const g = goalBy.get(s.id) as { target_score?: number; current_score?: number | null; notes?: string } | undefined;
        return {
          id: s.id,
          title: s.title || "Untitled",
          chapters: chs.length,
          words: counts.reduce((a, b) => a + b, 0),
          longest: counts.length ? Math.max(...counts) : 0,
          asin: l?.asin ?? null,
          amazonUrl: l?.amazon_url ?? null,
          target: g?.target_score ?? 9,
          current: g?.current_score ?? null,
          notes: g?.notes ?? "",
        };
      }));
      setLoading(false);
    })();
  }, []);

  const patch = (id: string, p: Partial<Book>) => setBooks((b) => b.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const saveGoal = async (b: Book) => {
    setSaving(b.id);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("book_goals").upsert({
      user_id: u.user!.id, story_id: b.id,
      target_score: b.target, current_score: b.current, notes: b.notes,
      updated_at: new Date().toISOString(),
    });
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success("Goal saved");
  };

  const totalWords = books.reduce((n, b) => n + b.words, 0);
  const totalChapters = books.reduce((n, b) => n + b.chapters, 0);
  const onAmazon = books.filter((b) => b.asin || b.amazonUrl).length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      <SEO title="My Author Dashboard" description="Every book you've written, with chapters, word counts, Amazon status and your bestseller goals." path="/author-dashboard" />
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/" className="p-2 -ml-2 rounded-full hover:bg-muted" aria-label="Home"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="font-bold text-lg">My Author Dashboard</h1>
            <p className="text-xs text-muted-foreground">Books, chapters, words, Amazon status and goals</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading your books…</p>
        ) : books.length === 0 ? (
          <p className="text-sm text-muted-foreground">No books yet. <Link to="/story-writer" className="text-primary underline">Start one in Story Writer</Link>.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[["Books", books.length], ["Chapters", totalChapters], ["Words", totalWords.toLocaleString()]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-lg font-bold">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{onAmazon} of {books.length} books have an Amazon link saved.</p>

            {books.map((b) => (
              <section key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-2">
                  <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate">{b.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {b.chapters} chapters · {b.words.toLocaleString()} words · longest chapter {b.longest.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs">
                      {b.asin || b.amazonUrl ? (
                        <a href={b.amazonUrl ?? `https://www.amazon.com.au/dp/${b.asin}`} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 underline">
                          On Amazon{b.asin ? ` (${b.asin})` : ""} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not on Amazon yet — <Link to="/my-amazon-books" className="text-primary underline">add the link</Link></span>
                      )}
                    </p>
                    <p className="mt-1 text-xs">
                      <Link to={`/read/${b.id}`} className="text-primary underline">Read it</Link>
                      {" · "}
                      <Link to="/story-writer" className="text-primary underline">Open in Story Writer</Link>
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold"><Target className="w-4 h-4 text-primary" /> Bestseller goal</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">Score now
                      <input type="number" min={0} max={10} value={b.current ?? ""} onChange={(e) => patch(b.id, { current: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-14 rounded-md border border-border bg-background px-2 py-1" />
                    </label>
                    <label className="flex items-center gap-1">Goal
                      <input type="number" min={1} max={10} value={b.target} onChange={(e) => patch(b.id, { target: Number(e.target.value) })}
                        className="w-14 rounded-md border border-border bg-background px-2 py-1" />
                    </label>
                    <span className="text-muted-foreground">out of 10</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, ((b.current ?? 0) / Math.max(1, b.target)) * 100)}%` }} />
                  </div>
                  <textarea value={b.notes} onChange={(e) => patch(b.id, { notes: e.target.value })} rows={2}
                    placeholder="What will lift this score? (e.g. stronger blurb, new cover, more reviews)"
                    className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs" />
                  <button onClick={() => saveGoal(b)} disabled={saving === b.id}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
                    {saving === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save goal
                  </button>
                </div>
              </section>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
