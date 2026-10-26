import { useState } from 'react';
import { Mail, Phone, MessageSquare, Sparkles, FileText, AlertTriangle, Check, Copy, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contacts, records, prepareContactDraft, type Contact } from './records';
import { logActivity, uid, type Claim, type Workspace } from './model';

type Props = { w: Workspace; claim: Claim; selectedId: string; setSelectedId: (id: string) => void; save: (w: Workspace) => Promise<boolean>; saving: boolean };

function ClaimPicker({ w, selectedId, setSelectedId }: Pick<Props, 'w' | 'selectedId' | 'setSelectedId'>) {
  return <><label htmlFor="cr-claim">Selected claim</label><select id="cr-claim" className="ri-select mb-6" value={selectedId} onChange={e => setSelectedId(e.target.value)}>{w.claims.map(c => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}</select></>;
}

export function ContactsView(p: Props) {
  const [active, setActive] = useState<Contact | null>(null);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const list = contacts.filter(c => c.claimId === p.claim.id && `${c.name} ${c.role} ${c.org}`.toLowerCase().includes(q.toLowerCase()));
  const related = records.filter(r => r.claimId === p.claim.id);
  const prepare = (c: Contact) => { setActive(c); setDraft(prepareContactDraft(c, p.claim, related)); };
  async function prepareAll() {
    const all = contacts.filter(c => c.claimId === p.claim.id).map(c => ({ id: uid(), claimId: p.claim.id, to: `${c.name} · ${c.role}`, text: prepareContactDraft(c, p.claim, related), at: new Date().toISOString() }));
    await p.save(logActivity({ ...p.w, drafts: [...all, ...p.w.drafts].slice(0, 200) }, `AI prepared ${all.length} contact drafts for ${p.claim.id} (not sent)`));
  }
  async function saveDraft() {
    if (!active) return;
    if (await p.save(logActivity({ ...p.w, drafts: [{ id: uid(), claimId: p.claim.id, to: `${active.name} · ${active.role}`, text: draft.slice(0, 4000), at: new Date().toISOString() }, ...p.w.drafts].slice(0, 200) }, `Contact draft saved for ${active.name} (${p.claim.id}) — not sent`))) setActive(null);
  }
  const saved = p.w.drafts.filter(d => d.claimId === p.claim.id);
  return <>
    <ClaimPicker {...p} />
    <section className="ri-ai-band"><Sparkles /><div><p className="ri-eyebrow">AI CONTACT CENTRE</p><h2>Everyone on this claim, one tap away.</h2><p>AI prepares the right message for each person using the medical records and reports. You review it. Nothing is sent.</p></div><Button className="ri-primary" disabled={p.saving} onClick={() => void prepareAll()}><Sparkles />Prepare all drafts</Button></section>
    <div className="ri-search"><Search /><Input aria-label="Search contacts" placeholder="Search name, role or organisation" value={q} onChange={e => setQ(e.target.value)} /></div>
    <div className="ri-claim-grid">{list.map(c => <article className="ri-claim-card" key={c.id}><div className="flex items-center justify-between"><span className="ri-eyebrow">{c.role}</span><span className="ri-demo-label">PREFERS {c.prefers.toUpperCase()}</span></div><h2>{c.name}</h2><p>{c.org}</p><dl><dt>Phone</dt><dd>{c.phone}</dd><dt>Email</dt><dd className="break-all">{c.email}</dd></dl><Button className="ri-primary" onClick={() => prepare(c)}><Sparkles />AI prepare message</Button></article>)}</div>
    {!list.length && <p>No matching contacts.</p>}
    {active && <section className="ri-card mt-8"><div className="ri-section-title"><h2>Draft for {active.name}</h2><span className="ri-demo-label">NOT SENT</span></div><Textarea aria-label="Contact draft" className="min-h-[260px]" value={draft} maxLength={4000} onChange={e => setDraft(e.target.value)} /><div className="flex flex-wrap gap-3 mt-3"><Button className="ri-primary" disabled={p.saving} onClick={() => void saveDraft()}><Check />Save draft for review</Button><Button variant="outline" className="ri-control" onClick={() => void navigator.clipboard?.writeText(draft)}><Copy />Copy</Button><Button variant="ghost" className="ri-control" onClick={() => setActive(null)}>Cancel</Button></div><p className="ri-disclaimer mt-3">{active.prefers === 'Email' ? <Mail className="inline h-4 w-4" /> : active.prefers === 'Phone' ? <Phone className="inline h-4 w-4" /> : <MessageSquare className="inline h-4 w-4" />} In a live system this would go by {active.prefers} after a person approves it. This demo never sends.</p></section>}
    <h2 className="mt-10 mb-4">Saved drafts for {p.claim.id} ({saved.length})</h2>
    {saved.length ? saved.map(d => <details className="ri-task" key={d.id}><summary className="cursor-pointer"><strong>{d.to}</strong> <small>· {new Date(d.at).toLocaleString('en-AU')} · awaiting review</small></summary><p className="whitespace-pre-wrap mt-3 text-sm">{d.text}</p></details>) : <p className="text-muted-foreground">No saved drafts yet.</p>}
  </>;
}

export function RecordsView(p: Props) {
  const [kind, setKind] = useState('All');
  const all = records.filter(r => r.claimId === p.claim.id);
  const shown = kind === 'All' ? all : all.filter(r => r.kind === kind);
  const flags = all.filter(r => r.flag);
  const kinds = ['All', ...Array.from(new Set(all.map(r => r.kind)))];
  return <>
    <ClaimPicker {...p} />
    <section className="ri-ai-band"><Sparkles /><div><p className="ri-eyebrow">AI RECORD CHECK</p><h2>{flags.length ? `${flags.length} item${flags.length > 1 ? 's' : ''} need attention` : 'Nothing flagged'}</h2><p>All medical records, certificates and reports for this claim in one timeline. AI highlights gaps and mismatches for a person to check.</p></div></section>
    {flags.map(r => <article className="ri-evidence" key={`f-${r.id}`}><AlertTriangle className="text-accent" /><div><strong>{r.title}</strong><p>{r.flag}</p></div><span className="ri-demo-label">REVIEW</span></article>)}
    <div className="flex flex-wrap gap-2 my-6">{kinds.map(k => <Button key={k} variant={kind === k ? 'default' : 'outline'} className="ri-control" onClick={() => setKind(k)}>{k}</Button>)}</div>
    {shown.map(r => <div className="ri-task" key={r.id}><FileText className="text-primary shrink-0" /><div><strong>{r.title}</strong><small>{r.kind} · {r.from} · {r.date}</small><p className="text-sm mt-1">{r.summary}</p></div></div>)}
    <p className="ri-disclaimer mt-6">Fictional records. Not real medical information. AI flags are for human review only — never a medical or claim decision.</p>
  </>;
}
