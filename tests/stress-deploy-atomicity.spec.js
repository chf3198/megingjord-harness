'use strict';
// Stress (#1935, Epic #1875 concurrency + state-mutation surface): ≥1 chaos/fault-injection path (G6)
// + a p99 budget (G7). Concurrent marker appends must not corrupt the JSONL; rollback always restores.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const atomic = require('../scripts/global/deploy-atomic');

function tmpAudit() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-stress-')), 'deploy-audit.jsonl');
}

test('stress G6: concurrent marker appends never corrupt the audit JSONL', async () => {
  const audit = tmpAudit();
  const N = 200;
  await Promise.all(Array.from({ length: N }, (_v, i) => Promise.resolve().then(() =>
    atomic.emitMarker({ event: 'deploy', runtime: `rt-${i % 5}`, result: 'success' }, { auditPath: audit }))));
  const lines = fs.readFileSync(audit, 'utf8').trim().split('\n').filter(Boolean);
  assert.equal(lines.length, N, 'every marker appended exactly once');
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line), 'each line is valid JSON (no interleave corruption)');
});

test('stress G6 chaos: a fault-injected deploy always restores pre-deploy content', async () => {
  for (let i = 0; i < 50; i++) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-chaos-'));
    const home = path.join(base, 'rt');
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'state.txt'), 'pre');
    const audit = path.join(base, 'a.jsonl');
    const r = await atomic.runAtomicDeploy([{ name: 'rt', home }],
      () => { throw new Error(`chaos-${i}`); }, { auditPath: audit });
    assert.equal(r.ok, false);
    assert.equal(fs.readFileSync(path.join(home, 'state.txt'), 'utf8'), 'pre', 'restored every iteration');
  }
});

test('stress G7: marker emission p99 within 50ms budget', () => {
  const audit = tmpAudit();
  const N = 200; const lat = [];
  for (let i = 0; i < N; i++) {
    const s = process.hrtime.bigint();
    atomic.emitMarker({ event: 'deploy', runtime: 'rt', result: 'success' }, { auditPath: audit });
    lat.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const p99 = lat[Math.max(0, Math.ceil(N * 0.99) - 1)];
  assert.ok(p99 < 50, `marker emission p99 ${p99.toFixed(2)}ms must be < 50ms`);
});
