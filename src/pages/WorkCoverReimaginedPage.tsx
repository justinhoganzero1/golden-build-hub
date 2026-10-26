import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import {
  ArrowLeft, LayoutDashboard, Users, ShieldAlert, UserRound, Sparkles, Loader2, CheckCircle2,
  FileText, ClipboardList, Wallet, MessageSquare, Plus, Copy, RotateCcw, Search, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireEdgeAuthToken } from "@/lib/edgeAuth";
import { reviewWorkcoverDemo } from "@/lib/workcoverReview.js";
import logoUrl from "@/assets/reimagined-insurance-logo.png";

// Showcase only: every person, employer and record below is fictional.
type Task = { id: string; title: string; owner: string; due: string; status: "open" | "done" };
type Doc = { id: string; kind: "certificate" | "report" | "invoice"; title: string; date: string; expires?: string; capacity?: string };
type Expense = { id: string; provider: string; invoice: string; cents: number; serviceDate: string; receipt: boolean };
type Note = { at: string; text: string };
type Case = {
  id: string; worker: string; age: number; occupation: string; employer: string; injury: string;
  injuryDate: string; status: "New" | "Active" | "Return to work" | "Closing"; capacity: string;
  doctor: string; manager: string; weeklyCents: number; rtwHours: number; tasks: Task[]; docs: Doc[];
  expenses: Expense[]; notes: Note[];
};

const TODAY = new Date().toISOString().slice(0, 10);
const daysFrom = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const SEED: Case[] = [
  {
    id: "WC-24-1031", worker: "Sam Taylor", age: 41, occupation: "Forklift operator", employer: "Riverbend Logistics (fictional)",
    injury: "Lower back strain lifting pallets", injuryDate: daysFrom(-62), status: "Active", capacity: "Suitable duties, no lifting over 5 kg, 4 hrs/day",
    doctor: "Dr A. Nguyen", manager: "J. Hogan", weeklyCents: 98400, rtwHours: 4,
    tasks: [
      { id: "T-1", title: "Call worker about physio progress", owner: "J. Hogan", due: daysFrom(-3), status: "open" },
      { id: "T-2", title: "Confirm suitable duties with employer", owner: "J. Hogan", due: daysFrom(2), status: "open" },
    ],
    docs: [
      { id: "C-1", kind: "certificate", title: "Work capacity certificate #3", date: daysFrom(-30), expires: daysFrom(-2), capacity: "4 hrs/day, no lifting > 5 kg" },
      { id: "R-1", kind: "report", title: "Physio progress report", date: daysFrom(-10) },
    ],
    expenses: [
      { id: "E-1", provider: "Brisbane Physio Co", invoice: "INV-2207", cents: 9500, serviceDate: daysFrom(-14), receipt: true },
      { id: "E-2", provider: "Brisbane Physio Co", invoice: "INV-2207", cents: 9500, serviceDate: daysFrom(-14), receipt: true },
      { id: "E-3", provider: "City Imaging", invoice: "CI-881", cents: 32000, serviceDate: daysFrom(-40), receipt: false },
    ],
    notes: [{ at: daysFrom(-10), text: "Worker reports less pain but worried about job security." }],
  },
  {
    id: "WC-24-1088", worker: "Priya Raman", age: 29, occupation: "Aged care nurse", employer: "Sunrise Care Homes (fictional)",
    injury: "Shoulder injury assisting resident transfer", injuryDate: daysFrom(-21), status: "New", capacity: "No capacity for 2 weeks",
    doctor: "Dr B. Collins", manager: "J. Hogan", weeklyCents: 112000, rtwHours: 0,
    tasks: [{ id: "T-3", title: "Initial contact with worker within 3 business days", owner: "J. Hogan", due: daysFrom(1), status: "open" }],
    docs: [{ id: "C-2", kind: "certificate", title: "Work capacity certificate #1", date: daysFrom(-20), expires: daysFrom(5), capacity: "No capacity" }],
    expenses: [{ id: "E-4", provider: "Northside GP", invoice: "NG-14", cents: 8900, serviceDate: daysFrom(-20), receipt: true }],
    notes: [],
  },
  {
    id: "WC-23-0977", worker: "Lena Brooks", age: 52, occupation: "Retail team leader", employer: "Harbour Fresh Market (fictional)",
    injury: "Wrist fracture from slip on wet floor", injuryDate: daysFrom(-120), status: "Return to work", capacity: "Full hours, light duties",
    doctor: "Dr C. Patel", manager: "J. Hogan", weeklyCents: 0, rtwHours: 7.6,
    tasks: [{ id: "T-4", title: "Final review meeting", owner: "J. Hogan", due: daysFrom(9), status: "open" }],
    docs: [{ id: "C-3", kind: "certificate", title: "Work capacity certificate #6", date: daysFrom(-7), expires: daysFrom(21), capacity: "Full hours, light duties" }],
    expenses: [],
    notes: [{ at: daysFrom(-7), text: "Back at work full hours. Very positive." }],
  },
];

