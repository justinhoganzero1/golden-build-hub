import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  ArrowLeft, Briefcase, Copy, ExternalLink, Globe, Loader2, Mail, Play, Power, RefreshCw, Rocket, Timer, Trash2, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PitchDeck from "@/components/pitch/PitchDeck";
import {
  PITCH_STEPS, RUNNING_STATUSES, demoLink, demoState, fillEmail, lockDemoHtml, mailtoHref, newDemoToken, newExpiry, nextStep,
  type DeckSlide, type PitchStep,
} from "@/lib/pitchMachine";

type Row = {
  id: string; business_url: string; business_name: string | null; offer_price: string | null; status: string;
  step: string | null; step_error: string | null; step_started_at: string | null;
  snapshot: any; contacts: any; reviews: any; audit: any; demo_html: string | null; deck: any; email: any;
  demo_token: string | null; demo_enabled: boolean; demo_expires_at: string | null; demo_views: number; demo_last_viewed_at: string | null;
  created_at: string;
};

const card = "rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl";
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }) : "—");

async function runStep(id: string, step: PitchStep): Promise<string | null> {
  const { error } = await supabase.functions.invoke("pitch-machine", { body: { action: "run_step", id, step } });
  if (!error) return null;
  if (error instanceof FunctionsHttpError) {
    const t = await error.context.text().catch(() => "");
    try { return JSON.parse(t).error || t; } catch { return t || error.message; }
  }
  return error.message;
}

