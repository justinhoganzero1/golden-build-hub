import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, ShoppingBag, Play, Trash2 } from "lucide-react";
import SEO from "@/components/SEO";

type Listing = { id: string; user_id: string; title: string; description: string; kind: "quiz" | "tracker"; shop_price_cents: number; download_count: number; owned: boolean };
type QuizQ = { q: string; options: string[]; answer: number };
type Mod = { id: string; title: string; kind: "quiz" | "tracker"; config: any; is_public: boolean; shop_price_cents: number; download_count: number; description: string };

const money = (c: number) => (c === 0 ? "Free" : `US$${(c / 100).toFixed(2)}`);

function QuizPlayer({ qs }: { qs: QuizQ[] }) {
  const [i, setI] = useState(0); const [score, setScore] = useState(0);
  if (!qs.length) return <p className="text-sm">No questions.</p>;
  if (i >= qs.length) return <div className="space-y-2"><p className="font-semibold">Score: {score} / {qs.length}</p><Button size="sm" onClick={() => { setI(0); setScore(0); }}>Play again</Button></div>;
  const q = qs[i];
  return (
    <div className="space-y-2">
      <p className="font-medium">{i + 1}. {q.q}</p>
      {q.options.map((o, k) => (
        <Button key={k} variant="outline" className="w-full justify-start" onClick={() => { if (k === q.answer) setScore(s => s + 1); setI(i + 1); }}>{o}</Button>
      ))}
    </div>
  );
}

function TrackerPlayer({ id, items }: { id: string; items: string[] }) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `oracle.module.${id}.${day}`;
  const [done, setDone] = useState<string[]>(() => JSON.parse(localStorage.getItem(key) || "[]"));
  const toggle = (it: string) => { const n = done.includes(it) ? done.filter(x => x !== it) : [...done, it]; setDone(n); localStorage.setItem(key, JSON.stringify(n)); };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Today: {done.length}/{items.length}</p>
      {items.map(it => (
        <label key={it} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={done.includes(it)} onChange={() => toggle(it)} />{it}</label>
      ))}
    </div>
  );
}

