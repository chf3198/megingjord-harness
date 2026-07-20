// Tests for scripts/global/phase1-auto-materialize.js (Epic #2678 AC2, AC5).
const { test, expect } = require('@playwright/test');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Isolate incidents.jsonl writes BEFORE requiring modules (incidents-store binds HOME at load).
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-mat-'));
process.env.HOME = TMP_HOME;
const mat = require('../scripts/global/phase1-auto-materialize');
const { makeGithub, validPlanRating } = require('./phase0-github-mock');
const INCIDENTS = path.join(TMP_HOME, '.megingjord', 'incidents.jsonl');
const PR500 = validPlanRating(500); // #3826: green now requires a verified plan-rating

const epicObj = { number: 500, labels: ['type:epic', 'phase-gate:research-first', 'area:governance', 'priority:P1'] };

test('AC2: buildPhase1Seed inherits area/priority, sets phase-gate:phase-1 and Parent ref', () => {
  const seed = mat.buildPhase1Seed(epicObj);
  expect(seed.labels).toContain('phase-gate:phase-1');
  expect(seed.labels).toContain('area:governance');
  expect(seed.labels).toContain('priority:P1');
  expect(seed.labels).toContain('status:backlog');
  expect(seed.body).toContain('Parent: #500');
  expect(seed.title).toContain('#500');
});

test('AC2: buildPhase1Seed falls back to area:governance / priority:P2 when absent', () => {
  const seed = mat.buildPhase1Seed({ number: 7, labels: ['type:epic', 'phase-gate:research-first'] });
  expect(seed.labels).toContain('area:governance');
  expect(seed.labels).toContain('priority:P2');
});

function greenMissingFixture() {
  return makeGithub({
    issues: {
      500: { state: 'open', labels: ['type:epic', 'phase-gate:research-first', 'area:governance'], body: 'child #501' },
      501: { state: 'closed', labels: ['phase-gate:research-first'], body: 'Parent: #500' },
    },
    commentsByIssue: { 500: [{ body: 'EPIC_RESCOPE' }, PR500.comment], 501: [{ body: 'CONSULTANT_CLOSEOUT 8/10' }] },
  });
}

test('AC2: materialize is a no-op when Phase-0 is not green/missing', async () => {
  const { github } = makeGithub({
    issues: { 500: { state: 'open', labels: ['type:epic', 'phase-gate:research-first'], body: 'child #501' },
      501: { state: 'open', labels: ['phase-gate:research-first'], body: 'Parent: #500' } },
    commentsByIssue: { 500: [{ body: 'EPIC_RESCOPE' }] },
  });
  const r = await mat.materialize({ github, owner: 'o', repo: 'r', epicNumber: 500 });
  expect(r.created).toBe(false);
});

test('AC2: dry-run builds the seed but creates nothing', async () => {
  const { github, created } = greenMissingFixture();
  const r = await mat.materialize({ github, owner: 'o', repo: 'r', epicNumber: 500, dryRun: true, ledger: PR500.ledger });
  expect(r.dryRun).toBe(true);
  expect(r.seed.labels).toContain('phase-gate:phase-1');
  expect(created.length).toBe(0);
});

test('AC2+AC5: green+missing creates a seed child, posts Epic comment, and emits an incident', async () => {
  const { github, created, postedComments } = greenMissingFixture();
  const r = await mat.materialize({ github, owner: 'o', repo: 'r', epicNumber: 500, ledger: PR500.ledger });
  expect(r.created).toBe(true);
  expect(created.length).toBe(1);
  expect(created[0].labels).toContain('phase-gate:phase-1');
  expect(postedComments.some((c) => /PHASE1_AUTO_MATERIALIZED/.test(c.body))).toBe(true);
  const log = fs.readFileSync(INCIDENTS, 'utf8');
  expect(log).toContain('phase0-complete-no-phase1');
});