const STORE_KEY = "worker-assist-reimagined-v1";
const money = (c: number) => `$${(c / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;

function recordsFor(c: Case) {
  return [
    ...c.expenses.map((e) => ({ kind: "expense", ...e })),
    ...c.docs.filter((d) => d.kind === "certificate").map((d) => ({ kind: "certificate", id: d.id, expires: d.expires })),
    ...c.tasks.map((t) => ({ kind: "task", ...t, owner: t.owner })),
  ];
}

type View = "dashboard" | "cases" | "checks" | "worker";
type Tab = "overview" | "tasks" | "docs" | "money" | "ai";

const AI_ACTIONS: { id: string; label: string; needsText?: boolean; hint?: string }[] = [
  { id: "summary", label: "Case summary" },
  { id: "triage", label: "Triage & risk flags" },
  { id: "rtw_plan", label: "Return-to-work plan" },
  { id: "letter", label: "Letter to worker", hint: "Optional: what the letter should say" },
  { id: "ask", label: "Ask about this case", needsText: true, hint: "Type your question" },
  { id: "document", label: "Read a document", needsText: true, hint: "Paste certificate, invoice or report text" },
  { id: "plain_english", label: "Plain-English rewrite", needsText: true, hint: "Paste formal text to simplify" },
];

export default function WorkCoverReimaginedPage() {
  const [cases, setCases] = useState<Case[]>(() => {
    try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch { /* ignore */ }
    return SEED;
  });
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState(SEED[0].id);
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [aiAction, setAiAction] = useState("summary");
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newNote, setNewNote] = useState("");
  const [workerMsg, setWorkerMsg] = useState("");
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(cases)); }, [cases]);

  const selected = cases.find((c) => c.id === selectedId) ?? cases[0];
  const alertsByCase = useMemo(() => Object.fromEntries(cases.map((c) => [c.id, reviewWorkcoverDemo(recordsFor(c), TODAY)])), [cases]);
  const allAlerts = cases.flatMap((c) => alertsByCase[c.id].map((a: any) => ({ ...a, caseId: c.id, worker: c.worker })));
  const filtered = cases.filter((c) => `${c.id} ${c.worker} ${c.employer} ${c.injury}`.toLowerCase().includes(query.toLowerCase()));

  const update = (fn: (c: Case) => Case) => setCases((all) => all.map((c) => (c.id === selected.id ? fn(c) : c)));

  async function runAI(action: string, text?: string) {
    if (!signedIn) { toast.error("AI is disabled in this public demo"); return; }
    const meta = AI_ACTIONS.find((a) => a.id === action);
    if ((meta?.needsText || action === "explain_alert") && !text?.trim()) { toast.error(meta?.hint ?? "Add some text first"); return; }
    setAiBusy(true); setAiAnswer(""); setTab("ai"); setView("cases");
    try {
      await requireEdgeAuthToken();
      const { data, error } = await supabase.functions.invoke("workcover-ai", {
        body: { action, case_data: selected, text: text ?? "", request_key: crypto.randomUUID() },
      });
      if (error) {
        let msg = "The AI couldn't finish that.";
        try { const b = await (error as any).context?.json(); msg = b?.message || b?.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setAiAnswer(data.answer);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI unavailable");
    } finally { setAiBusy(false); }
  }

  const NavBtn = ({ id, icon: Icon, label }: { id: View; icon: any; label: string }) => (
    <button onClick={() => setView(id)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );

  return (
    <div className="reimagined-theme min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/dashboard" className="mr-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />App</Link>
          <img src={logoUrl} alt="Reimagined Insurance logo" width={32} height={32} className="h-8 w-8 rounded-md" />
          <h1 className="mr-auto text-lg font-bold">Reimagined <span className="text-primary">Insurance</span></h1>
          <nav className="flex flex-wrap gap-1">
            <NavBtn id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavBtn id="cases" icon={Users} label="Cases" />
            <NavBtn id="checks" icon={ShieldAlert} label="Evidence checks" />
            <NavBtn id="worker" icon={UserRound} label="Worker view" />
          </nav>
        </div>
        <p className="border-t border-border bg-muted/40 px-4 py-1.5 text-center text-xs text-muted-foreground">
          <Info className="mr-1 inline h-3 w-3" />Independent showcase with fictional records. Not connected to any real insurer or government system. AI suggestions always go to a human for decision.
        </p>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {view === "dashboard" && (
          <section className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Open cases", cases.length],
                ["Tasks overdue", cases.flatMap((c) => c.tasks).filter((t) => t.status === "open" && t.due < TODAY).length],
                ["Items to review", allAlerts.length],
                ["Back at work", cases.filter((c) => c.status === "Return to work").length],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{l}</p><p className="text-3xl font-bold text-primary">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-semibold">Today's priorities</h2>
              <ul className="space-y-2">
                {allAlerts.slice(0, 6).map((a: any) => (
                  <li key={a.caseId + a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2 text-sm">
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{a.priority}</span>
                    <span className="font-medium">{a.title}</span><span className="text-muted-foreground">— {a.worker}</span>
                    <button className="ml-auto text-xs text-primary underline" onClick={() => { setSelectedId(a.caseId); setView("cases"); setTab("overview"); }}>Open case</button>
                  </li>
                ))}
                {allAlerts.length === 0 && <li className="text-sm text-muted-foreground">All clear.</li>}
              </ul>
            </div>
            <button onClick={() => { setCases(SEED); toast.success("Demo data reset"); }} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><RotateCcw className="h-3 w-3" />Reset demo data</button>
          </section>
        )}

        {view === "cases" && (
          <section className="grid gap-4 md:grid-cols-[260px_1fr]">
            <aside className="space-y-2">
              <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cases" className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-sm" /></div>
              {filtered.map((c) => (
                <button key={c.id} onClick={() => { setSelectedId(c.id); setAiAnswer(""); }} className={`w-full rounded-lg border p-3 text-left text-sm ${c.id === selected.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                  <p className="font-semibold">{c.worker}</p><p className="text-xs text-muted-foreground">{c.id} · {c.status}</p>
                  {alertsByCase[c.id].length > 0 && <p className="mt-1 text-xs text-primary">{alertsByCase[c.id].length} to review</p>}
                </button>
              ))}
            </aside>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-2">
                <h2 className="text-xl font-bold">{selected.worker}</h2>
                <span className="text-sm text-muted-foreground">{selected.occupation} · {selected.employer}</span>
                <select value={selected.status} onChange={(e) => update((c) => ({ ...c, status: e.target.value as Case["status"] }))} className="ml-auto rounded border border-border bg-background px-2 py-1 text-xs">
                  {["New", "Active", "Return to work", "Closing"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
                {([["overview", Info, "Overview"], ["tasks", ClipboardList, "Tasks"], ["docs", FileText, "Documents"], ["money", Wallet, "Payments"], ...(signedIn ? [["ai", Sparkles, "AI assistant"] as const] : [])] as const).map(([id, Icon, l]) => (
                  <button key={id} onClick={() => setTab(id)} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Icon className="h-4 w-4" />{l}</button>
                ))}
              </div>

              {tab === "overview" && (
                <div className="space-y-4 text-sm">
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {[["Injury", selected.injury], ["Injury date", selected.injuryDate], ["Capacity", selected.capacity], ["Treating doctor", selected.doctor], ["Case manager", selected.manager], ["Weekly compensation", money(selected.weeklyCents)]].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-muted/40 p-2"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
                    ))}
                  </dl>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Return-to-work hours per day: {selected.rtwHours}</p>
                    <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, (selected.rtwHours / 7.6) * 100)}%` }} /></div>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">Case notes</h3>
                    <div className="flex gap-2"><input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
                      <button onClick={() => { if (!newNote.trim()) return; update((c) => ({ ...c, notes: [{ at: TODAY, text: newNote.trim() }, ...c.notes] })); setNewNote(""); }} className="rounded-lg bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button></div>
                    <ul className="mt-2 space-y-1">{selected.notes.map((n, i) => <li key={i} className="rounded bg-muted/40 p-2"><span className="text-xs text-muted-foreground">{n.at}</span> {n.text}</li>)}</ul>
                  </div>
                  {alertsByCase[selected.id].map((a: any) => (
                    <div key={a.id} className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                      <p className="font-semibold">{a.title}</p><p className="text-xs text-muted-foreground">{a.evidence}</p><p className="mt-1">{a.next}</p>
                      <button onClick={() => runAI("explain_alert", `${a.title}. ${a.evidence} ${a.next}`)} className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"><Sparkles className="h-3 w-3" />Explain with AI</button>
                    </div>
                  ))}
                </div>
              )}

              {tab === "tasks" && (
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2"><input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task (due in 3 days)" className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
                    <button onClick={() => { if (!newTask.trim()) return; update((c) => ({ ...c, tasks: [...c.tasks, { id: `T-${Date.now()}`, title: newTask.trim(), owner: c.manager, due: daysFrom(3), status: "open" }] })); setNewTask(""); }} className="rounded-lg bg-primary px-3 text-primary-foreground"><Plus className="h-4 w-4" /></button></div>
                  {selected.tasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                      <input type="checkbox" checked={t.status === "done"} onChange={() => update((c) => ({ ...c, tasks: c.tasks.map((x) => (x.id === t.id ? { ...x, status: x.status === "done" ? "open" : "done" } : x)) }))} />
                      <span className={t.status === "done" ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                      <span className={`ml-auto text-xs ${t.status === "open" && t.due < TODAY ? "text-destructive" : "text-muted-foreground"}`}>due {t.due}</span>
                    </label>
                  ))}
                </div>
              )}

              {tab === "docs" && (
                <div className="space-y-2 text-sm">
                  {selected.docs.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2">
                      <FileText className="h-4 w-4 text-primary" /><span className="font-medium">{d.title}</span>
                      <span className="text-xs text-muted-foreground">{d.date}{d.expires ? ` · expires ${d.expires}` : ""}{d.capacity ? ` · ${d.capacity}` : ""}</span>
                      {d.kind === "certificate" && <button onClick={() => update((c) => ({ ...c, docs: c.docs.map((x) => (x.id === d.id ? { ...x, expires: daysFrom(28) } : x)) }))} className="ml-auto text-xs text-primary underline">Record updated certificate</button>}
                    </div>
                  ))}
                  <button onClick={() => { setAiAction("document"); setTab("ai"); }} className="inline-flex items-center gap-1 text-xs text-primary underline"><Sparkles className="h-3 w-3" />Read a new document with AI</button>
                </div>
              )}

              {tab === "money" && (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground"><th>Provider</th><th>Invoice</th><th>Date</th><th>Amount</th><th>Receipt</th></tr></thead>
                  <tbody>{selected.expenses.map((e) => (
                    <tr key={e.id} className="border-t border-border"><td className="py-2">{e.provider}</td><td>{e.invoice}</td><td>{e.serviceDate}</td><td>{money(e.cents)}</td>
                      <td>{e.receipt ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <button onClick={() => update((c) => ({ ...c, expenses: c.expenses.map((x) => (x.id === e.id ? { ...x, receipt: true } : x)) }))} className="text-xs text-primary underline">Mark received</button>}</td></tr>
                  ))}</tbody>
                </table>
              )}

              {tab === "ai" && (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {AI_ACTIONS.map((a) => <button key={a.id} onClick={() => setAiAction(a.id)} className={`rounded-full border px-3 py-1 text-xs ${aiAction === a.id ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{a.label}</button>)}
                  </div>
                  {AI_ACTIONS.find((a) => a.id === aiAction)?.hint && (
                    <textarea value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder={AI_ACTIONS.find((a) => a.id === aiAction)?.hint} className="min-h-[110px] w-full rounded-lg border border-border bg-background p-3" />
                  )}
                  <button disabled={aiBusy} onClick={() => runAI(aiAction, aiText)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-60">
                    {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{aiBusy ? "Thinking…" : "Run AI"}
                  </button>
                  <p className="text-xs text-muted-foreground">Each AI answer is a small charge to your wallet. Nothing is charged if it fails.</p>
                  {aiAnswer && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{aiAnswer}</ReactMarkdown></div>
                      <div className="mt-3 flex gap-3">
                        <button onClick={() => { navigator.clipboard.writeText(aiAnswer); toast.success("Copied"); }} className="inline-flex items-center gap-1 text-xs text-primary underline"><Copy className="h-3 w-3" />Copy</button>
                        <button onClick={() => { update((c) => ({ ...c, notes: [{ at: TODAY, text: `AI draft saved: ${aiAnswer.slice(0, 160)}…` }, ...c.notes] })); toast.success("Saved to case notes"); }} className="text-xs text-primary underline">Save to case notes</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "checks" && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold">Evidence checks</h2>
            <p className="text-sm text-muted-foreground">Automatic checks flag items for a person to review. They are never a fraud finding and never stop a payment on their own.</p>
            {allAlerts.map((a: any) => (
              <div key={a.caseId + a.id} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{a.priority}</span><span className="font-semibold">{a.title}</span><span className="text-muted-foreground">— {a.worker} ({a.caseId})</span></div>
                <p className="mt-1 text-muted-foreground">{a.evidence}</p><p className="mt-1">{a.next}</p>
                <button onClick={() => { setSelectedId(a.caseId); runAI("explain_alert", `${a.title}. ${a.evidence} ${a.next}`); }} className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"><Sparkles className="h-3 w-3" />Explain with AI</button>
              </div>
            ))}
            {allAlerts.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review.</p>}
          </section>
        )}

        {view === "worker" && (
          <section className="mx-auto max-w-xl space-y-4">
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="rounded border border-border bg-background px-2 py-1 text-sm">
              {cases.map((c) => <option key={c.id} value={c.id}>{c.worker}</option>)}
            </select>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Hi {selected.worker.split(" ")[0]},</p>
              <h2 className="text-xl font-bold">Your claim at a glance</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li><b>Status:</b> {selected.status}</li>
                <li><b>Your work right now:</b> {selected.capacity}</li>
                <li><b>Your case manager:</b> {selected.manager}</li>
                <li><b>Next step:</b> {selected.tasks.find((t) => t.status === "open")?.title ?? "No actions needed"}</li>
              </ul>
              <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm"><b>Upcoming:</b> certificate {selected.docs.find((d) => d.kind === "certificate")?.expires ?? "—"}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-2 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />Message your case manager</h3>
              <textarea value={workerMsg} onChange={(e) => setWorkerMsg(e.target.value)} className="min-h-[90px] w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Type a message" />
              <button onClick={() => { if (!workerMsg.trim()) return; update((c) => ({ ...c, notes: [{ at: TODAY, text: `Worker message: ${workerMsg.trim()}` }, ...c.notes] })); setWorkerMsg(""); toast.success("Sent to your case manager (demo)"); }} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Send</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
