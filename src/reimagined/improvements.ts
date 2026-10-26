import type { View } from './model';
export const complaintSource = { title: 'Queensland Ombudsman · Casebook 2025 · page 19', url: 'https://www.ombudsman.qld.gov.au/ArticleDocuments/600/Queensland%20Ombudsman%20-%20Casebook%202025%20PUBLIC.pdf.aspx?embed=Y' };
export const accessibilitySource = { title: 'W3C · WCAG 2.2 accessibility standard', url: 'https://www.w3.org/TR/WCAG22/' };
export type Improvement = { title: string; problem: string; evidence: string; change: string; steps: string[]; ai: string; safeguards: string; measure: string; source: typeof complaintSource; scope: string };
const progress: Improvement = {
  title: 'A clear next step instead of uncertainty',
  problem: 'Lengthy claim processes were raised in published Queensland complaint cases.',
  evidence: 'Casebook 2025 describes three complainants whose issues included the duration of the process. It is not a survey and does not establish how common delays are, or that a digital portal caused them.',
  change: 'A worker sees their claim stage, current capacity, the next step and when that step was updated. Managers can save a clearer next step and read worker messages in one account view.',
  steps: ['Open Worker accounts and select Alex or Sam.', 'Read the claim stage and next-step panel.', 'Save a new next step; sign in as that worker to read it.', 'Record a follow-up task and review the activity history.'],
  ai: 'A proposed AI connection could draft a plain-language status summary. The current assistant uses prepared examples only and never changes a plan automatically.',
  safeguards: 'Workers cannot see another worker’s claim or private manager workspace. Case stages are workflow labels, not eligibility or medical decisions.',
  measure: 'Test whether workers correctly identify their next step. A real deployment must measure missed follow-ups and processing times before claiming a reduction in delay.',
  source: complaintSource, scope: 'Reported complaint theme · three selected cases · no proven reduction in real processing time.',
};
const requests: Improvement = {
  title: 'Understand what is needed and why',
  problem: 'Published complainants raised failures to explain the reasons for information requests.',
  evidence: 'Casebook 2025 page 19 records concerns about the failure to communicate reasons for requests. It does not attribute the problem specifically to online document screens.',
  change: 'The document pack separates the item being requested from the evidence check. Plain-language checks say what is missing or inconsistent, and the worker can ask their case team about documents.',
  steps: ['Open Documents for RI-1031.', 'Read the capacity certificate and its date mismatch.', 'Save a follow-up task to request an updated certificate.', 'Open the worker’s My documents page and save a question to the case team.'],
  ai: 'A proposed AI link could extract dates and work capacity, then draft an explanation for staff review. These checks are deterministic fictional examples—not live document analysis.',
  safeguards: 'An evidence flag is a request for human review, never a fraud finding. No real uploads, clinical system or automated correspondence are connected.',
  measure: 'Ask workers to explain what document is needed and why. Measure avoidable repeat requests in an approved live trial; this evaluation alone does not prove improved understanding.',
  source: complaintSource, scope: 'Reported complaint theme · no prevalence estimate or demonstrated live improvement.',
};
const communication: Improvement = {
  title: 'Keep questions and responses together',
  problem: 'Published complaint cases included concerns about the adequacy of complaint responses.',
  evidence: 'The Ombudsman raised concerns about response adequacy in three selected cases. The report records review commitments; it does not show that a messaging portal resolves complaint handling.',
  change: 'Worker messages and manager replies are saved against the same fictional claim, with sender and timestamp. Managers can refresh the conversation and check whether a concern has actually received a response.',
  steps: ['Sign in as a worker and open Messages.', 'Save a fictional question.', 'Sign in as the manager and open that worker’s account.', 'Reply, then reopen the worker account and refresh messages.'],
  ai: 'Prepared communication drafts may help staff structure a response. No draft is sent automatically and no AI provider is called.',
  safeguards: 'Saved messages are not an official complaint or decision review. Formal escalation routes and statutory review rights would require approved business rules before real deployment.',
  measure: 'Check whether a reply addresses each question. Evaluate complaint-response quality with users and complaint specialists; saved messages alone do not prove an adequate response.',
  source: complaintSource, scope: 'Reported response concerns · this is messaging, not a complete complaint or statutory review system.',
};
const accessibility: Improvement = {
  title: 'Large, clear controls and fewer avoidable mistakes',
  problem: 'Small controls, hidden instructions and dense screens can create accessibility barriers. This is a design risk—not a documented defect in an insurer’s portal.',
  evidence: 'WCAG 2.2 provides requirements for target sizes, keyboard access, visible focus, form labels, error identification and reflow. The minimum target-size criterion has exceptions; this app aims for larger 44-pixel controls.',
  change: 'Readable body text, large labelled actions, separate worker and manager screens, short next-step panels and detailed explanations on demand. Save errors preserve drafts and shared-workspace conflicts are reported rather than silently overwriting.',
  steps: ['Use the large manager navigation or worker section buttons.', 'Read the next step without opening a pop-up.', 'Try keyboard navigation and open this explanation.', 'Confirm a message or plan save and reopen it later.'],
  ai: 'AI is not required to navigate the app. Prepared examples remain optional; a future AI service would need accessibility and safety evaluation.',
  safeguards: 'Status is shown with words, not colour alone. Real accessibility conformance requires screen-reader, keyboard, contrast, zoom and user testing; this app is not claimed to be foolproof.',
  measure: 'Measure task completion and comprehension with workers, including people with disabilities. Record accessibility test results before making a WCAG conformance claim.',
  source: accessibilitySource, scope: 'Accessibility design guidance · not a reported insurer defect or a certified accessibility claim.',
};
export function improvementFor(view: View): Improvement {
  if (view === 'Documents' || view === 'Medical & reports') return requests;
  if (view === 'Contacts') return communication;
  if (view === 'AI Assistant' || view === 'Activity') return communication;
  if (view === 'Connections' || view === 'Payments') return accessibility;
  return progress;
}
export const improvements = [progress, requests, communication, accessibility];