import { z } from 'zod';

const noteSchema = z.object({ id: z.string(), text: z.string(), at: z.string() });
const claimSchema = z.object({ id: z.string(), name: z.string(), employer: z.string(), injury: z.string(), status: z.enum(['Review', 'Recovery', 'Closed']), priority: z.enum(['High', 'Normal']), capacity: z.string(), notes: z.array(noteSchema), reviewed: z.boolean() });
const taskSchema = z.object({ id: z.string(), claimId: z.string(), title: z.string(), done: z.boolean() });
const messageSchema = z.object({ id: z.string(), role: z.enum(['user', 'assistant']), text: z.string() });
export const workspaceSchema = z.object({
  claims: z.array(claimSchema), tasks: z.array(taskSchema),
  activity: z.array(z.object({ id: z.string(), text: z.string(), at: z.string() })),
  conversations: z.array(z.object({ id: z.string(), title: z.string(), messages: z.array(messageSchema) })),
  paymentReviews: z.array(z.string()),
  drafts: z.array(z.object({ id: z.string(), claimId: z.string(), to: z.string(), cc: z.string().optional(), bcc: z.string().optional(), bookingId: z.string().optional(), text: z.string(), at: z.string() })).default([]),
  bookings: z.array(z.object({ id: z.string(), claimId: z.string(), contactId: z.string(), type: z.string(), when: z.string(), at: z.string() })).default([]),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type Claim = Workspace['claims'][number];
export type View = 'Overview' | 'Claims' | 'Tasks' | 'Documents' | 'Recovery' | 'Payments' | 'AI Assistant' | 'Connections' | 'Activity' | 'Worker accounts' | 'Contacts' | 'Medical & reports';
export const views: View[] = ['Overview', 'Claims', 'Tasks', 'Documents', 'Recovery', 'Payments', 'AI Assistant', 'Worker accounts', 'Contacts', 'Medical & reports', 'Connections', 'Activity'];
export const uid = () => crypto.randomUUID();
export function freshWorkspace(): Workspace {
  return {
    claims: [
      { id: 'RI-1031', name: 'Alex Morgan', employer: 'Northline Logistics', injury: 'Shoulder strain', status: 'Review', priority: 'High', capacity: 'Light duties · 4 hours/day', notes: [], reviewed: false },
      { id: 'RI-1088', name: 'Sam Taylor', employer: 'Harbour Engineering', injury: 'Lower back injury', status: 'Recovery', priority: 'Normal', capacity: 'Modified duties · 6 hours/day', notes: [], reviewed: false },
      { id: 'RI-1094', name: 'Jamie Chen', employer: 'Coastal Retail', injury: 'Wrist sprain', status: 'Recovery', priority: 'Normal', capacity: 'No repetitive lifting', notes: [], reviewed: false },
      { id: 'RI-1102', name: 'Casey Williams', employer: 'Metro Services', injury: 'Knee injury', status: 'Review', priority: 'High', capacity: 'Capacity certificate pending', notes: [], reviewed: false },
      { id: 'RI-0977', name: 'Jordan Lee', employer: 'Greenway Maintenance', injury: 'Ankle sprain', status: 'Closed', priority: 'Normal', capacity: 'Full duties', notes: [], reviewed: true },
    ],
    tasks: [
      { id: 'task-1', claimId: 'RI-1031', title: 'Request updated capacity certificate', done: false },
      { id: 'task-2', claimId: 'RI-1088', title: 'Review graduated return-to-work plan', done: false },
      { id: 'task-3', claimId: 'RI-1102', title: 'Confirm incident date with employer', done: false },
    ], activity: [], conversations: [], paymentReviews: [], drafts: [], bookings: [],
  };
}
export function evidenceFor(claim: Claim) {
  if (claim.id === 'RI-1031') return [
    { title: 'Capacity certificate dates', detail: 'Certificate covers 1–14 October; the example plan runs to 28 October. Request an updated certificate.', severity: 'Review' },
    { title: 'Incident date discrepancy', detail: 'Worker statement says 2 October; employer report says 3 October. Verify the date with both parties.', severity: 'Review' },
  ];
  if (claim.id === 'RI-1102') return [{ title: 'Missing capacity certificate', detail: 'No certificate is included in this fictional document pack. Human follow-up is required.', severity: 'Review' }];
  return [{ title: 'Document pack checked', detail: 'No predefined discrepancy in this example. This is not a medical, eligibility or fraud assessment.', severity: 'Information' }];
}
export function preparedReply(question: string, claim: Claim, workspace: Workspace): string {
  const q = question.toLowerCase();
  const prefix = 'Prepared example · not live AI\n\n';
  if (/pay|bank|transfer/.test(q)) return prefix + 'Payments remain a human-reviewed simulation. No bank transfer or insurer payment is connected. Open Payments to review the fictional payment schedule.';
  if (/task|follow|next/.test(q)) return prefix + `${claim.id}: recommended next step — ${claim.capacity.includes('pending') ? 'request a capacity certificate' : 'confirm current capacity and review the recovery plan'}. There are ${workspace.tasks.filter(t => !t.done).length} open tasks. You can explicitly save a follow-up task; nothing is sent automatically.`;
  if (/document|evidence|risk|check/.test(q)) return prefix + evidenceFor(claim).map(e => `${e.title}: ${e.detail}`).join('\n\n') + '\n\nThese deterministic checks flag information for human review, not fraud or liability.';
  if (/draft|email|letter/.test(q)) return prefix + `Draft for human review\n\nHello ${claim.name},\nWe are reviewing the recovery plan for ${claim.id}. Please confirm whether your current capacity remains: ${claim.capacity}. We will review any updated information before changing the plan.\nKind regards,\nReimagined case team\n\nExample only. This message has not been sent.`;
  if (/summary|summar|claim|recovery/.test(q)) return prefix + `${claim.name} · ${claim.id}\nEmployer: ${claim.employer}\nRecorded injury: ${claim.injury}\nStage: ${claim.status}\nCapacity: ${claim.capacity}\nNotes: ${claim.notes.length}\n\nSuggested review: confirm capacity, review supporting documents and agree the next recovery step with the worker. All records are fictional.`;
  return prefix + 'I can show a prepared case summary, evidence check, next-step checklist or communication draft. Select a case and ask for one of those examples. I cannot access real insurer systems, provide medical decisions or send messages.';
}
export function logActivity(workspace: Workspace, text: string): Workspace {
  return { ...workspace, activity: [{ id: uid(), text, at: new Date().toISOString() }, ...workspace.activity].slice(0, 200) };
}
export function isReimaginedEntry(host: string, path: string) {
  return ['reimagined.online', 'www.reimagined.online'].includes(host.toLowerCase()) || path === '/reimagined-it';
}