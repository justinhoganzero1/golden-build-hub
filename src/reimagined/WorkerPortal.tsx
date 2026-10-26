import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle, FileText, HeartPulse, MessageSquare, Send, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { reimaginedClient as client } from './client';
import type { Tables } from '@/integrations/supabase/types';

type WorkerCase = Tables<'reimagined_worker_cases'>;
type WorkerMessage = Tables<'reimagined_worker_messages'>;
export function WorkerPortal({ userId, manager = false, onExplain }: { userId: string; manager?: boolean; onExplain: () => void }) {
  const [cases, setCases] = useState<WorkerCase[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [text, setText] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('My claim');
  async function load() {
    setError('');
    const result = await client.from('reimagined_worker_cases').select('*').order('claim_id');
    if (result.error) { setError('Unable to load the claim. Please retry.'); return; }
    setCases(result.data);
    setSelected(old => old || result.data[0]?.claim_id || '');
  }
  useEffect(() => { void load(); }, [userId]);
  const claim = cases.find(c => c.claim_id === selected);
  async function loadMessages() {
    if (!selected) return;
    const result = await client.from('reimagined_worker_messages').select('*').eq('claim_id', selected).order('created_at');
    if (result.error) setError('Unable to load messages. Please retry.');
    else setMessages(result.data);
  }
  useEffect(() => { void loadMessages(); setNextStep(claim?.next_step ?? ''); setText(''); setNotice(''); }, [selected, claim?.next_step]);
  async function send() {
    if (!claim || !text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await client.from('reimagined_worker_messages').insert({ claim_id: claim.claim_id, sender_id: userId, text: text.trim() });
      if (result.error) { setError('Message was not saved. Your draft is still here. Please retry.'); return; }
      setText(''); setNotice('Message saved to this fictional claim. No email or SMS was sent.'); await loadMessages();
    } finally { setBusy(false); }
  }
  async function updatePlan() {
    if (!claim || !nextStep.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await client.from('reimagined_worker_cases').update({ next_step: nextStep.trim(), updated_at: new Date().toISOString() }).eq('claim_id', claim.claim_id);
      if (result.error) { setError('Next step was not saved. Please retry.'); return; }
      setNotice('Next step saved. The worker can read it in their account.'); await load();
    } finally { setBusy(false); }
  }
  return <section className="ri-worker-portal">
    <div className="ri-section-title"><h2>{manager ? 'Worker accounts' : 'Your claim, one step at a time.'}</h2><div className="flex gap-2"><Button variant="outline" className="ri-control" onClick={() => { void load(); void loadMessages(); }}><RefreshCw />Refresh</Button><Button variant="outline" className="ri-control" onClick={onExplain}><ShieldCheck />Why this helps</Button></div></div>
    {error && <p className="ri-error" role="alert">{error}</p>}
    {notice && <p role="status" className="ri-success">{notice}</p>}
    {manager && <><label htmlFor="worker-account">View a worker account</label><select id="worker-account" className="ri-select" value={selected} onChange={e => setSelected(e.target.value)}>{cases.map(c => <option key={c.claim_id} value={c.claim_id}>{c.worker_name} · {c.claim_id}</option>)}</select><p className="ri-disclaimer">Manager view of fictional worker accounts. Private manager notes are not shared here.</p></>}
    {!claim ? <p>Loading your claim…</p> : <>
      <div className="ri-worker-summary"><span className="ri-avatar">{claim.worker_name.split(' ').map(n => n[0]).join('')}</span><div><p className="ri-eyebrow">{claim.claim_id} · FICTIONAL CLAIM</p><h2>{claim.worker_name}</h2><p>{claim.employer}</p></div><span className="ri-status ri-status-review">{claim.stage}</span></div>
      <nav className="ri-worker-tabs" aria-label="Worker account sections">{[{ name: 'My claim', icon: ShieldCheck }, { name: 'My recovery', icon: HeartPulse }, { name: 'My documents', icon: FileText }, { name: 'Messages', icon: MessageSquare }].map(t => <Button variant="outline" className={`ri-control ${tab === t.name ? 'ri-nav-active' : ''}`} key={t.name} onClick={() => setTab(t.name)}><t.icon />{t.name}</Button>)}</nav>
      {tab === 'My claim' && <><div className="ri-next-step"><p className="ri-eyebrow">YOUR NEXT STEP</p><h2>{claim.next_step}</h2><p>Last updated {new Date(claim.updated_at).toLocaleDateString('en-AU')}. Your case team remains responsible for decisions.</p><Button className="ri-primary" onClick={() => setTab('Messages')}>Ask my case team<ArrowRight /></Button></div><dl className="ri-facts"><dt>Claim stage</dt><dd>{claim.stage === 'Review' ? 'Your information is being reviewed.' : claim.stage === 'Recovery' ? 'Your recovery plan is being reviewed with you.' : 'This fictional claim is closed.'}</dd><dt>Recorded injury</dt><dd>{claim.injury}</dd><dt>Current capacity</dt><dd>{claim.capacity}</dd></dl>{manager && <form onSubmit={e => { e.preventDefault(); void updatePlan(); }}><label htmlFor="worker-next-step">Set the next step the worker sees</label><Textarea id="worker-next-step" value={nextStep} maxLength={1000} onChange={e => setNextStep(e.target.value)} /><Button className="ri-primary mt-4" type="submit" disabled={busy || !nextStep.trim()}>Save worker next step<CheckCircle /></Button></form>}</>}
      {tab === 'My recovery' && <><h2>My recovery plan</h2><p className="ri-disclaimer">Example plan only. Not medical advice or an approved return-to-work direction.</p><div className="ri-recovery-plan">{['Confirm current capacity', 'Agree safe duties with the case team', 'Review progress together'].map((step, i) => <div key={step}><span>{i + 1}</span><div><h3>{step}</h3><p>{i === 0 ? claim.capacity : 'Your case team and clinician review this with you.'}</p></div></div>)}</div></>}
      {tab === 'My documents' && <><h2>My document checklist</h2><div className="ri-task"><FileText /><div><strong>Current capacity certificate</strong><small>Example: update required. No real document upload is available in this evaluation.</small></div></div><div className="ri-task"><CheckCircle /><div><strong>Incident statement</strong><small>Fictional example recorded for review.</small></div></div><Button className="ri-primary mt-4" onClick={() => { setTab('Messages'); setText('Please let me know which capacity certificate details you need.'); }}>Ask about a document<ArrowRight /></Button></>}
      {tab === 'Messages' && <><div className="ri-section-title"><h2>Messages with the case team</h2><Button variant="link" onClick={() => void loadMessages()}><RefreshCw />Refresh messages</Button></div>{messages.length ? messages.map(m => <article className="ri-message" key={m.id}><span>{m.sender_id === claim.worker_user_id ? 'WORKER' : 'CASE TEAM'} · {new Date(m.created_at).toLocaleString('en-AU')}</span><p>{m.text}</p></article>) : <p>No messages yet.</p>}<form onSubmit={e => { e.preventDefault(); void send(); }}><label htmlFor="worker-message">{manager ? 'Message to worker' : 'Message to case team'}</label><Textarea id="worker-message" value={text} maxLength={2000} onChange={e => setText(e.target.value)} placeholder="Fictional information only" /><Button className="ri-primary mt-4" type="submit" disabled={busy || !text.trim()}><Send />{busy ? 'Saving…' : 'Save message'}</Button></form></>}
    </>}
  </section>;
}