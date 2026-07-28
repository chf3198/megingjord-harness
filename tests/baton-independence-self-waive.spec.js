// baton-independence-self-waive.spec.js — #3672 (F2+F3, Epic #3679) adversarial corpus.
// Manufactured/forged signer-independence evidence must FAIL-CLOSED across all three
// independence-decision surfaces that must agree:
//   1. baton-independence.checkAdminIndependence       (posting-time admin gate)
//   2. baton-authority/evidence-loader.deriveTrailFromGitHub (merge-authority FSM teeth)
//   3. baton-authority/consensus-receipt-check.evaluate (CI re-verification)
// Corpus (AC4): same-team self-waive (FAIL) · same-team + valid ledger receipt (PASS) ·
// genuine cross-team with verified receipt/attestation (PASS) · forged-consistent bare
// different-team (FAIL) · missing field (FAIL). Plus a stress block: fuzz + fault-injection
// (G6) and a p99 latency budget (G7) per the tdd-pyramid+stress-test matrix.
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

const SAME = 'claude-code:claude-opus-4-8@local';       // authoring family: anthropic
const CROSS = 'cursor:composer-2.5@cursor-ide';         // genuinely different team
const FORGED = 'claude-code:opus@anthropic';            // single agent minting a foreign team

// ---- ledger helpers (mirror signer-independence-cross-family-3532.spec.js) ----
let counter = 0;
function tmpLedger(entries) {
  const p = path.join(os.tmpdir(), `sw-${process.pid}-${counter++}.jsonl`);
  fs.writeFileSync(p, '');
  for (const e of entries) rc.appendEntry(e, p);
  return rc.readLedger(p);
}
const entry = (ticket, family, verdict = 'PASS', provider = family) =>
  ({ ticket, kind: 'merge-consensus', provider, family, verdict, ts: 't',
    prompt_sha256: 'p', response_sha256: `${provider}-${verdict}-${ticket}` });
const receiptFor = (ledger, ticket) =>
  rc.computeReceipt(ledger.filter((e) => e.ticket === ticket && e.kind === 'merge-consensus'));

// Two distinct NON-anthropic families → a valid panel for an anthropic-authored admin.
function validPanel(ticket) {
  const ledger = tmpLedger([entry(ticket, 'google', 'PASS', 'gemini'), entry(ticket, 'meta', 'PASS', 'groq')]);
  return { ledger, receipt: receiptFor(ledger, ticket) };
}

const collab = (tm = SAME, name = 'Orla Harper') =>
  ({ body: `## COLLABORATOR_HANDOFF\nSigned-by: ${name}\nTeam&Model: ${tm}\nRole: collaborator` });
const admin = (tm, extra = '', name = 'Orla Reyes') =>
  ({ body: `## ADMIN_HANDOFF\nSigned-by: ${name}\nTeam&Model: ${tm}\nRole: admin${extra}` });

// deriveTrailFromGitHub client from a fixed comment set.
const client = (comments) => ({
  getIssue: async () => ({ state: 'open', labels: ['status:testing'] }),
  listComments: async () => comments,
});

describe('#3672 F2 — same-team self-waive / waived / N/A is NEVER independence', () => {
  it('AC2: "signer-independence-check: PASS (... waived ...)" FAILS distinctly (checkAdminIndependence)', () => {
    const a = admin(SAME, '\nsigner-independence-check: PASS (model-diversity waived for test-only verifier)');
    const res = bi.checkAdminIndependence([collab(), a]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'independence-self-waived');
  });

  it('AC2: "signer-independence-check: N/A" FAILS distinctly', () => {
    const res = bi.checkAdminIndependence([collab(), admin(SAME, '\nsigner-independence-check: N/A')]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'independence-self-waived');
  });

  it('AC2: evidence-loader reports independence-self-waived and signerIndependent=false', async () => {
    const a = admin(SAME, '\nsigner-independence-check: PASS — model diversity waived');
    const trail = await el.deriveTrailFromGitHub(42, client([collab(), a]));
    assert.equal(trail.facts.signerIndependent, false);
    assert.equal(trail.facts.signerIndependenceBasis, 'independence-self-waived');
  });

  it('AC2: consensus-receipt-check CI evaluator rejects a self-waive', () => {
    const a = admin(SAME, '\nsigner-independence-check: PASS (waived)');
    const res = crc.evaluate(42, [collab().body, a.body], { ledger: [] });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'independence-self-waived');
  });

  it('a genuine cross-family receipt OVERRIDES stray "waived" prose (receipt wins)', () => {
    const { ledger, receipt } = validPanel(101);
    const a = admin(SAME, `\nsigner-independence-check: PASS (model-diversity waived)\ncross_family_receipt: ${receipt}`);
    const res = bi.checkAdminIndependence([collab(), a], { issueNumber: 101, ledger });
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'cross-family-consensus');
  });
});

