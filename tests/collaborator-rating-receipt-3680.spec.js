// collaborator-rating-receipt-3680.spec.js — #3680 (Epic #3679).
// No review → no receipt. A cross_family_rating of UNAVAILABLE / N/A / none / a
// failing/REJECT verdict alongside a cited cross_family_receipt is a self-contradiction
// (the #3673 case: rating UNAVAILABLE + a fabricated receipt). It must fail closed.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const schema = require('../scripts/global/collaborator-handoff-schema');
const { validate } = require('../scripts/global/megalint/collaborator-handoff');

const RECEIPT = '0123456789abcdef';
const body = (rating, withReceipt) => [
  '## COLLABORATOR_HANDOFF',
  'Signed-by: Orla Harper',
  'Team&Model: claude-code:opus@local',
  'Role: collaborator',
  `cross_family_rating: ${rating}`,
  withReceipt ? `cross_family_receipt: ${RECEIPT}` : null,
].filter(Boolean).join('\n');

describe('#3680 rating/receipt contradiction', () => {
  it('flags UNAVAILABLE rating + cited receipt', () => {
    const v = schema.ratingReceiptContradiction(body('UNAVAILABLE (fleet + free-cloud unreachable)', true));
    assert.equal(v && v.rule, 'cross-family-rating-receipt-contradiction');
  });

  it('flags N/A, none, fail, and REJECT ratings with a receipt', () => {
    for (const r of ['N/A', 'none', 'FAILED', 'REJECT']) {
      assert.ok(schema.ratingReceiptContradiction(body(r, true)), `${r} + receipt must contradict`);
    }
  });

  it('does NOT flag a pass rating with a receipt', () => {
    for (const r of ['9/10', 'PASS', 'ACCEPT', '82/100']) {
      assert.equal(schema.ratingReceiptContradiction(body(r, true)), null, `${r} + receipt is consistent`);
    }
  });

  it('does NOT flag the correct degraded path (UNAVAILABLE with NO receipt)', () => {
    assert.equal(schema.ratingReceiptContradiction(body('UNAVAILABLE', false)), null);
  });

  it('does NOT flag when no rating field is present', () => {
    assert.equal(schema.ratingReceiptContradiction('Role: collaborator\ncross_family_receipt: ' + RECEIPT), null);
  });

  it('is BLOCKING at the server gate (validate ok=false, regardless of ledger)', () => {
    const r = validate({
      lane: 'lane:code-change',
      labels: [],
      comments: [{ body: body('UNAVAILABLE', true), user: { login: 'x' } }],
    });
    const rules = r.violations.map((v) => v.rule);
    assert.ok(rules.includes('cross-family-rating-receipt-contradiction'), JSON.stringify(rules));
    assert.equal(r.ok, false);
  });
});
