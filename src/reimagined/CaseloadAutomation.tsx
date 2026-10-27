import { useState } from 'react';
import { Sparkles, ShieldCheck, Info, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Workspace } from './model';
import { prepareCaseload, saveCaseloadPreparation, syntheticCaseload, type CaseloadItem } from './automation';

export function CaseloadAutomation({ w, save, saving }: { w: Workspace; save: (w: Workspace) => Promise<boolean>; saving: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CaseloadItem[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [load, setLoad] = useState<{ size: number; active: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'review'>('all');
  const [notice, setNotice] = useState('');
  function prepare() {
    try { const result = prepareCaseload(w); setItems(result); setSelected(result.map(i => i.claim.id)); setSaved(false); setNotice(''); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Unable to prepare claims.'); }
  }
  async function commit() {
    if (!items) return;
    if (await save(saveCaseloadPreparation(w, items.filter(i => selected.includes(i.claim.id))))) setSaved(true);
  }
  const visible = items?.filter(i => filter === 'all' || i.flags.length > 0) ?? [];
  return <>
    <Button className="ri-primary" disabled={saving} onClick={() => setOpen(true)}><Sparkles />AI caseload automation</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="reimagined-theme ri-popup max-w-4xl max-h-[90dvh] overflow-y-auto">
      <DialogTitle className="text-2xl text-accent">AI caseload automation</DialogTitle>
      <DialogDescription>Whole-caseload review · prepared examples, not live AI</DialogDescription>
      <section className="border-y border-border py-4 space-y-3">
        <p className="flex gap-2"><ShieldCheck className="shrink-0 text-accent" />You retain medical, claim, payment and communication decisions.</p>
        <p className="text-muted-foreground">Active claims: {w.claims.filter(c => c.status !== 'Closed').length}. Closed claims are excluded. Contact drafts remain unsent; CC/BCC and disclosure permissions require your review.</p>
        <Button className="ri-primary" disabled={saving} onClick={prepare}><Sparkles />Prepare all active claims<ArrowRight /></Button>
      </section>
      {notice && <p role="alert" className="ri-error">{notice}</p>}
      {items && <section className="space-y-4">
        <div className="flex flex-wrap gap-3 items-center"><h2 className="text-lg font-semibold">{items.length} claims checked · {items.filter(i => i.flags.length).length} need evidence review</h2>
          <select aria-label="Caseload filter" className="ri-select" value={filter} onChange={e => setFilter(e.target.value === 'review' ? 'review' : 'all')}><option value="all">All active claims</option><option value="review">Evidence review first</option></select>
        </div>
        {visible.slice(0, 50).map(item => <article key={item.claim.id} className="border-b border-border py-4 space-y-2">
          <label className="flex gap-3 items-center font-semibold"><input type="checkbox" className="h-5 w-5 accent-primary" checked={selected.includes(item.claim.id)} disabled={saved || saving} onChange={e => setSelected(prev => e.target.checked ? [...prev, item.claim.id] : prev.filter(id => id !== item.claim.id))} />{item.claim.name} · {item.claim.id}</label>
          <p>{item.flags.length ? item.flags.join(' • ') : 'No predefined discrepancy; confirm current capacity with the worker.'}</p>
          <p className="text-muted-foreground">{item.tasks.length} new task · {item.drafts.length} new doctor-contact draft · {item.claim.priority} priority</p>
          {item.drafts.map(d => <details key={d.id}><summary className="cursor-pointer text-accent">Review contact draft and recipients</summary><div className="whitespace-pre-wrap mt-3 text-sm"><p>To: {d.to}</p><p>CC: {d.cc || 'None'} · BCC: {d.bcc || 'None'}</p><p className="mt-3">{d.text}</p></div></details>)}
        </article>)}
        {visible.length > 50 && <p>First 50 shown. Selected claims: {selected.length}.</p>}
        <Button className="ri-primary" disabled={saving || saved || !selected.length || !items.some(i => selected.includes(i.claim.id) && (i.tasks.length || i.drafts.length))} onClick={() => void commit()}><Check />{saved ? 'Preparation saved' : 'Save selected tasks and drafts'}</Button>
        {saved && <p role="status">Saved to Tasks, Contacts and Activity. Nothing sent; no claim decisions changed.</p>}
      </section>}
      <section className="border-t border-border pt-4 space-y-3"><h2 className="flex gap-2 text-lg font-semibold"><Info className="text-accent" />Fictional scale check</h2><div className="flex flex-wrap gap-3">{([500, 1000] as const).map(size => <Button key={size} variant="outline" className="ri-control" onClick={() => { const result = prepareCaseload(syntheticCaseload(size, w)); setLoad({ size, active: result.length }); }}>Check {size.toLocaleString()} fictional claims</Button>)}</div>
        {load && <p role="status">{load.active.toLocaleString()} of {load.size.toLocaleString()} synthetic claims checked. No accounts created or records saved. This checks preparation only—not live AI capacity or safe staffing levels.</p>}
      </section>
    </DialogContent></Dialog>
  </>;
}