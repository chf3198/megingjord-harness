// baton-deferred-final-merge.spec.js -- Regression: deferred-final merge from
// status:review must be authorized by the FSM. Refs #3315, Epic #3284.
//
// The documented deferred-final flow (CLAUDE.md feature-completion-governance +
// global-standards "Deferred-finalize merge-evidence contract") merges from
// status:review after CONSULTANT_CLOSEOUT, pre terminal-close. Before #3315 the
// FSM modelled MERGE only from TESTING, so the live (required) baton-authority
// merge gate bricked every deferred-final PR (real casualty: PR #3324 / #3300).
// These tests pin the REVIEW + MERGE transition and its evidence mask.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateMergeAuthority,
} = require('../scripts/global/baton-authority/merge-authority');
const { buildEvidenceDigest } = require('../scripts/global/baton-authority/merkle');
const {
  deriveTrailFromGitHub,
} = require('../scripts/global/baton-authority/evidence-loader');
const {
  STATES, EVENTS, EVIDENCE_BITS, findTransition,
} = require('../scripts/global/baton-fsm/transitions');
const os = require('os');
const fs = require('fs');
const path = require('path');
const rc = require('../scripts/global/cross-family-receipt');

// #3672 (F3): a bare different-team admin no longer confers independence — it now needs a
// VERIFIED cross-family receipt. Build a genuine 2-family ledger for this fixture's ticket
// (#1) and cite its receipt in the non-drop admin body. The signer-drop deny case keeps NO
// receipt + a collapsed same-team alias, so it stays correctly non-independent.
function buildLedger() {
  const p = path.join(os.tmpdir(), `dfm-${process.pid}.jsonl`);
  fs.writeFileSync(p, '');
  const mk = (family, provider) => ({ ticket: 1, kind: 'merge-consensus', provider, family,
    verdict: 'PASS', ts: 't', prompt_sha256: 'p', response_sha256: `${provider}-1` });
  rc.appendEntry(mk('google', 'gemini'), p);   // both != openai (copilot admin's authoring family)
  rc.appendEntry(mk('meta', 'groq'), p);
  return rc.readLedger(p);
}
const LEDGER = buildLedger();
const RECEIPT = rc.computeReceipt(LEDGER.filter((e) => e.ticket === 1 && e.kind === 'merge-consensus'));

// --- Fixture: a deferred-final trail at status:review ---
// Each artifact body carries the signals evidence-loader scans for. `omit`
// lets a test drop one required signal to assert the matching denial.

function reviewTrailComments(omit) {
  const drop = omit || {};
  const managerBody = [
    '## MANAGER_HANDOFF', 'scope: deferred-final feature',
    'Signed-by: Orla Mason', 'Team&Model: claude-code:claude-opus-4-8@local',
    'Role: manager',
  ].join('\n');
  const collaboratorBody = [
    '## COLLABORATOR_HANDOFF', 'All ACs verified PASS',
    'Signed-by: Orla Harper', 'Team&Model: claude-code:claude-opus-4-8@local',
    'Role: collaborator',
  ].join('\n');
  const adminBody = [
    '## ADMIN_HANDOFF',
    // "signer-independence-check: PASS" also matches the CI_GREEN signal
    // ("check: PASS"); reword it in the CI-drop case so CI_GREEN is truly absent.
    // SIGNER_INDEPENDENT comes from distinct collab/admin aliases, not this text.
    drop.ciGreen ? 'signer independence verified' : 'signer-independence-check: PASS',
    drop.ciGreen ? 'CI: pending' : 'CI: all green',
    drop.worktreeMergeOk ? 'worktree status: clean' : 'worktree-merge-ok',
    // dropSigner collapses the admin alias onto the collaborator alias so
    // checkSignerIndependence() returns false (no independent admin signer).
    'Signed-by: ' + (drop.signer ? 'Orla Harper' : 'Astra Reyes'),
    'Team&Model: ' + (drop.signer
      ? 'claude-code:claude-opus-4-8@local' : 'copilot:gpt-4o@openai'),
    // #3672: independence needs a verified receipt; the signer-drop case omits it so it
    // stays non-independent (a same-team collapse with no receipt).
    drop.signer ? 'Role: admin' : 'cross_family_receipt: ' + RECEIPT + '\nRole: admin',
  ].join('\n');
  const consultantBody = [
    '## CONSULTANT_CLOSEOUT', 'verdict: approve_for_merge', 'rubric_rating: 9/10',
    'Signed-by: Orla Vale', 'Team&Model: claude-code:claude-opus-4-8@local',
    'Role: consultant',
  ].join('\n');
  const comments = [
    { body: managerBody }, { body: collaboratorBody }, { body: adminBody },
  ];
  if (!drop.closeout) comments.push({ body: consultantBody });
  return comments;
}