describe('#3672 F3 — a bare "different team" claim is forgeable → requires receipt/attestation', () => {
  it('AC4: forged-consistent foreign-team alias (no receipt) FAILS (unattested-cross-team-claim)', () => {
    // Single agent authors both; admin mints claude-code@anthropic to fake independence.
    const res = bi.checkAdminIndependence([collab(CROSS, 'Cyrus Harper'), admin(FORGED, '', 'Orla Reyes')]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unattested-cross-team-claim');
  });

  it('AC4: forged different-team is denied at the merge-authority FSM teeth (evidence-loader)', async () => {
    const trail = await el.deriveTrailFromGitHub(7, client([collab(CROSS, 'Cyrus Harper'), admin(FORGED, '', 'Orla Reyes')]));
    assert.equal(trail.facts.signerIndependent, false);
    assert.equal(trail.facts.signerIndependenceBasis, 'unattested-cross-team-claim');
  });

  it('AC4: consensus-receipt-check no longer auto-passes a bare different-team claim', () => {
    const res = crc.evaluate(7, [collab(CROSS).body, admin(FORGED).body], { ledger: [] });
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unattested-cross-team-claim');
  });

  it('AC4: genuine cross-team WITH a verified receipt PASSES', () => {
    const { ledger, receipt } = validPanel(202);          // admin family = anthropic (FORGED tm) → panel google+meta valid
    const a = admin(FORGED, `\ncross_family_receipt: ${receipt}`);
    const res = bi.checkAdminIndependence([collab(CROSS), a], { issueNumber: 202, ledger });
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'cross-family-consensus');
  });

  it('AC4: genuine cross-team via an injected authorship attestation PASSES', () => {
    const a = admin(FORGED, '\nCrypto-Algorithm: ed25519\nCrypto-Key-Id: claude-code-admin\nCrypto-Signature: deadbeef');
    const res = bi.checkAdminIndependence([collab(CROSS), a],
      { verifyAttestation: () => ({ ok: true, reason: 'ed25519-verified' }) });
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'authorship-attested');
  });

  it('reserved attestation is FAIL-CLOSED without a verifier (present crypto fields do not pass)', () => {
    const a = admin(FORGED, '\nCrypto-Signature: deadbeef');   // no injected verifier, no registry yet (#3682)
    const res = bi.checkAdminIndependence([collab(CROSS), a]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'unattested-cross-team-claim');
  });
});

describe('#3672 corpus — same-team + valid receipt, and missing-field', () => {
  it('AC4: same-team + valid ledger receipt PASSES', () => {
    const { ledger, receipt } = validPanel(303);
    const res = bi.checkAdminIndependence([collab(SAME), admin(SAME, `\ncross_family_receipt: ${receipt}`)],
      { issueNumber: 303, ledger });
    assert.equal(res.ok, true);
    assert.equal(res.reason, 'cross-family-consensus');
  });

  it('AC4: missing independence field entirely (same team, no receipt) FAILS', () => {
    const res = bi.checkAdminIndependence([collab(SAME), admin(SAME)]);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'same-team-no-valid-receipt');
  });

  it('AC4: evidence-loader — same-team + valid receipt independent; missing field not', async () => {
    const { ledger, receipt } = validPanel(404);
    const ok = await el.deriveTrailFromGitHub(404,
      client([collab(SAME), admin(SAME, `\ncross_family_receipt: ${receipt}`)]), { ledger });
    assert.equal(ok.facts.signerIndependent, true);
    assert.equal(ok.facts.signerIndependenceBasis, 'cross-family-consensus-verified');
    const bad = await el.deriveTrailFromGitHub(404, client([collab(SAME), admin(SAME)]), { ledger });
    assert.equal(bad.facts.signerIndependent, false);
  });
});

describe('#3672 stress — fuzz + fault-injection (G6) and p99 latency budget (G7)', () => {
  it('every self-waive / bare-forgery prose variant FAILS (adversarial fuzz, G6)', () => {
    const waiveTails = [
      'signer-independence-check: PASS (waived)',
      'signer-independence-check: PASS — model-diversity waived',
      'signer-independence-check: N/A',
      'signer-independence-check: n/a (test-only)',
      'signer-independence-check: PASS (not applicable, same substrate)',
      'signer-independence-check: WAIVED',
      'signer-independence-check: PASS​ (waived)',   // zero-width injection
    ];
    for (const tail of waiveTails) {
      const res = bi.checkAdminIndependence([collab(SAME), admin(SAME, '\n' + tail)]);
      assert.equal(res.ok, false, `must FAIL: ${JSON.stringify(tail)}`);
    }
    // Bare different-team forgeries with varied foreign teams — all unattested → FAIL.
    for (const tm of ['copilot:gpt-5@openai', 'codex:gpt-5@openai', 'antigravity:gemini@google', FORGED]) {
      const res = bi.checkAdminIndependence([collab(CROSS), admin(tm)]);
      assert.equal(res.ok, false, `bare different-team must FAIL: ${tm}`);
      assert.equal(res.reason, 'unattested-cross-team-claim');
    }
  });

  it('fault-injection: a TAMPERED ledger cannot authorize independence (G6)', () => {
    const { ledger, receipt } = validPanel(505);
    const tampered = ledger.map((e, i) => (i === 0 ? { ...e, verdict: 'REJECT' } : e)); // break the chain
    const res = bi.checkAdminIndependence([collab(SAME), admin(SAME, `\ncross_family_receipt: ${receipt}`)],
      { issueNumber: 505, ledger: tampered });
    assert.equal(res.ok, false);
    assert.equal(res.receiptReason, 'ledger-tampered');
  });

  it('p99 per-check latency stays within budget over the adversarial corpus (G7)', () => {
    const { ledger, receipt } = validPanel(606);
    const cases = [
      [collab(SAME), admin(SAME, '\nsigner-independence-check: PASS (waived)')],
      [collab(CROSS), admin(FORGED)],
      [collab(SAME), admin(SAME, `\ncross_family_receipt: ${receipt}`)],
      [collab(SAME), admin(SAME)],
    ];
    const samples = [];
    for (let i = 0; i < 400; i++) {
      const c = cases[i % cases.length];
      const t0 = process.hrtime.bigint();
      bi.checkAdminIndependence(c, { issueNumber: 606, ledger });
      samples.push(Number(process.hrtime.bigint() - t0) / 1e6); // ms
    }
    samples.sort((a, b) => a - b);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    assert.ok(p99 < 25, `p99 independence check ${p99.toFixed(3)}ms should be < 25ms budget`);
  });
});
