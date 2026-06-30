'use strict';
// #1935 deploy atomicity — tdd-pyramid. Fake $HOME via temp dirs; deployFn mutates a runtime home and
// can be forced to throw to exercise rollback. Verifies all-3-success, partial→rollback, total→full-restore.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const atomic = require('../scripts/global/deploy-atomic');

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-atomic-'));
  const audit = path.join(base, 'deploy-audit.jsonl');
  const runtimes = ['copilot', 'codex', 'claude'].map((name) => {
    const home = path.join(base, name);
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'state.txt'), `pre-deploy:${name}`); // pre-deploy content
    return { name, home };
  });
  return { base, audit, runtimes };
}
const deployOk = (rt) => fs.writeFileSync(path.join(rt.home, 'state.txt'), `deployed:${rt.name}`);
function readAudit(audit) {
  return fs.readFileSync(audit, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

test('all-3-success: every runtime deployed, success markers, no rollback', async () => {
  const { runtimes, audit } = fixture();
  const r = await atomic.runAtomicDeploy(runtimes, deployOk, { auditPath: audit });
  assert.equal(r.ok, true);
  for (const rt of runtimes) assert.equal(fs.readFileSync(path.join(rt.home, 'state.txt'), 'utf8'), `deployed:${rt.name}`);
  const rows = readAudit(audit);
  assert.equal(rows.filter((x) => x.event === 'deploy' && x.result === 'success').length, 3);
  assert.equal(rows.some((x) => x.event === 'rollback'), false);
});

test('partial-success → rollback: failed runtime restored to pre-deploy content (non-atomic)', async () => {
  const { runtimes, audit } = fixture();
  const deployFn = (rt) => { if (rt.name === 'codex') throw new Error('boom'); deployOk(rt); };
  const r = await atomic.runAtomicDeploy(runtimes, deployFn, { auditPath: audit, atomic: false });
  assert.equal(r.ok, false);
  assert.equal(fs.readFileSync(path.join(runtimes[0].home, 'state.txt'), 'utf8'), 'deployed:copilot'); // succeeded, kept
  assert.equal(fs.readFileSync(path.join(runtimes[1].home, 'state.txt'), 'utf8'), 'pre-deploy:codex'); // failed, restored
  assert.equal(fs.readFileSync(path.join(runtimes[2].home, 'state.txt'), 'utf8'), 'deployed:claude'); // still attempted after
  assert.equal(readAudit(audit).some((x) => x.event === 'rollback' && x.runtime === 'codex'), true);
});

test('total-failure (atomic): a partial failure rolls back ALL succeeded runtimes', async () => {
  const { runtimes, audit } = fixture();
  const deployFn = (rt) => { if (rt.name === 'codex') throw new Error('boom'); deployOk(rt); };
  const r = await atomic.runAtomicDeploy(runtimes, deployFn, { auditPath: audit, atomic: true });
  assert.equal(r.ok, false);
  assert.equal(r.atomic, true);
  assert.equal(fs.readFileSync(path.join(runtimes[0].home, 'state.txt'), 'utf8'), 'pre-deploy:copilot'); // rolled back
  assert.equal(fs.readFileSync(path.join(runtimes[1].home, 'state.txt'), 'utf8'), 'pre-deploy:codex'); // failed, restored
  assert.equal(readAudit(audit).some((x) => x.result === 'restored-atomic'), true);
});

test('emitMarker writes a schema-v3 row', () => {
  const { audit } = fixture();
  const row = atomic.emitMarker({ event: 'deploy', runtime: 'copilot', result: 'success' },
    { auditPath: audit, ts: '2026-06-30T00:00:00Z' });
  assert.equal(row.version, 3);
  assert.equal(row.service, 'deploy-atomic');
  assert.equal(readAudit(audit)[0].runtime, 'copilot');
});
