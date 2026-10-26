import type { Claim } from './model';

export type ContactRole = 'Doctor' | 'Specialist' | 'Employer' | 'Supervisor' | 'Physio' | 'Rehab provider' | 'Lawyer' | 'Union rep';
export type Contact = { id: string; claimId: string; name: string; role: ContactRole; org: string; phone: string; email: string; prefers: 'Email' | 'Phone' | 'SMS' };
export type RecordItem = { id: string; claimId: string; kind: 'Medical record' | 'Capacity certificate' | 'Specialist report' | 'Physio report' | 'Employer report' | 'Legal letter'; title: string; from: string; date: string; summary: string; flag?: string };

const people: Record<string, Array<[string, ContactRole, string, Contact['prefers']]>> = {
  'RI-1031': [['Dr Priya Nair', 'Doctor', 'Northside Family Clinic', 'Email'], ['Dr Marcus Bell', 'Specialist', 'Brisbane Shoulder Centre', 'Email'], ['Karen Doyle', 'Employer', 'Northline Logistics HR', 'Email'], ['Tom Reid', 'Supervisor', 'Northline Logistics Depot', 'Phone'], ['Leah Park', 'Physio', 'MoveWell Physio', 'SMS'], ['Ben Ortiz', 'Union rep', 'Transport Workers (example)', 'Phone']],
  'RI-1088': [['Dr Helen Cho', 'Doctor', 'Harbour Medical', 'Email'], ['Dr Raj Patel', 'Specialist', 'Spine & Back Clinic', 'Email'], ['Greg Mills', 'Employer', 'Harbour Engineering', 'Email'], ['Nina Shaw', 'Rehab provider', 'Return Ready Rehab', 'Phone'], ['Olivia Grant', 'Lawyer', 'Grant & Co Lawyers (example)', 'Email']],
  'RI-1094': [['Dr Sam Ellis', 'Doctor', 'Coastal GP', 'Email'], ['Mia Turner', 'Supervisor', 'Coastal Retail Store 12', 'Phone'], ['Jake Lowe', 'Physio', 'Hand & Wrist Therapy', 'SMS']],
  'RI-1102': [['Dr Anna Weiss', 'Doctor', 'Metro Health Centre', 'Email'], ['Dr Liam Fox', 'Specialist', 'Knee & Sports Orthopaedics', 'Email'], ['Paul Hart', 'Employer', 'Metro Services', 'Email'], ['Rosa Diaz', 'Lawyer', 'Diaz Legal (example)', 'Email']],
  'RI-0977': [['Dr Chris Wong', 'Doctor', 'Greenway Clinic', 'Email'], ['Dana Ross', 'Supervisor', 'Greenway Maintenance', 'Phone']],
};

export const contacts: Contact[] = Object.entries(people).flatMap(([claimId, list]) => list.map(([name, role, org, prefers], i) => ({
  id: `${claimId}-c${i}`, claimId, name, role, org, prefers,
  phone: `07 3000 ${String(1000 + i * 37 + Number(claimId.slice(3))).slice(-4)}`,
  email: `${name.toLowerCase().replace(/^dr /, '').replace(/[^a-z]+/g, '.')}@example.test`,
})));

export const records: RecordItem[] = [
  { id: 'r1', claimId: 'RI-1031', kind: 'Medical record', title: 'GP consultation notes', from: 'Dr Priya Nair', date: '2 Oct', summary: 'Right shoulder pain after lifting. Reduced range of motion. Referred for imaging and physio.' },
  { id: 'r2', claimId: 'RI-1031', kind: 'Capacity certificate', title: 'Work capacity certificate', from: 'Dr Priya Nair', date: '1–14 Oct', summary: 'Light duties, 4 hours/day, no lifting above shoulder.', flag: 'Expired 14 Oct — plan runs to 28 Oct' },
  { id: 'r3', claimId: 'RI-1031', kind: 'Specialist report', title: 'Shoulder specialist review', from: 'Dr Marcus Bell', date: '16 Oct', summary: 'Ultrasound shows mild strain, no tear. Expect gradual improvement over 4–6 weeks.' },
  { id: 'r4', claimId: 'RI-1031', kind: 'Physio report', title: 'Physio progress report', from: 'Leah Park', date: '20 Oct', summary: '5 sessions attended. Range of motion improved 30%. Recommends continuing twice weekly.' },
  { id: 'r5', claimId: 'RI-1031', kind: 'Employer report', title: 'Incident report', from: 'Karen Doyle', date: '3 Oct', summary: 'Incident during pallet lifting. Light duties available in dispatch office.', flag: 'Date differs from worker statement (2 Oct)' },
  { id: 'r6', claimId: 'RI-1088', kind: 'Medical record', title: 'GP consultation notes', from: 'Dr Helen Cho', date: '8 Sep', summary: 'Lower back pain after bending under machinery. Pain relief and rest advised.' },
  { id: 'r7', claimId: 'RI-1088', kind: 'Capacity certificate', title: 'Work capacity certificate', from: 'Dr Helen Cho', date: '15 Oct–12 Nov', summary: 'Modified duties, 6 hours/day, no lifting over 10 kg.' },
  { id: 'r8', claimId: 'RI-1088', kind: 'Specialist report', title: 'Spinal assessment', from: 'Dr Raj Patel', date: '1 Oct', summary: 'Soft tissue injury. No surgery needed. Graduated return over 8 weeks.' },
  { id: 'r9', claimId: 'RI-1088', kind: 'Legal letter', title: 'Representation notice', from: 'Olivia Grant', date: '10 Oct', summary: 'Worker now has legal representation. Copy all correspondence to the lawyer.', flag: 'Copy lawyer on every message' },
  { id: 'r10', claimId: 'RI-1094', kind: 'Medical record', title: 'GP consultation notes', from: 'Dr Sam Ellis', date: '12 Oct', summary: 'Left wrist sprain from repetitive scanning. Splint for 2 weeks.' },
  { id: 'r11', claimId: 'RI-1094', kind: 'Physio report', title: 'Hand therapy plan', from: 'Jake Lowe', date: '19 Oct', summary: 'Strength exercises started. Avoid repetitive tasks for 3 weeks.' },
  { id: 'r12', claimId: 'RI-1102', kind: 'Medical record', title: 'GP consultation notes', from: 'Dr Anna Weiss', date: '18 Oct', summary: 'Knee swelling after slip. Referred to orthopaedic specialist.' },
  { id: 'r13', claimId: 'RI-1102', kind: 'Capacity certificate', title: 'Capacity certificate', from: 'Dr Anna Weiss', date: '—', summary: 'Not yet received.', flag: 'Missing — request from GP' },
  { id: 'r14', claimId: 'RI-0977', kind: 'Medical record', title: 'Clearance for full duties', from: 'Dr Chris Wong', date: '30 Sep', summary: 'Ankle healed. Cleared for full duties.' },
];

