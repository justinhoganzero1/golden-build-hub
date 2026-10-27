import { evidenceFor, logActivity, type Claim, type Workspace } from './model';
import { contacts, records, caseTeam, prepareContactDraft } from './records';

export const CASELOAD_LIMIT = 1000;
export type CaseloadItem = {
  claim: Claim; flags: string[]; tasks: Workspace['tasks']; drafts: Workspace['drafts'];
};

/** Free, bounded preparation only. No providers, messages or claim decisions. */
export function prepareCaseload(workspace: Workspace): CaseloadItem[] {
  if (workspace.claims.length > CASELOAD_LIMIT) throw new Error('Choose at most 1,000 claims per review.');
  return workspace.claims.filter(c => c.status !== 'Closed').map(claim => {
    const related = records.filter(r => r.claimId === claim.id);
    const flags = [...new Set([
      ...evidenceFor(claim).filter(e => e.severity === 'Review').map(e => e.detail),
      ...related.filter(r => r.flag).map(r => `${r.title}: ${r.flag}`),
    ])];
    const title = flags.length ? 'Review evidence and confirm current capacity' : 'Confirm capacity and recovery progress';
    const task = { id: `caseload-task:${claim.id}`, claimId: claim.id, title, done: false };
    const doctor = contacts.find(c => c.claimId === claim.id && c.role === 'Doctor');
    const draft = doctor ? {
      id: `caseload-draft:${claim.id}`, claimId: claim.id,
      to: `${doctor.name} <${doctor.email}>`, cc: caseTeam, bcc: '',
      text: prepareContactDraft(doctor, claim, related), at: new Date().toISOString(),
    } : null;
    return { claim, flags, tasks: workspace.tasks.some(t => t.id === task.id) ? [] : [task],
      drafts: draft && !workspace.drafts.some(d => d.id === draft.id) ? [draft] : [] };
  }).sort((a, b) => Number(b.flags.length > 0) - Number(a.flags.length > 0) || Number(b.claim.priority === 'High') - Number(a.claim.priority === 'High'));
}

export function saveCaseloadPreparation(workspace: Workspace, items: CaseloadItem[]): Workspace {
  // Rebuild from current workspace: ignore injected preview records and deduplicate reruns.
  const selected = new Set(items.map(i => i.claim.id));
  const current = prepareCaseload(workspace).filter(i => selected.has(i.claim.id));
  const tasks = current.flatMap(i => i.tasks);
  const drafts = current.flatMap(i => i.drafts);
  if (!tasks.length && !drafts.length) return workspace;
  return logActivity({ ...workspace, tasks: [...workspace.tasks, ...tasks], drafts: [...workspace.drafts, ...drafts] },
    `Whole-caseload preparation saved: ${current.length} active claims, ${tasks.length} tasks, ${drafts.length} contact drafts. No emails sent or decisions made.`);
}

/** Isolated synthetic load exercise; never adds workers or records to the saved workspace. */
export function syntheticCaseload(size: 500 | 1000, workspace: Workspace): Workspace {
  const claims: Claim[] = Array.from({ length: size }, (_, i) => ({
    id: `LOAD-${String(i + 1).padStart(4, '0')}`, name: `Fictional worker ${i + 1}`,
    employer: 'Synthetic evaluation employer', injury: 'Not assessed', status: 'Review',
    priority: i % 10 === 0 ? 'High' : 'Normal', capacity: 'Capacity certificate pending', notes: [], reviewed: false,
  }));
  return { ...workspace, claims, tasks: [], drafts: [] };
}