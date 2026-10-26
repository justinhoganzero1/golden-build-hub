import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Improvement } from './improvements';
export function ImprovementDialog({ item, close }: { item: Improvement | null; close: () => void }) {
  return <Dialog open={!!item} onOpenChange={open => { if (!open) close(); }}><DialogContent className="reimagined-theme ri-popup ri-improvement-popup">
    <span className="ri-eyebrow">DESIGNED TO ADDRESS THE ISSUE</span><DialogTitle>{item?.title}</DialogTitle>
    <DialogDescription>What was reported, what changes here, and what still needs real-world proof.</DialogDescription>
    {item && <div className="ri-improvement-body">
      <section><h3>Reported problem or design risk</h3><p>{item.problem}</p><p className="ri-disclaimer">{item.evidence}</p></section>
      <section><h3>What changes in Reimagined</h3><p>{item.change}</p></section>
      <section><h3>Try the complete workflow</h3><ol>{item.steps.map(step => <li key={step}>{step}</li>)}</ol></section>
      <section><h3>Where AI fits</h3><p>{item.ai}</p></section>
      <section><h3>Human control and privacy</h3><p>{item.safeguards}</p></section>
      <section><h3>How we would prove improvement</h3><p>{item.measure}</p></section>
      <div className="ri-research-limit"><ShieldCheck /><p>Designed to address this issue—not proof that the real problem has been removed.<br />{item.scope}</p></div>
      <a className="ri-source-link" href={item.source.url} target="_blank" rel="noopener noreferrer">{item.source.title}<ExternalLink /></a>
    </div>}
    <Button className="ri-primary" onClick={close}>Back to workspace<ArrowRight /></Button>
  </DialogContent></Dialog>;
}