function buildReviewClient(omit) {
  return {
    async getIssue() {
      return { state: 'open', labels: [{ name: 'status:review' }] };
    },
    async listComments() { return reviewTrailComments(omit); },
    async getPR() { return { merged: false }; },
    // enrichWithPRData() promotes ciGreen from live checks, so dropping CI_GREEN
    // requires a non-success check too (not just the comment text).
    async listChecks() {
      return [{ conclusion: (omit && omit.ciGreen) ? 'failure' : 'success' }];
    },
  };
}

async function digestFor(client) {
  const trail = await deriveTrailFromGitHub(1, client, { ledger: LEDGER });
  return buildEvidenceDigest(trail.facts);
}

// --- The transition row itself ---

describe('FSM models REVIEW + MERGE (deferred-final)', () => {
  it('has a REVIEW + MERGE transition that stays in REVIEW', () => {
    const row = findTransition(STATES.REVIEW, EVENTS.MERGE);
    assert.ok(row, 'REVIEW + MERGE transition must exist');
    assert.equal(row.toState, STATES.REVIEW, 'deferred-final merge is a self-loop');
  });

  it('requires closeout + CI + signer-independence + worktree-merge-ok', () => {
    const row = findTransition(STATES.REVIEW, EVENTS.MERGE);
    const expected = EVIDENCE_BITS.CONSULTANT_CLOSEOUT | EVIDENCE_BITS.CI_GREEN
      | EVIDENCE_BITS.SIGNER_INDEPENDENT | EVIDENCE_BITS.WORKTREE_MERGE_OK;
    assert.equal(row.requiredMask, expected);
    assert.ok(!(row.requiredMask & EVIDENCE_BITS.PR_MERGED),
      'must not require PR_MERGED at pre-merge gate time');
  });
});

// --- End-to-end through evaluateMergeAuthority (the live gate path) ---

describe('Merge authority authorizes a deferred-final merge from review', () => {
  it('ALLOWS when the full deferred-final trail is present at status:review', async () => {
    const client = buildReviewClient();
    const digest = await digestFor(client);
    const result = await evaluateMergeAuthority(1, 2, client, digest, { ledger: LEDGER });
    assert.equal(result.allowed, true,
      'deferred-final review merge must be allowed; got ' + JSON.stringify(result));
    assert.equal(result.reason, 'all-evidence-present-and-verified');
  });

  const denyCases = [
    ['CONSULTANT_CLOSEOUT', { closeout: true }],
    ['CI_GREEN', { ciGreen: true }],
    ['SIGNER_INDEPENDENT', { signer: true }],
    ['WORKTREE_MERGE_OK', { worktreeMergeOk: true }],
  ];
  for (const [label, omit] of denyCases) {
    it('DENIES when ' + label + ' is missing', async () => {
      const client = buildReviewClient(omit);
      const digest = await digestFor(client);
      const result = await evaluateMergeAuthority(1, 2, client, digest, { ledger: LEDGER });
      assert.equal(result.allowed, false,
        'missing ' + label + ' must deny; got ' + JSON.stringify(result));
      assert.ok(result.reason.includes('fsm-denied'),
        'reason should be an FSM denial, got: ' + result.reason);
    });
  }
});
