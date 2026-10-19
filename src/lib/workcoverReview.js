// Deterministic fictional-record checks for the independent showcase, not a fraud verdict.
export function reviewWorkcoverDemo(records, today) {
  const alerts = [];
  const seen = new Map();
  for (const record of records) {
    if (record.kind === 'expense') {
      const key = `${record.provider}|${record.invoice}|${record.cents}|${record.serviceDate}`;
      const prior = seen.get(key);
      if (prior) alerts.push({ id: `duplicate-${record.id}`, recordId: record.id, title: 'Possible duplicate expense', evidence: `${prior.id} and ${record.id}: same provider, invoice, date and amount.`, next: 'Compare the original receipts and payment ledger. A duplicate upload is not proof of fraud.', priority: 'Review' });
      else seen.set(key, record);
    }
    if (record.kind === 'certificate' && record.expires < today) alerts.push({ id: `expired-${record.id}`, recordId: record.id, title: 'Certificate date needs checking', evidence: `${record.id} expires ${record.expires}; demo review date ${today}.`, next: 'Check for an updated certificate and contact the worker. Do not automatically stop payments.', priority: 'Support' });
    if (record.kind === 'task' && record.due < today && record.status !== 'done') alerts.push({ id: `overdue-${record.id}`, recordId: record.id, title: 'Worker waiting for an update', evidence: `${record.id} due ${record.due}; owner ${record.owner}; status ${record.status}.`, next: 'Ask the assigned case manager to update the worker and agree the next step.', priority: 'Support' });
    if (record.kind === 'expense' && !record.receipt) alerts.push({ id: `missing-${record.id}`, recordId: record.id, title: 'Receipt not yet available', evidence: `${record.id} has no linked receipt in these demo records.`, next: 'Ask for the missing receipt; do not assume dishonest intent.', priority: 'Support' });
  }
  return alerts;
}