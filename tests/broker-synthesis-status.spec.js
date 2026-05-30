const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { status } = require('../scripts/global/broker-synthesis-status.js');

function mkSynthDir(rdN, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-status-'));
  const synth = path.join(root, 'planning', `synthesis-${rdN}`);
  fs.mkdirSync(synth, { recursive: true });
  fs.writeFileSync(path.join(synth, 'pulse.json'), JSON.stringify({
    rdN, admin: opts.admin || 'cc', kickoff: opts.kickoff || '2026-05-29T20:00:00Z',
    version: 'protocol-v3', teams: ['cc', 'cp', 'cx', 'ag'],
  }));
  fs.writeFileSync(path.join(synth, 'status.md'),
    `# Status — synthesis-${rdN}\n\nPhase: ${opts.phase || 'Phase-D'}\nWave: ${opts.wave || 2}\n`);
  fs.writeFileSync(path.join(synth, 'stability.json'), JSON.stringify({
    wave_p_values: opts.pValues || [0.12, 0.08, 0.04],
    threshold: 0.05, consecutive_required: 3,
  }));
  return root;
}

test('status returns structured JSON summary for existing synthesis', () => {
  const root = mkSynthDir(1234);
  const r = status(1234, { root, now: '2026-05-29T22:00:00Z' });
  assert.strictEqual(r.rdN, 1234);
  assert.strictEqual(r.admin, 'cc');
  assert.strictEqual(r.phase, 'Phase-D');
  assert.strictEqual(r.wave, 2);
});

test('elapsed and remaining hours computed correctly', () => {
  const root = mkSynthDir(1234, { kickoff: '2026-05-29T20:00:00Z' });
  const r = status(1234, { root, now: '2026-05-29T22:00:00Z' });
  assert.strictEqual(r.elapsedHours, 2);
  assert.strictEqual(r.remainingHours, 22);
  assert.strictEqual(r.capHours, 24);
});

test('latest K-S p-value reported from stability.json', () => {
  const root = mkSynthDir(1234, { pValues: [0.15, 0.09, 0.03] });
  const r = status(1234, { root });
  assert.strictEqual(r.latestKsPvalue, 0.03);
  assert.strictEqual(r.totalWavesObserved, 3);
  assert.strictEqual(r.ksThreshold, 0.05);
  assert.strictEqual(r.consecutiveRequired, 3);
});

test('error on missing --epic', () => {
  assert.throws(() => status(null, { root: '/tmp' }), /epic.*required.*integer/);
});

test('error on non-existent synthesis dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-empty-'));
  assert.throws(() => status(1234, { root }), /does not exist/);
});

test('custom capHours respected', () => {
  const root = mkSynthDir(1234, { kickoff: '2026-05-29T18:00:00Z' });
  const r = status(1234, { root, now: '2026-05-29T22:00:00Z', capHours: 12 });
  assert.strictEqual(r.elapsedHours, 4);
  assert.strictEqual(r.remainingHours, 8);
  assert.strictEqual(r.capHours, 12);
});

test('remainingHours clamps to 0 when over-cap', () => {
  const root = mkSynthDir(1234, { kickoff: '2026-05-29T00:00:00Z' });
  const r = status(1234, { root, now: '2026-05-30T08:00:00Z' });
  assert.strictEqual(r.remainingHours, 0);
});
