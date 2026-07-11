// baton-merge-authority.spec.js -- TDD-pyramid tests for merge authority.
// Fake ghClient only; never calls real GitHub. Refs #3290, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMergeAuthority, BREAK_GLASS_LABEL } = require('../scripts/global/baton-authority/merge-authority');
const { buildEvidenceDigest } = require('../scripts/global/baton-authority/merkle');
const { deriveTrailFromGitHub, buildEvidenceMask } = require('../scripts/global/baton-authority/evidence-loader');

// --- Fake ghClient builders ---

/**
 * Build a fake ghClient with a complete baton trail.
 * All four artifacts present, signer-independent, CI green.
 */
function buildCompleteTrailClient() {
  return {
    async getIssue() {
      return {
        state: 'open',
        labels: [{ name: 'status:testing' }],
      };
    },
    async listComments() {
      return [
        {
          body: [
            '## MANAGER_HANDOFF',
            'scope: test feature',
            'Signed-by: Orla Mason',
            'Team&Model: claude-code:claude-opus-4@anthropic',
            'Role: manager',
          ].join('\n'),
        },
        {
          body: [
            '## COLLABORATOR_HANDOFF',
            'All ACs verified PASS',
            'Signed-by: Orla Harper',
            'Team&Model: claude-code:claude-opus-4@anthropic',
            'Role: collaborator',
          ].join('\n'),
        },
        {
          body: [
            '## ADMIN_HANDOFF',
            'signer-independence-check: PASS',
            'CI: all green',
            'worktree-merge-ok',
            'Signed-by: Astra Reyes',
            'Team&Model: copilot:gpt-4o@openai',
            'Role: admin',
          ].join('\n'),
        },
      ];
    },
    async getPR() {
      return { merged: false };
    },
    async listChecks() {
      return [
        { conclusion: 'success' },
        { conclusion: 'success' },
      ];
    },
  };
}

/**
 * Build a fake ghClient missing the admin handoff.
 */
function buildIncompleteTrailClient() {
  return {
    async getIssue() {
      return {
        state: 'open',
        labels: [{ name: 'status:testing' }],
      };
    },
    async listComments() {
      return [
        {
          body: [
            '## MANAGER_HANDOFF',
            'Signed-by: Orla Mason',
            'Team&Model: claude-code:claude-opus-4@anthropic',
            'Role: manager',
          ].join('\n'),
        },
        {
          body: [
            '## COLLABORATOR_HANDOFF',
            'All ACs verified PASS',
            'Signed-by: Orla Harper',
            'Team&Model: claude-code:claude-opus-4@anthropic',
            'Role: collaborator',
          ].join('\n'),
        },
      ];
    },
    async getPR() {
      return { merged: false };
    },
    async listChecks() {
      // An incomplete (pre-admin) trail has no CI run yet. Returning no
      // checks keeps server-side enrichment a no-op on ciGreen, so the
      // GitHub-derived digest is stable and the FSM denial path (missing
      // admin/consultant evidence) is what gets exercised here.
      return [];
    },
  };
}

/**
 * Build a client where the issue is not found.
 */
function buildNotFoundClient() {
  return {
    async getIssue() { return null; },
    async listComments() { return []; },
    async getPR() { return null; },
    async listChecks() { return []; },
  };
}

/**
 * Build a client with break-glass label and approver evidence.
 */
function buildBreakGlassClient() {
  return {
    async getIssue() {
      return {
        state: 'open',
        labels: [
          { name: 'status:testing' },
          { name: BREAK_GLASS_LABEL },
        ],
      };
    },
    async listComments() {
      return [
        {
          body: [
            'BLOCKER_NOTE',
            'bypass_reason: emergency hotfix',
            'approver: chf3198',
          ].join('\n'),
        },
      ];
    },
    async getPR() { return { merged: false }; },
    async listChecks() { return []; },
  };
}

// --- Helper to derive digest from a client ---

async function deriveDigest(issueNumber, client, opts = {}) {
  const trail = await deriveTrailFromGitHub(issueNumber, client, opts);
  if (trail.error) return { trail, digest: 'invalid' };
  return { trail, digest: buildEvidenceDigest(trail.facts) };
}

// #3672 (F3): a bare different-team admin no longer confers independence. This complete
// trail proves independence via a cryptographic authorship attestation (injected here;
// the registry-backed verifier is the #3682 deliverable) rather than by prose alone.
const ATTESTED = { verifyAttestation: () => ({ ok: true, reason: 'test-authorship-attested' }) };

// --- Tests ---

describe('Merge Authority - complete trail allows merge (AC1)', () => {
  it('allows merge when all GitHub-derived evidence is present', async () => {
    const client = buildCompleteTrailClient();
    const { trail, digest } = await deriveDigest(100, client, ATTESTED);
    assert.ok(!trail.error, 'trail should not have error');
    const result = await evaluateMergeAuthority(100, 200, client, digest, ATTESTED);
    assert.equal(result.allowed, true, 'should be allowed with complete trail');
    assert.equal(result.reason, 'all-evidence-present-and-verified');
    assert.deepEqual(result.missing, []);
  });
});

