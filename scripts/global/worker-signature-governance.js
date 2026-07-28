'use strict';

const signerFidelity = require('./megalint/signer-fidelity');

// #3820: signer-format-canonical's two checks (role-prefix-as-provenance,
// team-model-not-canonical) were relocated into signer-fidelity.validate, so a
// single call now carries both the fidelity and the format-canonical properties.
function inspectBody(body) {
  const fidelity = signerFidelity.validate({ body });
  return {
    ok: fidelity.ok,
    violations: [...(fidelity.violations || [])],
  };
}

function summarizeTickets(tickets) {
  const inspected = [];
  const violations = [];
  for (const ticket of tickets || []) {
    const body = ticket && ticket.body;
    if (!body) continue;
    const result = inspectBody(body);
    inspected.push(ticket.number);
    for (const violation of result.violations) {
      violations.push({ ticket: ticket.number, ...violation });
    }
  }
  return { inspected, violations, ok: violations.length === 0 };
}

module.exports = { inspectBody, summarizeTickets };