// signer-independence-cross-family-3532.spec.js — #3532 regression + unit.
// Client design decision: independence PASSES iff (a) different Team&Model TEAM
// segment OR (b) a VERIFIED cross-family consensus receipt; a same-team
// persona-split with NO receipt FAILS. AC2 reproduces the #3518/#3521 case.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const bi = require('../scripts/global/baton-independence');
const el = require('../scripts/global/baton-authority/evidence-loader');
const rc = require('../scripts/global/cross-family-receipt');
const crc = require('../scripts/global/baton-authority/consensus-receipt-check');

const TM = 'claude-code:claude-opus-4-8@local';
// The exact #3518/#3521 loophole: one agent, one Team&Model, four surnames.
const collab = { body: `COLLABORATOR_HANDOFF\nSigned-by: Orla Harper\nTeam&Model: ${TM}\nRole: collaborator` };
const adminSameNoReceipt = { body: `ADMIN_HANDOFF\nSigned-by: Orla Reyes\nTeam&Model: ${TM}\nRole: admin` };
const adminDiffTeam = { body: 'ADMIN_HANDOFF\nSigned-by: Nia\nTeam&Model: codex:gpt-5@openai\nRole: admin' };

function tmpLedger(entries) {
  const p = path.join(os.tmpdir(), `xfr-${process.pid}-${entries.length}-${Math.floor(entries[0] ? entries[0].ticket : 0)}.jsonl`);
  fs.writeFileSync(p, '');
  for (const e of entries) rc.appendEntry(e, p);
  return rc.readLedger(p);
}
const entry = (ticket, family, verdict = 'PASS', provider = family) =>
  ({ ticket, kind: 'merge-consensus', provider, family, verdict, ts: 't',
    prompt_sha256: 'p', response_sha256: `${provider}-${verdict}` });

function receiptFor(ledger, ticket) {
  return rc.computeReceipt(ledger.filter((e) => e.ticket === ticket && e.kind === 'merge-consensus'));
}

describe('#3532 baton-independence — team segment + receipt', () => {
  it('AC2: #3518/#3521 single-agent persona-split (no receipt) now FAILS', () => {
    const res = bi.checkAdminIndependence([collab, adminSameNoReceipt]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'same-team-no-valid-receipt');
  });

  it('(a) genuinely different signing TEAM PASSES with no receipt', () => {
    const res = bi.checkAdminIndependence([collab, adminDiffTeam]);
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'independent-team');
  });

  it('(b) same team + VERIFIED cross-family receipt PASSES', () => {
    const ledger = tmpLedger([entry(3532, 'google'), entry(3532, 'meta')]);
    const receipt = receiptFor(ledger, 3532);
    const admin = { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin\ncross_family_receipt: ${receipt}` };
    const res = bi.checkAdminIndependence([collab, admin], { issueNumber: 3532, ledger });
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'cross-family-consensus');
  });

  it('receipt with only ONE distinct family FAILS (diversity)', () => {
    const ledger = tmpLedger([entry(11, 'meta', 'PASS', 'groq'), entry(11, 'meta', 'PASS', 'cerebras')]);
    const receipt = receiptFor(ledger, 11);
    const admin = { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin\ncross_family_receipt: ${receipt}` };
    const res = bi.checkAdminIndependence([collab, admin], { issueNumber: 11, ledger });
    assert.equal(res.ok, false);
    assert.equal(res.receiptReason, 'insufficient-family-diversity');
  });

  it('receipt including the AUTHORING family FAILS', () => {
    const ledger = tmpLedger([entry(12, 'anthropic'), entry(12, 'google')]);
    const receipt = receiptFor(ledger, 12);
    const admin = { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin\ncross_family_receipt: ${receipt}` };
    const res = bi.checkAdminIndependence([collab, admin], { issueNumber: 12, ledger });
    assert.equal(res.ok, false);
    assert.equal(res.receiptReason, 'authoring-family-in-panel');
  });

  it('a single REJECT vote breaks consensus (not unanimous)', () => {
    const ledger = tmpLedger([entry(13, 'google', 'PASS'), entry(13, 'meta', 'REJECT')]);
    const receipt = receiptFor(ledger, 13);
    const admin = { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin\ncross_family_receipt: ${receipt}` };
    const res = bi.checkAdminIndependence([collab, admin], { issueNumber: 13, ledger });
    assert.equal(res.ok, false);
    assert.equal(res.receiptReason, 'consensus-not-pass');
  });

  it('a forged receipt not matching logged responses FAILS (mismatch)', () => {
    const ledger = tmpLedger([entry(14, 'google'), entry(14, 'meta')]);
    const admin = { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin\ncross_family_receipt: 0123456789abcdef` };
    const res = bi.checkAdminIndependence([collab, admin], { issueNumber: 14, ledger });
    assert.equal(res.ok, false);
    assert.equal(res.receiptReason, 'receipt-mismatch');
  });
});

describe('#3532 evidence-loader.checkSignerIndependence (server-side bit)', () => {
  it('persona-split same team => SIGNER_INDEPENDENT false', () => {
    const signers = [
      { role: 'collaborator', signedBy: 'Orla Harper', teamModel: TM },
      { role: 'admin', signedBy: 'Orla Reyes', teamModel: TM },
    ];
    assert.equal(el.checkSignerIndependence(signers), false);
  });
  it('different team => SIGNER_INDEPENDENT true', () => {
    const signers = [
      { role: 'collaborator', signedBy: 'Orla Harper', teamModel: TM },
      { role: 'admin', signedBy: 'Nia', teamModel: 'codex:gpt-5@openai' },
    ];
    assert.equal(el.checkSignerIndependence(signers), true);
  });

  it('deriveTrailFromGitHub: persona-split false, receipt path true', async () => {
    const ledger = tmpLedger([entry(3532, 'google'), entry(3532, 'meta')]);
    const receipt = receiptFor(ledger, 3532);
    const mk = (extra) => ({
      getIssue: async () => ({ state: 'open', labels: ['status:testing'] }),
      listComments: async () => [collab, { body: `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin${extra}` }],
    });
    const noReceipt = await el.deriveTrailFromGitHub(3532, mk(''), { ledger });
    assert.equal(noReceipt.facts.signerIndependent, false);
    const withReceipt = await el.deriveTrailFromGitHub(3532, mk(`\ncross_family_receipt: ${receipt}`), { ledger });
    assert.equal(withReceipt.facts.signerIndependent, true);
    assert.equal(withReceipt.facts.signerIndependenceBasis, 'cross-family-consensus-verified');
  });
});

describe('#3532 consensus-receipt-check CI evaluator', () => {
  const bodies = (adminExtra) => [collab.body, `ADMIN_HANDOFF\nTeam&Model: ${TM}\nRole: admin${adminExtra}`];
  it('independent-team path passes without a receipt', () => {
    const res = crc.evaluate(3532, [collab.body, adminDiffTeam.body], { ledger: [] });
    assert.equal(res.ok, true);
    assert.equal(res.path, 'independent-team');
  });
  it('same-team no receipt fails', () => {
    const res = crc.evaluate(3532, bodies(''), { ledger: [] });
    assert.equal(res.ok, false);
    assert.equal(res.path, 'cross-family-consensus');
  });
  it('same-team valid receipt passes', () => {
    const ledger = tmpLedger([entry(3532, 'google'), entry(3532, 'meta')]);
    const res = crc.evaluate(3532, bodies(`\ncross_family_receipt: ${receiptFor(ledger, 3532)}`), { ledger });
    assert.equal(res.ok, true);
  });
});