export default function PitchMachinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const autoRun = useRef<Set<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("pitch_projects").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) toast.error("Couldn't load your pitches");
    setRows((data as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);
  const anyRunning = rows.some((r) => RUNNING_STATUSES.includes(r.status));

  // Poll while something is working, and keep "Run everything" moving.
  useEffect(() => {
    if (!anyRunning && autoRun.current.size === 0) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [anyRunning, load]);

  useEffect(() => {
    for (const r of rows) {
      if (!autoRun.current.has(r.id) || inFlight.current.has(r.id) || RUNNING_STATUSES.includes(r.status)) continue;
      if (r.status === "failed") { autoRun.current.delete(r.id); toast.error(`Stopped: ${r.step_error || "a step failed"}`); continue; }
      const next = nextStep(r);
      if (!next) { autoRun.current.delete(r.id); toast.success(`${r.business_name || "Pitch"} is ready`); continue; }
      // in flight until the server has marked the step as running
      inFlight.current.add(r.id);
      runStep(r.id, next).then((err) => {
        if (err) { autoRun.current.delete(r.id); toast.error(err); }
        return load();
      }).finally(() => inFlight.current.delete(r.id));
    }
  }, [rows, load]);

  const create = async () => {
    const clean = url.trim();
    if (!/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(clean)) { toast.error("Enter the business website, e.g. examplecafe.com.au"); return; }
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from("pitch_projects").insert({
      owner_id: user.id,
      business_url: /^https?:\/\//i.test(clean) ? clean : `https://${clean}`,
      business_name: name.trim() || null,
      offer_price: price.trim() || null,
    }).select("*").single();
    setCreating(false);
    if (error || !data) { toast.error("Couldn't start that pitch"); return; }
    setUrl(""); setName(""); setPrice("");
    setRows((p) => [data as Row, ...p]);
    setSelectedId(data.id);
    autoRun.current.add(data.id);
    toast.success("Started — scanning the website now");
  };

  const update = async (id: string, patch: Partial<Row>) => {
    const { data, error } = await supabase.from("pitch_projects").update(patch as never).eq("id", id).select("*").single();
    if (error) { toast.error("Couldn't save that change"); return; }
    setRows((p) => p.map((r) => (r.id === id ? (data as Row) : r)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this pitch? The demo link stops working straight away.")) return;
    const { error } = await supabase.from("pitch_projects").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete"); return; }
    setRows((p) => p.filter((r) => r.id !== id));
    setSelectedId(null);
  };

  return (
    <div className="min-h-screen bg-background/80 px-4 pb-24 pt-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/owner-dashboard")} aria-label="Back to Owner Dashboard"><ArrowLeft /></Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Briefcase className="h-6 w-6 text-primary" /> Client Pitch Machine</h1>
            <p className="text-xs text-muted-foreground">Only you can see this. Scan a business, build them a new website + app, then pitch it.</p>
          </div>
        </div>

        <div className={card}>
          <h2 className="mb-3 text-sm font-bold">New pitch</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Business website (e.g. examplecafe.com.au)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input placeholder="Business name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Your price (optional, e.g. A$2,500)" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <Button className="mt-3 w-full sm:w-auto" onClick={create} disabled={creating}>
            {creating ? <Loader2 className="animate-spin" /> : <Rocket />} Scan, build and pitch
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">Takes about 5–10 minutes. Uses about 1.5–2 credits of AI and website reading. You can leave this page — it keeps working.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">No pitches yet.</p>}
            {rows.map((r) => (
              <button key={r.id} onClick={() => setSelectedId(r.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${selectedId === r.id ? "border-primary bg-primary/10" : "border-border/60 bg-card/50 hover:border-primary/40"}`}>
                <p className="truncate text-sm font-semibold">{r.business_name || r.business_url}</p>
                <p className="truncate text-[11px] text-muted-foreground">{r.business_url}</p>
                <StatusPill row={r} />
              </button>
            ))}
          </div>

          {selected ? (
            <PitchDetail row={selected} onUpdate={update} onRemove={remove} onRun={async (step) => {
              const err = await runStep(selected.id, step);
              if (err) toast.error(err); else toast.success("Started");
              load();
            }} onRunAll={() => { autoRun.current.add(selected.id); load(); }} />
          ) : (
            <div className={`${card} text-sm text-muted-foreground`}>Pick a pitch on the left, or start a new one.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ row }: { row: Row }) {
  const running = RUNNING_STATUSES.includes(row.status);
  const label = row.status === "failed" ? "Needs attention" : row.status === "ready" ? "Ready to pitch"
    : running ? `${PITCH_STEPS.find((s) => s.running === row.status)?.label}…` : row.status === "draft" ? "Not started" : `${PITCH_STEPS.find((s) => s.done === row.status)?.label} done`;
  return (
    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${row.status === "failed" ? "bg-destructive/20 text-destructive" : row.status === "ready" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
      {running && <Loader2 className="h-3 w-3 animate-spin" />} {label}
    </span>
  );
}

function PitchDetail({ row, onUpdate, onRemove, onRun, onRunAll }: {
  row: Row; onUpdate: (id: string, p: Partial<Row>) => Promise<void>; onRemove: (id: string) => void;
  onRun: (s: PitchStep) => void; onRunAll: () => void;
}) {
  const [shots, setShots] = useState<{ desktop?: string; mobile?: string }>({});
  const [showDemo, setShowDemo] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const running = RUNNING_STATUSES.includes(row.status);
  const state = demoState(row);
  const link = row.demo_token ? demoLink(row.demo_token) : "";
  const slides: DeckSlide[] = row.deck?.slides || [];
  const a = row.audit || {};

  useEffect(() => {
    setSubject(row.email?.subject || ""); setBody(row.email?.body || ""); setTo(row.email?.to || row.contacts?.emails?.[0] || "");
  }, [row.id, row.email, row.contacts]);

  useEffect(() => {
    let off = false;
    (async () => {
      const out: { desktop?: string; mobile?: string } = {};
      for (const k of ["desktop", "mobile"] as const) {
        const p = row.snapshot?.[`${k}_path`];
        if (p) { const { data } = await supabase.storage.from("pitch-assets").createSignedUrl(p, 3600); out[k] = data?.signedUrl; }
      }
      if (!off) setShots(out);
    })();
    return () => { off = true; };
  }, [row.snapshot]);

  const previewDoc = useMemo(() => (row.demo_html ? lockDemoHtml(row.demo_html, { businessName: row.business_name || "", expiresAt: row.demo_expires_at }) : ""), [row.demo_html, row.business_name, row.demo_expires_at]);

  const turnOn = () => onUpdate(row.id, { demo_token: row.demo_token || newDemoToken(), demo_enabled: true, demo_expires_at: newExpiry() });
  const turnOff = () => onUpdate(row.id, { demo_enabled: false });
  const finalBody = link ? fillEmail(body, link) : body;
  const copy = (t: string, what: string) => navigator.clipboard.writeText(t).then(() => toast.success(`${what} copied`), () => toast.error("Couldn't copy"));
  const saveEmail = () => onUpdate(row.id, { email: { subject, body, to } } as Partial<Row>);

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{row.business_name || row.business_url}</h2>
            <a href={row.business_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary"><Globe className="h-3 w-3" /> {row.business_url}</a>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onRunAll} disabled={running || !nextStep(row)}><Play /> Run everything</Button>
            <Button size="sm" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Delete pitch"><Trash2 /></Button>
          </div>
        </div>
        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
          {PITCH_STEPS.map((s, i) => {
            const isRunning = row.status === s.running;
            const has = [row.snapshot, row.audit, row.demo_html, row.deck][i];
            return (
              <li key={s.key} className={`rounded-xl border p-3 ${has ? "border-primary/50 bg-primary/5" : "border-border/60"}`}>
                <p className="text-xs font-semibold">{i + 1}. {s.label}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{isRunning ? "Working…" : has ? "Done" : "Not yet"}</p>
                <Button size="sm" variant="outline" className="mt-2 h-7 w-full text-xs" disabled={running} onClick={() => onRun(s.key)}>
                  {isRunning ? <Loader2 className="animate-spin" /> : <RefreshCw />} {has ? "Redo" : "Run"}
                </Button>
              </li>
            );
          })}
        </ol>
        {row.status === "failed" && row.step_error && <p className="mt-3 rounded-lg bg-destructive/15 p-2 text-xs text-destructive">{row.step_error}</p>}
      </div>

      {row.snapshot && (
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold">Their website now</h3>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            {shots.desktop ? <img src={shots.desktop} alt="Desktop screenshot" className="w-full rounded-lg border border-border/60" /> : <p className="text-xs text-muted-foreground">No desktop picture</p>}
            {shots.mobile && <img src={shots.mobile} alt="Phone screenshot" className="w-24 rounded-lg border border-border/60 sm:w-32" />}
          </div>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold">Contact details found</p>
              {(row.contacts?.emails || []).map((e: string) => <p key={e} className="text-primary">{e}</p>)}
              {(row.contacts?.phones || []).map((p: string) => <p key={p}>{p}</p>)}
              {!row.contacts?.emails?.length && !row.contacts?.phones?.length && <p className="text-muted-foreground">None on the site — check their contact page.</p>}
            </div>
            <div>
              <p className="font-semibold">Reviews found ({row.reviews?.items?.length || 0})</p>
              <p className="text-muted-foreground">Searched: {(row.reviews?.searched || []).join(", ")}</p>
              {(row.reviews?.items || []).slice(0, 6).map((r: any) => (
                <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="block truncate text-primary">{r.source}: {r.title || r.url}</a>
              ))}
            </div>
          </div>
        </div>
      )}

      {row.audit && (
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold">AI audit {a.current_site?.score_out_of_10 ? `· current site ${a.current_site.score_out_of_10}/10` : ""}</h3>
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <List title="Customer complaints" items={(a.complaints || []).map((c: any) => `${c.issue} — ${c.source || "source"}`)} empty="No public complaints found." />
            <List title="What's missing" items={a.missing || []} />
            <List title="Opportunities" items={a.opportunities || []} />
            <List title={`App idea: ${a.app_concept?.name || ""}`} items={[...(a.app_concept?.customer_features || []).map((f: string) => `Customers: ${f}`), ...(a.app_concept?.owner_features || []).map((f: string) => `Owner: ${f}`)]} />
          </div>
        </div>
      )}

      {row.demo_html && (
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Website + app demo</h3>
            <Button size="sm" variant="outline" onClick={() => setShowDemo((v) => !v)}><Eye /> {showDemo ? "Hide" : "Preview"}</Button>
          </div>
          {showDemo && (
            <iframe title="Demo preview" srcDoc={previewDoc} sandbox="allow-scripts allow-forms" className="mt-3 h-[70vh] w-full rounded-xl border border-border/60 bg-background" />
          )}
        </div>
      )}

      {slides.length > 0 && (
        <div className={card}>
          <h3 className="mb-3 text-sm font-bold">Presentation</h3>
          <PitchDeck slides={slides} businessName={row.business_name} currentSiteImage={shots.desktop} />
        </div>
      )}

      {row.demo_html && (
        <div className={card}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Timer className="h-4 w-4 text-primary" /> Client demo link</h3>
          <p className="text-xs text-muted-foreground">
            {state === "active" ? `Live until ${fmt(row.demo_expires_at)} · ${row.demo_views} views · last viewed ${fmt(row.demo_last_viewed_at)}`
              : state === "expired" ? "Expired — the client sees a 'demo ended' page." : "Switched off — the client can't open it."}
          </p>
          {link && <p className="mt-2 break-all rounded-lg bg-background/60 p-2 text-xs">{link}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === "active" ? (
              <>
                <Button size="sm" variant="destructive" onClick={turnOff}><Power /> Turn off now</Button>
                <Button size="sm" variant="outline" onClick={turnOn}><Timer /> Extend 7 days</Button>
                <Button size="sm" variant="outline" onClick={() => copy(link, "Link")}><Copy /> Copy link</Button>
                <Button size="sm" variant="outline" asChild><a href={link} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></Button>
              </>
            ) : (
              <Button size="sm" onClick={turnOn}><Power /> Turn on for 7 days</Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">The demo can't send or save anything online, can't be downloaded from the page and is watermarked. A technical person could still copy the page code, but it has no real backend, so it's not usable as their business tool without you.</p>
        </div>
      )}

      {row.email && (
        <div className={card}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Mail className="h-4 w-4 text-primary" /> Proposal email</h3>
          <div className="space-y-2">
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their email" />
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} />
            {!link && <p className="text-[11px] text-primary">Turn on the demo link first so it's put into the email.</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={saveEmail}>Save changes</Button>
              <Button size="sm" variant="outline" onClick={() => copy(`${subject}\n\n${finalBody}`, "Email")}><Copy /> Copy</Button>
              <Button size="sm" asChild disabled={!link}>
                <a href={link ? mailtoHref(to, subject, finalBody) : undefined} onClick={(e) => { if (!link) { e.preventDefault(); toast.error("Turn on the demo link first"); } }}><Mail /> Open in my email</a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Nothing is sent automatically — it opens in your own email app so you check it and press send yourself.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {items.length ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">{items.slice(0, 8).map((x, i) => <li key={i}>{x}</li>)}</ul>
      ) : <p className="text-muted-foreground">{empty || "—"}</p>}
    </div>
  );
}