/** Prepared contact draft. Never sent. */
export function prepareContactDraft(contact: Contact, claim: Claim, related: RecordItem[]): string {
  const flags = related.filter(r => r.flag).map(r => `• ${r.title}: ${r.flag}`);
  const ask: Record<ContactRole, string> = {
    Doctor: `Could you please provide an updated work capacity certificate and confirm current restrictions (currently recorded: ${claim.capacity})?`,
    Specialist: 'Could you please share your latest findings and expected recovery timeframe so we can align the return-to-work plan?',
    Employer: `Could you please confirm suitable duties are still available that match: ${claim.capacity}?`,
    Supervisor: 'Could you please confirm how the worker is going with their current duties and any concerns on site?',
    Physio: 'Could you please send a short progress update and the recommended number of further sessions?',
    'Rehab provider': 'Could you please share an updated graduated return-to-work schedule for review?',
    Lawyer: 'For your records, please find a summary of the current recovery plan. We will copy you on all future correspondence.',
    'Union rep': 'The worker has asked that you be kept informed. Here is a plain summary of the current plan and next steps.',
  };
  return `Prepared draft · not sent · human review required\n\nTo: ${contact.name} (${contact.role}, ${contact.org})\nVia: ${contact.prefers} · ${contact.prefers === 'Email' ? contact.email : contact.phone}\nRe: ${claim.name} · ${claim.id}\n\nHello ${contact.name.replace(/^Dr /, 'Dr ')},\n\n${ask[contact.role]}${flags.length ? `\n\nItems we noticed in the file:\n${flags.join('\n')}` : ''}\n\nKind regards,\nReimagined case team\n\nFictional example. Nothing has been sent.`;
}

export type BookingEmail = { to: string; cc: string; bcc: string; text: string };
const addr = (c: Contact) => `${c.name} <${c.email}>`;
export const workerEmail = (claim: Claim) => `${claim.name} <${claim.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.test>`;
export const caseTeam = 'Reimagined case team <cases@example.test>';

/** Booking trigger: builds every linked email (To/CC/BCC). Prepared only, never sent. */
export function bookingEmails(claim: Claim, provider: Contact, type: string, when: string): BookingEmail[] {
  const people = contacts.filter(c => c.claimId === claim.id);
  const of = (...roles: ContactRole[]) => people.filter(c => roles.includes(c.role)).map(addr).join(', ');
  const legal = of('Lawyer', 'Union rep');
  const workplace = of('Employer', 'Supervisor');
  const treating = people.filter(c => ['Doctor', 'Specialist', 'Physio', 'Rehab provider'].includes(c.role) && c.id !== provider.id).map(addr).join(', ');
  const nice = new Date(when).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' });
  const head = 'Prepared email · not sent · human review required\n\n';
  const foot = '\n\nKind regards,\nReimagined case team\n\nFictional example. Nothing has been sent.';
  const out: BookingEmail[] = [
    { to: addr(provider), cc: caseTeam, bcc: '', text: `${head}Subject: Booking confirmed — ${claim.name} (${claim.id})\n\nHello ${provider.name},\n\nThis confirms a ${type} for ${claim.name} on ${nice} at ${provider.org}.\nRecorded injury: ${claim.injury}. Current capacity: ${claim.capacity}.\nPlease send your report and any updated certificate after the appointment.${foot}` },
    { to: workerEmail(claim), cc: caseTeam, bcc: legal, text: `${head}Subject: Your appointment is booked\n\nHi ${claim.name.split(' ')[0]},\n\nYour ${type} with ${provider.name} at ${provider.org} is booked for ${nice}.\nPhone ${provider.phone} if you need to change it. Travel costs may be claimable — keep your receipts.${foot}` },
  ];
  if (workplace) out.push({ to: of('Employer') || workplace, cc: of('Supervisor'), bcc: '', text: `${head}Subject: Appointment notice — ${claim.name} (${claim.id})\n\nHello,\n\n${claim.name} has a ${type} on ${nice}. Please allow time off for this appointment. No medical details are shared in this notice.${foot}` });
  if (treating) out.push({ to: treating, cc: caseTeam, bcc: '', text: `${head}Subject: Care team update — ${claim.id}\n\nHello,\n\nFor your records: ${claim.name} has a ${type} with ${provider.name} on ${nice}. We will share the outcome once received.${foot}` });
  return out;
}
