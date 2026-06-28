// load-test.js -- Load-test harness for merge-authority.
// Drives N concurrent evaluations against a FAKE ghClient with
// injected 403/429 responses. Measures p50/p95/p99 latency.
// Refs #3290, Epic #3284. AC4: p95 under 30s binding SLO.
'use strict';

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { evaluateMergeAuthority } = require('./merge-authority');
const { buildEvidenceDigest } = require('./merkle');

const DEFAULT_CONCURRENCY = 50;
const RATE_LIMIT_FRACTION = 0.3;
const SLO_P95_MS = 30000;
const DEFAULT_SEED = 12345;

// LCG parameters (Numerical Recipes constants) and 2^32 normalizer.
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const UINT32_RANGE = 4294967296;

// Injected HTTP error statuses for rate-limit chaos.
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_FORBIDDEN = 403;

/**
 * Deterministic LCG pseudo-random number generator.
 * No Math.random in committed logic.
 */
function createLCG(seed) {
  let state = seed | 0;
  return function nextInt() {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) | 0;
    return state >>> 0;
  };
}

/**
 * Build a fake ghClient that injects HTTP errors on a fraction of calls.
 * rateLimitFraction: fraction of calls that return 429/403 before succeeding.
 */
function buildFakeGhClient(lcg, rateLimitFraction, trailData) {
  const threshold = Math.floor(rateLimitFraction * UINT32_RANGE);
  function maybeThrow() {
    if (lcg() < threshold) {
      const err = new Error('secondary rate limit');
      err.status = lcg() % 2 === 0 ? HTTP_TOO_MANY_REQUESTS : HTTP_FORBIDDEN;
      throw err;
    }
  }
  return {
    async getIssue(issueNumber) {
      maybeThrow();
      return trailData.issue || {
        state: 'open',
        labels: [{ name: 'status:testing' }],
      };
    },
    async listComments(issueNumber) {
      maybeThrow();
      return trailData.comments || [];
    },
    async getPR(prNumber) {
      maybeThrow();
      return trailData.pr || { merged: false };
    },
    async listChecks(prNumber) {
      maybeThrow();
      return trailData.checks || [];
    },
  };
}

/**
 * Compute percentile from a sorted array of numbers.
 */
function percentile(sortedArr, pct) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

/**
 * Build a complete-trail fixture (issue/comments/pr/checks) plus the
 * matching facts and digest the happy-path evaluation expects.
 */
function buildHappyPathFixture() {
  const completeTrailData = {
    issue: {
      state: 'open',
      labels: [{ name: 'status:testing' }],
    },
    comments: [
      { body: [
        '## ADMIN_HANDOFF',
        'signer-independence-check: PASS',
        'CI: all green',
        'worktree-merge-ok',
      ].join('\n') },
    ],
    pr: { merged: false },
    checks: [{ conclusion: 'success' }],
  };
  const fakeFacts = {
    issueNumber: 100,
    issueState: 'open',
    hasManagerHandoff: false,
    hasCollaboratorHandoff: false,
    hasAdminHandoff: true,
    hasConsultantCloseout: false,
    allAcsPass: false,
    signerIndependent: true,
    ciGreen: true,
    prMerged: false,
    worktreeMergeOk: true,
    dispositionRecorded: false,
    batonBackReason: false,
    labels: ['status:testing'],
    state: 'TESTING',
  };
  return { completeTrailData, fakeDigest: buildEvidenceDigest(fakeFacts) };
}

/**
 * Run the load test with the given parameters.
 * Returns { p50, p95, p99, totalRuns, errors, sloMet }.
 */
async function runLoadTest(options) {
  const concurrency = (options && options.concurrency) || DEFAULT_CONCURRENCY;
  const rateFraction = (options && options.rateLimitFraction !== undefined)
    ? options.rateLimitFraction : RATE_LIMIT_FRACTION;
  const seed = (options && options.seed) || DEFAULT_SEED;
  const lcg = createLCG(seed);
  const { completeTrailData, fakeDigest } = buildHappyPathFixture();
  const client = buildFakeGhClient(lcg, rateFraction, completeTrailData);
  const latencies = [];
  let errorCount = 0;
  const promises = [];
  for (let idx = 0; idx < concurrency; idx++) {
    const startMs = Date.now();
    const promise = evaluateMergeAuthority(100, 200, client, fakeDigest)
      .then(() => {
        latencies.push(Date.now() - startMs);
      })
      .catch(() => {
        latencies.push(Date.now() - startMs);
        errorCount++;
      });
    promises.push(promise);
  }
  await Promise.all(promises);
  latencies.sort((a, b) => a - b);
  return {
    totalRuns: concurrency,
    errors: errorCount,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    sloP95Ms: SLO_P95_MS,
    sloMet: percentile(latencies, 95) < SLO_P95_MS,
    seed,
    rateLimitFraction: rateFraction,
  };
}

/**
 * Write load test results to the generated/ directory.
 */
function writeReport(result) {
  const generatedDir = join(__dirname, '..', '..', '..', 'generated');
  try { mkdirSync(generatedDir, { recursive: true }); } catch (_e) { /* exists */ }
  const reportPath = join(generatedDir, 'baton-authority-load-test.json');
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
  return reportPath;
}

if (require.main === module) {
  runLoadTest({ concurrency: DEFAULT_CONCURRENCY }).then((result) => {
    const reportPath = writeReport(result);
    console.log('Load test complete. Report: ' + reportPath);
    console.log(JSON.stringify(result, null, 2));
    if (!result.sloMet) {
      console.error('SLO BREACH: p95=' + result.p95 + 'ms exceeds ' + SLO_P95_MS + 'ms');
      process.exitCode = 1;
    }
  });
}

module.exports = {
  runLoadTest,
  writeReport,
  buildFakeGhClient,
  createLCG,
  percentile,
  SLO_P95_MS,
  DEFAULT_CONCURRENCY,
};
