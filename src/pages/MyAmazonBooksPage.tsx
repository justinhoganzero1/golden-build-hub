import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react";
import SEO from "@/components/SEO";

type Row = { story_id: string; title: string; isbn: string; asin: string; amazon_url: string; marketplace: string };

const okUrl = (u: string) => !u || /^https:\/\/(www\.)?amazon\.[a-z.]{2,8}\//i.test(u);
const okAsin = (a: string) => !a || /^[A-Za-z0-9]{10}$/.test(a);
const okIsbn = (i: string) => !i || /^[0-9Xx-]{10,17}$/.test(i);

export default function MyAmazonBooksPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const { data: stories } = await supabase
        .from("user_media").select("id,title,metadata")
        .eq("user_id", u.user.id).eq("metadata->>kind", "story_doc")
        .order("created_at", { ascending: false });
      const ids = (stories ?? []).map((s) => s.id);
      const { data: links } = ids.length
        ? await (supabase as any).from("book_amazon_links").select("*").in("story_id", ids)
        : { data: [] };
      const byId = new Map((links ?? []).map((l: any) => [l.story_id, l]));
      setRows((stories ?? []).map((s: any) => {
        const l: any = byId.get(s.id) ?? {};
        return { story_id: s.id, title: s.title || "Untitled", isbn: l.isbn ?? "", asin: l.asin ?? "", amazon_url: l.amazon_url ?? "", marketplace: l.marketplace ?? "amazon.com.au" };
      }));
      setLoading(false);
    })();
  }, []);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.story_id === id ? { ...x, ...patch } : x)));

  const save = async (r: Row) => {
    if (!okUrl(r.amazon_url.trim())) return toast.error("Amazon link must start with https://www.amazon…");
    if (!okAsin(r.asin.trim())) return toast.error("ASIN is 10 letters/numbers (e.g. B0ABC12345)");
    if (!okIsbn(r.isbn.trim())) return toast.error("ISBN should be 10 or 13 digits");
    setSaving(r.story_id);
    const { data: u } = await supabase.auth.getUser();
    const asin = r.asin.trim().toUpperCase();
    const url = r.amazon_url.trim() || (asin ? `https://www.${r.marketplace}/dp/${asin}` : "");
    const { error } = await (supabase as any).from("book_amazon_links").upsert({
      user_id: u.user?.id, story_id: r.story_id,
      isbn: r.isbn.trim() || null, asin: asin || null, amazon_url: url || null, marketplace: r.marketplace,
    }, { onConflict: "story_id" });
    setSaving(null);
    if (error) return toast.error(error.message);
    update(r.story_id, { asin, amazon_url: url });
    toast.success("Saved — the book page now links to Amazon");
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 max-w-2xl mx-auto space-y-4">
      <SEO title="My books on Amazon | Oracle Lunar" description="Link your books to their real Amazon pages." />
      <Link to="/story-writer" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Story Writer</Link>
      <h1 className="text-2xl font-bold text-primary">My books on Amazon</h1>
      <p className="text-sm text-muted-foreground">
        After Amazon publishes your book, copy its ASIN (and ISBN if you have one) from your KDP Bookshelf, or paste the Amazon page link. Your book page will then show a "Buy on Amazon" button.
      </p>
      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : rows.length === 0 ? (
        <p className="text-sm">No books yet — write one in Story Writer first.</p>
      ) : rows.map((r) => (
        <section key={r.story_id} className="border border-border rounded-xl p-4 space-y-2 bg-card">
          <h2 className="font-semibold">{r.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="ASIN e.g. B0ABC12345" value={r.asin} onChange={(e) => update(r.story_id, { asin: e.target.value })} />
            <Input placeholder="ISBN (optional)" value={r.isbn} onChange={(e) => update(r.story_id, { isbn: e.target.value })} />
          </div>
          <select className="w-full bg-background border border-border rounded-md p-2 text-sm" value={r.marketplace} onChange={(e) => update(r.story_id, { marketplace: e.target.value })}>
            {["amazon.com.au", "amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de"].map((m) => <option key={m}>{m}</option>)}
          </select>
          <Input placeholder="Amazon page link (optional — built from ASIN if blank)" value={r.amazon_url} onChange={(e) => update(r.story_id, { amazon_url: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save(r)} disabled={saving === r.story_id}>
              {saving === r.story_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </Button>
            {r.amazon_url && <Button size="sm" variant="outline" asChild><a href={r.amazon_url} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /> Open on Amazon</a></Button>}
            <Button size="sm" variant="ghost" asChild><Link to={`/book/${r.story_id}`}>Book page</Link></Button>
          </div>
        </section>
      ))}
    </main>
  );
}
