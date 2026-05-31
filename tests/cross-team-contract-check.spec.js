'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { run, ENTRY_POINTS, INVARIANTS } = require('../scripts/global/cross-team-contract-check');

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-contract-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function fullInvariantBody() {
  return [
    'governance/README.md is the canonical contract entry.',
    'Team&Model signing required; Signed-by must be present.',
    'Baton order: Manager Collaborator Admin Consultant.',
    'Ticket-first: Refs #1234 required.',
    'Use a dedicated worktree per concurrent agent session.',
  ].join('\n');
}

test('passes when all 4 entry points have all 4 invariants + contract pointer', () => {
  const result = run();
  assert.equal(result.ok, true, `errors: ${result.errors?.join(' | ')}`);
});

test('contract doc itself contains all 4 invariants', () => {
  const result = run();
  assert.equal(result.contractCheck.missing.length, 0, `missing: ${result.contractCheck.missing}`);
});

test('detects missing invariant in synthetic entry-point file', () => {
  const stub = 'governance/README.md is referenced. Signed-by ok. Manager baton Collaborator Admin Consultant. Refs #1.';
  // Missing "worktree" invariant.
  const re = INVARIANTS.find(i => i.id === 'dedicated-worktree');
  const hit = re.patterns.some(pat => pat.test(stub));
  assert.equal(hit, false);
});

test('entry-point list covers exactly 5 runtimes', () => {
  assert.equal(ENTRY_POINTS.length, 5);
  const labels = ENTRY_POINTS.map(e => e.label);
  assert.ok(labels.some(l => l.includes('AGENTS')));
  assert.ok(labels.some(l => l.includes('CLAUDE')));
  assert.ok(labels.some(l => l.includes('Copilot')));
  assert.ok(labels.some(l => l.includes('Codex')));
  assert.ok(labels.some(l => l.includes('Antigravity')));
});

test('invariant patterns recognize full-body example', () => {
  const body = fullInvariantBody();
  for (const inv of INVARIANTS) {
    const hit = inv.patterns.some(re => re.test(body));
    assert.equal(hit, true, `invariant ${inv.id} not matched by sample body`);
  }
});

test('--json mode returns valid JSON envelope', () => {
  const result = run();
  const j = JSON.stringify(result);
  const parsed = JSON.parse(j);
  assert.ok('ok' in parsed && 'errors' in parsed && 'entryResults' in parsed);
});
