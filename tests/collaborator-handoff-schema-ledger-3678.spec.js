// collaborator-handoff-schema-ledger-3678.spec.js — #3678 (F1, Epic #3679).
// The COLLABORATOR_HANDOFF validator must LEDGER-VERIFY a cited cross_family_receipt,
// not merely accept any 16-hex (the root F1 hole of #3673 / PR #3677). Shift-left of
// the merge-gate ledger check: a fabricated-but-well-formed receipt fails closed at
// handoff-emission time. Full >=2-family/unanimous-PASS check stays at merge.
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const rc = require('../scripts/global/cross-family-receipt');
const schema = require('../scripts/global/collaborator-handoff-schema');

// Build a genuine hash-chained ledger fixture in a temp file, then read it back so
// entries carry real `chain`/`seq` and computeReceipt() matches the production path.
function buildLedger() {
  const p = path.join(os.tmpdir(), `xfr-3678-${process.pid}-${Date.now()}.jsonl`);
  const base = { prompt_sha256: 'p'.repeat(64), response_sha256: 'r'.repeat(64) };
  // Genuine 2-family panel for ticket 9999 / kind review.
  rc.appendEntry({ ticket: 9999, kind: 'review', provider: 'groq', family: 'meta', verdict: 'PASS', ts: '2026-07-11T00:00:00Z', ...base }, p);
  rc.appendEntry({ ticket: 9999, kind: 'review', provider: 'mistral', family: 'mistral', verdict: 'PASS', ts: '2026-07-11T00:00:01Z', ...base }, p);
  // Lone single-family append for ticket 8888 — must NOT mint a passing receipt.
  rc.appendEntry({ ticket: 8888, kind: 'review', provider: 'groq', family: 'meta', verdict: 'PASS', ts: '2026-07-11T00:00:02Z', ...base }, p);
  const ledger = rc.readLedger(p);
  fs.unlinkSync(p);
  return ledger;
}

function handoff(receiptLine) {
  return [
    'COLLABORATOR_HANDOFF',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:opus@local',
    'Role: collaborator',
    receiptLine,
  ].filter(Boolean).join('\n');
}

const rulesOf = (res) => res.violations.map((v) => v.rule);

describe('#3678 F1 — ledger-verified cross_family_receipt at COLLABORATOR_HANDOFF', () => {
  let ledger;
  let genuine;
  let singleFamily;

  before(() => {
    ledger = buildLedger();
    const set = schema.ledgerReceiptSet(ledger);
    assert.equal(set.size, 1, 'only the 2-family group yields a genuine receipt');
    genuine = [...set][0];
    // computeReceipt of the lone single-family slice (ticket 8888) — genuine hash but excluded.
    singleFamily = rc.computeReceipt(ledger.filter((e) => e.ticket === 8888 && e.kind === 'review'));
  });

  it('accepts a genuine receipt that is present in the ledger', () => {
    const res = schema.validateStructure(handoff(`cross_family_receipt: ${genuine}`), { ledger });
    assert.ok(!rulesOf(res).includes('cross-family-receipt-unledgered'), 'genuine receipt must not be flagged');
    assert.ok(!rulesOf(res).includes('cross-family-receipt-ledger-tampered'));
  });

  it('rejects a fabricated (well-formed but unledgered) receipt', () => {
    const res = schema.validateStructure(handoff('cross_family_receipt: deadbeefdeadbeef'), { ledger });
    assert.ok(rulesOf(res).includes('cross-family-receipt-unledgered'), 'fabricated receipt must fail closed');
    assert.equal(res.ok, false);
  });

  it('rejects a single-family receipt (genuine hash, insufficient panel)', () => {
    const res = schema.validateStructure(handoff(`cross_family_receipt: ${singleFamily}`), { ledger });
    assert.ok(rulesOf(res).includes('cross-family-receipt-unledgered'), 'lone single-family append must not pass');
  });

  it('passes when no receipt is cited (receipt stays optional per #2904)', () => {
    const res = schema.validateStructure(handoff(null), { ledger });
    assert.ok(!rulesOf(res).some((r) => r.startsWith('cross-family-receipt')), 'absent receipt is allowed');
    assert.equal(res.ok, true);
  });

  it('rejects a cited receipt when the ledger chain is tampered', () => {
    const tampered = ledger.map((e) => ({ ...e }));
    tampered[0].verdict = 'REJECT'; // mutate body without re-chaining -> verifyChain fails
    const res = schema.validateStructure(handoff(`cross_family_receipt: ${genuine}`), { ledger: tampered });
    assert.ok(rulesOf(res).includes('cross-family-receipt-ledger-tampered'), 'tampered ledger must be rejected');
  });

  it('rejects a cited receipt against an empty ledger', () => {
    const res = schema.validateStructure(handoff(`cross_family_receipt: ${genuine}`), { ledger: [] });
    assert.ok(rulesOf(res).includes('cross-family-receipt-unledgered'), 'empty ledger cannot verify a receipt');
  });

  it('defers a malformed receipt to the format rule (no double violation)', () => {
    const res = schema.validateStructure(handoff('cross_family_receipt: not-a-hex'), { ledger });
    assert.ok(rulesOf(res).includes('cross-family-receipt-format'), 'format rule owns malformed receipts');
    assert.ok(!rulesOf(res).includes('cross-family-receipt-unledgered'), 'ledger rule must not double-flag malformed');
  });

  it('receiptLedgerViolation returns null when no receipt field is present', () => {
    assert.equal(schema.receiptLedgerViolation('Role: collaborator', { ledger }), null);
  });
});
