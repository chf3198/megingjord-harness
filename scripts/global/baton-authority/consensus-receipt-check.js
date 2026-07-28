#!/usr/bin/env node
'use strict';
// consensus-receipt-check.js (#3532) — CI validator: re-verify the cross-family
// consensus receipt PURELY from committed evidence (the hash-chained ledger) plus
// the receipt cited in ADMIN_HANDOFF. Enforces: chain integrity, sha256 match,
// >=2 distinct families all != authoring family, unanimous PASS.
// #3672 (F2+F3, Epic #3679): a bare "different team" claim is FORGEABLE (a single agent
// can mint a foreign-team signer — #3673 / PR#3677), so it is NO LONGER an auto-pass; and
// a self-waived disposition is explicitly rejected. Independence here now requires the
// SAME operative proof as the merge FSM — a verified receipt (or a reserved authorship
// attestation) — so the CI gate and baton-authority/merge can never diverge.
// Env: ISSUE_NUMBER. Called by baton-authority-merge.yml before the merge eval.
const { execSync } = require('node:child_process');
const rc = require('../cross-family-receipt');

const GH_TIMEOUT_MS = 15000;

function ghComments(issue) {
  const raw = execSync(`gh issue view ${issue} --json comments`, { encoding: 'utf8', timeout: GH_TIMEOUT_MS });
  return (JSON.parse(raw).comments || []).map((c) => c.body || '');
}

function field(body, name) {
  const m = body.match(new RegExp(`${name}\\s*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}
function teamModelForRole(bodies, role) {
  const found = [...bodies].reverse().find((x) => new RegExp(`Role:\\s*${role}`, 'i').test(x)
    && /Team&Model:/i.test(x));
  return found ? field(found, 'Team&Model') : null;
}

function evaluate(issue, bodies, opts = {}) {
  const adminTM = teamModelForRole(bodies, 'admin');
  const collabTM = teamModelForRole(bodies, 'collaborator');
  const adminTeam = rc.teamSegmentOf(adminTM);
  const collabTeam = rc.teamSegmentOf(collabTM);
  const teamsDiffer = Boolean(adminTeam && collabTeam && adminTeam !== collabTeam);
  const adminFull = [...bodies].reverse().find((x) => /##\s*ADMIN_HANDOFF|ADMIN_HANDOFF/.test(x)) || '';
  // (attestation) reserved unforgeable path — fail-closed today (#3682), injectable.
  const att = rc.verifyAuthorshipAttestation(adminFull, opts);
  if (att.ok) return { ok: true, path: 'authorship-attested', adminTeam, collabTeam };
  const receiptBody = [...bodies].reverse().find((x) => /##\s*ADMIN_HANDOFF|ADMIN_HANDOFF/.test(x)
    && /cross_family_receipt/i.test(x));
  const receipt = receiptBody ? (receiptBody.match(/cross_family_receipt\s*:\s*([0-9a-f]{16})/i) || [])[1] : null;
  const authoringFamily = rc.familyOfModel(adminTM);
  const res = rc.verifyReceipt(issue, receipt, authoringFamily, { kind: 'merge-consensus', ledger: opts.ledger });
  if (res.ok) {
    return { ok: true, path: 'cross-family-consensus', reason: res.reason, receipt, authoringFamily, families: res.families };
  }
  // FAIL — bare team-difference / self-waive / same-team never passes without proof (F2+F3).
  const reason = rc.detectSelfWaive(adminFull) ? 'independence-self-waived'
    : teamsDiffer ? 'unattested-cross-team-claim'
      : res.reason;
  return { ok: false, path: 'cross-family-consensus', reason, receipt, authoringFamily,
    families: res.families, adminTeam, collabTeam };
}

function main() {
  const issue = parseInt(process.env.ISSUE_NUMBER, 10);
  if (!issue) { console.error('ISSUE_NUMBER required'); process.exit(1); }
  let bodies;
  try { bodies = ghComments(issue); }
  catch (e) { console.error('gh read failed: ' + e.message); process.exit(1); }
  const out = evaluate(issue, bodies);
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) {
    console.error(`consensus-receipt-check FAILED: ${out.reason || 'independence-not-satisfied'}`);
    process.exit(1);
  }
  console.log(`Signer-independence satisfied via ${out.path}.`);
}

if (require.main === module) main();
module.exports = { evaluate, teamModelForRole, field };
