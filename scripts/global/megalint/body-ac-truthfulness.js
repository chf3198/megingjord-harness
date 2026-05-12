'use strict';
// body-ac-truthfulness — verifies AC checkbox state matches CLOSEOUT narrative claims.
// Epic #1407 AC5. For terminal-state (status:done) issues, all AC checkboxes
// in the body must be ticked. Resolves the 20% defect rate measured in #1404.

function countCheckboxes(body) {
  const lines = (body || '').split('\n');
  let total = 0, ticked = 0, unticked = 0;
  for (const line of lines) {
    if (/^[\s-]*\[\s\]\s+AC[\d:\s-]/i.test(line)) { total++; unticked++; }
    else if (/^[\s-]*\[x\]\s+AC[\d:\s-]/i.test(line)) { total++; ticked++; }
  }
  return { total, ticked, unticked };
}

function validate(input) {
  const body = input.body || '';
  const labels = input.labels || [];
  const state = input.state || 'open';
  const violations = [];

  const counts = countCheckboxes(body);
  const isTerminal = labels.includes('status:done') || labels.includes('status:cancelled');

  // For closed/terminal tickets with declared ACs, all must be ticked.
  if ((state === 'closed' || isTerminal) && counts.unticked > 0) {
    // status:cancelled is permitted to have unticked ACs (goal invalidated).
    if (!labels.includes('status:cancelled')) {
      violations.push({
        rule: 'unticked-ac-on-terminal',
        detail: `${counts.unticked} of ${counts.total} ACs remain unticked on terminal ticket. `
          + 'Tick each AC before applying status:done, OR rescope via cancellation.',
        total: counts.total, ticked: counts.ticked, unticked: counts.unticked,
      });
    }
  }

  // Advisory: open tickets with status:done should match terminal rules
  // (caught above) but we don't error on in-progress unticked-AC.

  return { ok: violations.length === 0, violations, counts };
}

module.exports = { validate, countCheckboxes };