describe('Merge Authority - incomplete trail denies merge (AC1)', () => {
  it('denies merge when consultant closeout is missing', async () => {
    const client = buildIncompleteTrailClient();
    const { trail, digest } = await deriveDigest(100, client);
    const result = await evaluateMergeAuthority(100, 200, client, digest);
    assert.equal(result.allowed, false, 'should be denied with incomplete trail');
    assert.ok(result.reason.includes('fsm-denied'), 'reason should indicate FSM denial');
  });
});

describe('Merge Authority - forged digest rejected (AC3)', () => {
  it('rejects when claimed digest does not match GitHub-derived facts', async () => {
    const client = buildCompleteTrailClient();
    const forgedDigest = 'aaaa' + 'bbbb'.repeat(15);
    const result = await evaluateMergeAuthority(100, 200, client, forgedDigest);
    assert.equal(result.allowed, false, 'forged digest must be rejected');
    assert.ok(
      result.reason.includes('digest-verification-failed'),
      'reason should mention digest failure'
    );
  });
});

describe('Merge Authority - stale local cache cannot authorize (AC1/AC3)', () => {
  it('denies even if local admin_ops claims ready but GitHub trail is incomplete', async () => {
    // Simulates: local cache says pr_create=true, merge=ready
    // but GitHub trail is missing admin handoff
    const client = buildIncompleteTrailClient();
    // Use the correct digest for the incomplete trail
    const { trail, digest } = await deriveDigest(100, client);
    const result = await evaluateMergeAuthority(100, 200, client, digest);
    // Even with correct digest, FSM denies because evidence is incomplete
    assert.equal(result.allowed, false, 'incomplete trail must be denied');
    assert.ok(result.missing.length !== 0, 'should report missing evidence');
  });
});

describe('Merge Authority - issue not found', () => {
  it('denies when the issue does not exist', async () => {
    const client = buildNotFoundClient();
    const result = await evaluateMergeAuthority(999, 200, client, 'any-digest');
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('trail-error'));
  });
});

describe('Merge Authority - break-glass bypass', () => {
  it('allows merge when break-glass label and approver evidence present', async () => {
    const client = buildBreakGlassClient();
    // Use a deliberately wrong digest to prove break-glass overrides
    const result = await evaluateMergeAuthority(100, 200, client, 'wrong-digest');
    assert.equal(result.allowed, true, 'break-glass should allow');
    assert.equal(result.break_glass, true);
    assert.equal(result.reason, 'break-glass-bypass-activated');
  });
});

describe('Merge Authority - digest mismatch without break-glass', () => {
  it('denies when digest mismatches and no break-glass', async () => {
    const client = buildCompleteTrailClient();
    const result = await evaluateMergeAuthority(100, 200, client, 'tampered-digest');
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('digest-verification-failed'));
  });
});

describe('Merge Authority - GitHub load failure', () => {
  it('denies when GitHub API throws', async () => {
    const client = {
      async getIssue() { throw new Error('rate limited'); },
      async listComments() { return []; },
      async getPR() { return null; },
      async listChecks() { return []; },
    };
    const result = await evaluateMergeAuthority(100, 200, client, 'any');
    assert.equal(result.allowed, false);
    assert.ok(result.reason.includes('github-load-failed'));
  });
});

describe('Merge Authority - result structure', () => {
  it('always includes fsm_version and authority_version', async () => {
    const client = buildCompleteTrailClient();
    const { digest } = await deriveDigest(100, client);
    const result = await evaluateMergeAuthority(100, 200, client, digest);
    assert.ok(result.fsm_version, 'must have fsm_version');
    assert.ok(result.authority_version, 'must have authority_version');
    assert.ok(Array.isArray(result.missing), 'missing must be an array');
  });
});

// #3699 (Epic #3679): the CI_GREEN rollup must EXCLUDE the self-reporting merge-gate
// context(s) — they are in_progress while this evaluator runs, so counting them makes
// CI_GREEN unsatisfiable (self-referential deadlock that manufactured bypass need).
describe('Merge Authority - CI_GREEN excludes self-reporting context (#3699)', () => {
  it('authorizes when only the baton-authority/merge self-context is non-terminal', async () => {
    const client = buildCompleteTrailClient();
    client.listChecks = async () => [
      { name: 'unit-tests', conclusion: 'success' },
      { name: 'lint-required', conclusion: 'success' },
      { name: 'baton-authority/merge', conclusion: null }, // in_progress self-context
    ];
    const { digest } = await deriveDigest(100, client, ATTESTED);
    const result = await evaluateMergeAuthority(100, 200, client, digest, ATTESTED);
    assert.equal(result.allowed, true, 'self-context must not block CI_GREEN');
    assert.deepEqual(result.missing, []);
  });

  it('does not over-exclude: a normal all-green named check list still authorizes', async () => {
    const client = buildCompleteTrailClient();
    client.listChecks = async () => [
      { name: 'unit-tests', conclusion: 'success' },
      { name: 'lint-required', conclusion: 'success' },
    ];
    const { digest } = await deriveDigest(100, client, ATTESTED);
    const result = await evaluateMergeAuthority(100, 200, client, digest, ATTESTED);
    assert.equal(result.allowed, true, 'normal green checks authorize');
    assert.deepEqual(result.missing, []);
  });
});
