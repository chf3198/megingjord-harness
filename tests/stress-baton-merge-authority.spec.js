// stress-baton-merge-authority.spec.js -- Stress tests for merge authority.
// (a) Chaos/fault-injection: 403/429 + malformed responses across randomized runs.
// (b) p95 latency assertion under injected rate-limit (G7 SLO).
// Refs #3290, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateMergeAuthority } = require('../scripts/global/baton-authority/merge-authority');
const { buildEvidenceDigest } = require('../scripts/global/baton-authority/merkle');
const { deriveTrailFromGitHub, buildEvidenceMask } = require('../scripts/global/baton-authority/evidence-loader');
const { runLoadTest, SLO_P95_MS } = require('../scripts/global/baton-authority/load-test');

// Deterministic LCG (no Math.random)
function createLCG(seed) {
  let state = seed | 0;
  return function nextInt() {
    state = (state * 1664525 + 1013904223) | 0;
    return state >>> 0;
  };
}

function lcgChoice(lcg, arr) {
  return arr[lcg() % arr.length];
}

// --- G6 Chaos/fault-injection tests ---

describe('G6 chaos: merge authority never allows on incomplete/forged trail', () => {
  const CHAOS_ITERATIONS = 500;
  const lcg = createLCG(7777);

  it('never returns allowed=true across ' + CHAOS_ITERATIONS + ' adversarial iterations', async () => {
    let allowedOnBadTrail = 0;
    const labelSets = [
      [{ name: 'status:testing' }],
      [{ name: 'status:in-progress' }],
      [{ name: 'status:review' }],
      [{ name: 'status:backlog' }],
      [],
    ];
    const commentSets = [
      [],
      [{ body: '## MANAGER_HANDOFF' }],
      [{ body: 'random comment no artifacts' }],
      [{ body: '## ADMIN_HANDOFF\nsome content' }],
      [{ body: null }],
    ];
    const errorModes = ['none', 'throw-on-issue', 'throw-on-comments', 'null-issue', 'malformed'];

    for (let iter = 0; iter < CHAOS_ITERATIONS; iter++) {
      const labels = lcgChoice(lcg, labelSets);
      const comments = lcgChoice(lcg, commentSets);
      const errorMode = lcgChoice(lcg, errorModes);
      const useForgedDigest = (lcg() % 3) !== 0;

      const client = {
        async getIssue() {
          if (errorMode === 'throw-on-issue') throw new Error('chaos-403');
          if (errorMode === 'null-issue') return null;
          if (errorMode === 'malformed') return { state: undefined, labels: 'not-an-array' };
          return { state: 'open', labels };
        },
        async listComments() {
          if (errorMode === 'throw-on-comments') throw new Error('chaos-429');
          return comments;
        },
        async getPR() {
          if (lcg() % 5 === 0) throw new Error('chaos-pr');
          return { merged: lcg() % 4 === 0 };
        },
        async listChecks() {
          if (lcg() % 5 === 0) throw new Error('chaos-checks');
          return lcg() % 3 === 0
            ? [{ conclusion: 'success' }]
            : [{ conclusion: 'failure' }];
        },
      };

      let digest;
      if (useForgedDigest) {
        digest = 'forged-' + iter + '-' + lcg().toString(16);
      } else {
        try {
          const trail = await deriveTrailFromGitHub(iter, client);
          digest = trail.facts ? buildEvidenceDigest(trail.facts) : 'no-facts';
        } catch (_err) {
          digest = 'error-digest';
        }
      }

      let result;
      try {
        result = await evaluateMergeAuthority(iter, iter + 1000, client, digest);
      } catch (_err) {
        // Unhandled throw counts as safe denial
        continue;
      }

      if (result.allowed && !result.break_glass) {
        // Verify the trail was actually complete if allowed
        const trail = await deriveTrailFromGitHub(iter, client).catch(() => null);
        if (!trail || !trail.facts) {
          allowedOnBadTrail++;
        }
      }
    }
    assert.equal(
      allowedOnBadTrail, 0,
      'merge authority must never allow on incomplete/forged trail'
    );
  });
});

