#!/usr/bin/env node
'use strict';
// epic-aging-rollup.spec.js (#3527) — fixture self-test (#1893). Feeds synthetic epic shapes for
// the parked-epic / healthy-epic / null-subissue / zero-epic cases + asserts the sub_issues GraphQL
// header is sent (the #3354 trap). Pure — no network.
const assert = require('node:assert');
const { classifyEpic, buildRollup, graphqlHeaders, SUB_ISSUES_HEADER } = require('../scripts/global/epic-aging-rollup');

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0);
const daysAgo = (n) => new Date(NOW - n * 86400e3).toISOString();

// --- #3354 header trap: the sub_issues feature header MUST be sent, else subIssuesSummary is null ---
assert.ok(graphqlHeaders().includes(SUB_ISSUES_HEADER), 'GraphQL-Features: sub_issues header sent');
assert.strictEqual(SUB_ISSUES_HEADER, 'GraphQL-Features: sub_issues', 'exact header string');

// --- classifyEpic ---
// parked by 100%-complete-yet-open (the copilot-global-skills#1 signature)
const parkedComplete = classifyEpic(
  { repo: 'r', number: 1, title: 'all-children-done', createdAt: daysAgo(60), updatedAt: daysAgo(2), state: 'open', subIssuesSummary: { total: 4, completed: 4, percentCompleted: 100 } }, NOW);
assert.strictEqual(parkedComplete.parked, true, '100%-complete open epic is parked');
assert.strictEqual(parkedComplete.child_completion, 100);
assert.strictEqual(parkedComplete.age_days, 60);

// parked by idle > 30d
const parkedIdle = classifyEpic(
  { repo: 'r', number: 2, title: 'stale', createdAt: daysAgo(90), updatedAt: daysAgo(45), state: 'open', subIssuesSummary: { total: 3, completed: 1, percentCompleted: 33 } }, NOW);
assert.strictEqual(parkedIdle.parked, true, 'idle>30d epic is parked');
assert.strictEqual(parkedIdle.idle_days, 45);

// healthy: recent + incomplete → not parked
const healthy = classifyEpic(
  { repo: 'r', number: 3, title: 'active', createdAt: daysAgo(10), updatedAt: daysAgo(1), state: 'open', subIssuesSummary: { total: 5, completed: 2, percentCompleted: 40 } }, NOW);
assert.strictEqual(healthy.parked, false, 'recent incomplete epic is healthy');
assert.strictEqual(healthy.child_completion, 40);

// null subIssuesSummary → child_completion null (never a wrong 0%), parked judged on idle only
const nullSummary = classifyEpic(
  { repo: 'r', number: 4, title: 'no-subissues', createdAt: daysAgo(20), updatedAt: daysAgo(3), state: 'open', subIssuesSummary: null }, NOW);
assert.strictEqual(nullSummary.child_completion, null, 'null summary → null completion, not 0%');
assert.strictEqual(nullSummary.parked, false, 'recent null-summary epic not falsely parked');

// --- buildRollup: zero-epic repo + archived + unreadable + truncation coverage ---
const repos = [
  { repo: 'archived-one', archived: true },
  { repo: 'no-access', readable: false },
  { repo: 'empty', readable: true, epics: [] },
  { repo: 'big', readable: true, truncated: true, epics: [
    { number: 9, title: 'parked', createdAt: daysAgo(100), updatedAt: daysAgo(40), state: 'open', subIssuesSummary: { percentCompleted: 100 } },
  ] },
];
const { rows, coverage } = buildRollup(repos, NOW);
assert.strictEqual(rows.length, 1, 'one epic row (from big repo)');
assert.strictEqual(rows[0].repo, 'big');
assert.strictEqual(rows[0].parked, true, 'parked epic surfaced');
assert.strictEqual(coverage.reposScanned, 2, 'empty + big scanned; archived + no-access excluded');
assert.deepStrictEqual(coverage.reposWithoutEpicRead, ['no-access'], 'unreadable repo logged (no silent drop)');
assert.deepStrictEqual(coverage.truncated, ['big'], '>100-epic truncation logged (mistral R1: never silent drop)');
assert.strictEqual(coverage.parked, 1, 'parked count');

process.stdout.write('epic-aging-rollup.spec: PASS (header-sent + parked/healthy/null-subissue/zero-epic + truncation + coverage)\n');