export default function ModuleShopPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [shop, setShop] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<Mod | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // builder
  const [kind, setKind] = useState<"quiz" | "tracker">("quiz");
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [price, setPrice] = useState("0");
  const [qText, setQText] = useState("What planet is closest to the Sun? | Mercury* | Venus | Mars");
  const [items, setItems] = useState("Drink water\nWalk 20 minutes\nRead 10 pages");

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    setUid(u.user?.id ?? null);
    const [{ data: l }, { data: m }] = await Promise.all([
      (supabase as any).rpc("list_module_shop"),
      u.user ? (supabase as any).from("creator_modules").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }) : { data: [] },
    ]);
    setShop(l ?? []); setMine(m ?? []); setLoading(false);
  };
  useEffect(() => {
    load();
    const p = new URLSearchParams(location.search);
    if (p.get("bought")) toast.success("Payment done — your new module unlocks as soon as the payment is confirmed (usually seconds).");
  }, []);

  const parseQuiz = (): QuizQ[] => qText.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split("|").map(s => s.trim()).filter(Boolean);
    const opts = parts.slice(1);
    const answer = Math.max(0, opts.findIndex(o => o.endsWith("*")));
    return { q: parts[0], options: opts.map(o => o.replace(/\*$/, "")), answer };
  }).filter(q => q.q && q.options.length >= 2);

  const create = async () => {
    if (!uid) return toast.error("Please sign in");
    const cents = Math.round(parseFloat(price || "0") * 100);
    if (cents !== 0 && (cents < 100 || cents > 50000)) return toast.error("Price must be free (0) or between 1 and 500");
    const config = kind === "quiz" ? { questions: parseQuiz() } : { items: items.split("\n").map(s => s.trim()).filter(Boolean).slice(0, 30) };
    if (kind === "quiz" && !config.questions!.length) return toast.error("Add at least one question with 2+ answers");
    if (kind === "tracker" && !config.items!.length) return toast.error("Add at least one thing to track");
    const { error } = await (supabase as any).from("creator_modules").insert({
      user_id: uid, title: title.trim(), description: desc.trim(), kind, config,
      is_public: true, shop_enabled: cents > 0, shop_price_cents: cents,
    });
    if (error) return toast.error(error.message);
    toast.success("Published to the shop"); setTitle(""); setDesc(""); load();
  };

  const remove = async (id: string) => { await (supabase as any).from("creator_modules").delete().eq("id", id); load(); };

  const open = async (l: Listing) => {
    const { data, error } = await (supabase as any).from("creator_modules").select("*").eq("id", l.id).maybeSingle();
    if (error || !data) return toast.error("Couldn't open it yet");
    setPlaying(data);
  };

  const buy = async (l: Listing) => {
    setBusy(l.id);
    const { data, error } = await supabase.functions.invoke("shop-checkout", { body: { item_id: l.id, item_kind: "module" } });
    setBusy(null);
    if (error || !data?.url) return toast.error(data?.error || error?.message || "Checkout failed");
    window.location.href = data.url;
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-4 max-w-3xl mx-auto space-y-6">
      <SEO title="Module Shop | Oracle Lunar" description="Make, share and sell your own games and trackers." />
      <Link to="/free-zone" className="text-sm text-muted-foreground flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Free Zone</Link>
      <header>
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><ShoppingBag className="w-6 h-6" /> Module Shop</h1>
        <p className="text-sm text-muted-foreground">Make your own quiz games and trackers — no AI, no coins. Share them free or sell them: you keep 80%, Oracle Lunar keeps 20%. To be paid, connect a payout account in the Creator Studio.</p>
      </header>

      {playing && (
        <section className="border border-primary rounded-xl p-4 bg-card space-y-3">
          <div className="flex justify-between"><h2 className="font-semibold">{playing.title}</h2><Button size="sm" variant="ghost" onClick={() => setPlaying(null)}>Close</Button></div>
          {playing.kind === "quiz" ? <QuizPlayer qs={playing.config?.questions ?? []} /> : <TrackerPlayer id={playing.id} items={playing.config?.items ?? []} />}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Shop</h2>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : shop.length === 0 ? <p className="text-sm text-muted-foreground">Nothing listed yet — be the first below.</p> :
          <div className="grid sm:grid-cols-2 gap-3">
            {shop.map(l => (
              <article key={l.id} className="border border-border rounded-xl p-3 bg-card space-y-1">
                <p className="text-xs uppercase text-primary">{l.kind === "quiz" ? "Quiz game" : "Tracker"}</p>
                <h3 className="font-semibold">{l.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-3">{l.description}</p>
                <p className="text-sm font-medium">{money(l.shop_price_cents)} · {l.download_count} sold</p>
                {l.owned ? <Button size="sm" onClick={() => open(l)}><Play className="w-4 h-4" /> Open</Button>
                  : <Button size="sm" onClick={() => buy(l)} disabled={busy === l.id}>{busy === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy by card"}</Button>}
              </article>
            ))}
          </div>}
      </section>

      <section className="border border-border rounded-xl p-4 bg-card space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Make a module</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={kind === "quiz" ? "default" : "outline"} onClick={() => setKind("quiz")}>Quiz game</Button>
          <Button size="sm" variant={kind === "tracker" ? "default" : "outline"} onClick={() => setKind("tracker")}>Tracker</Button>
        </div>
        <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
        <Textarea placeholder="Short description" value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} />
        {kind === "quiz" ? (<>
          <p className="text-xs text-muted-foreground">One question per line: question | answer | answer… — put * after the right answer.</p>
          <Textarea rows={5} value={qText} onChange={e => setQText(e.target.value)} />
        </>) : (<>
          <p className="text-xs text-muted-foreground">One thing to tick off each day per line.</p>
          <Textarea rows={5} value={items} onChange={e => setItems(e.target.value)} />
        </>)}
        <label className="text-sm block">Price in US$ (0 = free)
          <Input type="number" min="0" step="0.5" value={price} onChange={e => setPrice(e.target.value)} />
        </label>
        {parseFloat(price) > 0 && <p className="text-xs text-muted-foreground">You get US${(parseFloat(price) * 0.8).toFixed(2)}, Oracle Lunar keeps US${(parseFloat(price) * 0.2).toFixed(2)} per sale.</p>}
        <Button onClick={create} disabled={title.trim().length < 2}>Publish</Button>
      </section>

      {mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">My modules</h2>
          {mine.map(m => (
            <div key={m.id} className="flex items-center justify-between border border-border rounded-lg p-2 text-sm">
              <span>{m.title} · {money(m.shop_price_cents)} · {m.download_count} sold</span>
              <span className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPlaying(m)}><Play className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4" /></Button>
              </span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