describe('G6 chaos: malformed API responses degrade safely', () => {
  it('handles null/undefined/non-object responses without throwing', async () => {
    const badClients = [
      {
        async getIssue() { return undefined; },
        async listComments() { return undefined; },
        async getPR() { return undefined; },
        async listChecks() { return undefined; },
      },
      {
        async getIssue() { return { state: 'open', labels: null }; },
        async listComments() { return null; },
        async getPR() { return null; },
        async listChecks() { return null; },
      },
      {
        async getIssue() { return { state: 'open', labels: 'string-not-array' }; },
        async listComments() { return 'not-array'; },
        async getPR() { return 42; },
        async listChecks() { return 'bad'; },
      },
    ];
    for (const client of badClients) {
      const result = await evaluateMergeAuthority(1, 2, client, 'any-digest');
      assert.equal(result.allowed, false, 'must deny on malformed responses');
    }
  });
});

// --- G7 p95 latency under 30s SLO ---

describe('G7 p95 latency under SLO with injected rate-limiting', () => {
  it('p95 latency stays under ' + SLO_P95_MS + 'ms with 30 pct rate-limit injection', async () => {
    const result = await runLoadTest({
      concurrency: 30,
      rateLimitFraction: 0.3,
      seed: 42424242,
    });
    assert.ok(
      result.p95 < SLO_P95_MS,
      'p95 (' + result.p95 + 'ms) must be under SLO (' + SLO_P95_MS + 'ms)'
    );
    assert.ok(result.sloMet, 'sloMet flag should be true');
    assert.ok(result.totalRuns === 30, 'should have run 30 evaluations');
  });
});

describe('G7 p95 latency under heavy rate-limiting', () => {
  it('p95 latency stays under SLO even with 60 pct rate-limit injection', async () => {
    const result = await runLoadTest({
      concurrency: 20,
      rateLimitFraction: 0.6,
      seed: 99999,
    });
    assert.ok(
      result.p95 < SLO_P95_MS,
      'p95 (' + result.p95 + 'ms) must be under SLO (' + SLO_P95_MS + 'ms) even at 60pct rate-limit'
    );
  });
});

// #3699: the self-context CI_GREEN filter must never throw on adversarial check
// shapes (missing names, only-self-context, huge lists) and must not authorize on
// an incomplete trail regardless of check-list contents.
describe('G6 chaos: #3699 self-context filter tolerates adversarial check lists', () => {
  it('never throws and never allows on incomplete trail across adversarial check shapes', async () => {
    const shapes = [
      [{ conclusion: 'success' }], // no name field
      [{ name: 'baton-authority/merge', conclusion: null }], // only self-context, pending
      [{ name: null, conclusion: 'success' }, { name: 'baton-authority/merge', conclusion: 'in_progress' }],
      Array.from({ length: 500 }, (_, i) => ({ name: 'chk-' + i, conclusion: i % 2 ? 'success' : 'failure' })),
    ];
    for (let i = 0; i < shapes.length; i += 1) {
      const client = {
        async getIssue() { return { number: i, labels: [] }; },
        async listComments() { return []; }, // incomplete trail (no handoffs)
        async getPR() { return { merged: false }; },
        async listChecks() { return shapes[i]; },
      };
      let result;
      await assert.doesNotReject(async () => {
        const trail = await deriveTrailFromGitHub(i, client);
        const digest = buildEvidenceDigest(buildEvidenceMask(trail));
        result = await evaluateMergeAuthority(i, i + 2000, client, digest);
      }, 'adversarial check shape ' + i + ' must not throw');
      assert.equal(result.allowed, false, 'incomplete trail must never be allowed (shape ' + i + ')');
    }
  });
});
