const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { init, adminTeam, TEAMS } = require('../scripts/global/synthesis-init.js');

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'synthesis-init-'));
}

test('init creates planning/synthesis-<N>/ tree with all 6 v3 §6 paths', () => {
  const root = mkTmp();
  init(1234, null, { root, now: '2026-05-29T23:55:00Z' });
  const synth = path.join(root, 'planning', 'synthesis-1234');
  assert.ok(fs.statSync(path.join(synth, 'artifacts')).isDirectory());
  assert.ok(fs.statSync(path.join(synth, 'positions')).isDirectory());
  assert.ok(fs.existsSync(path.join(synth, 'pulse.json')));
  assert.ok(fs.existsSync(path.join(synth, 'decisions.md')));
  assert.ok(fs.existsSync(path.join(synth, 'status.md')));
  assert.ok(fs.existsSync(path.join(synth, 'stability.json')));
});

test('init populates pulse.json with kickoff + admin + ticket + version', () => {
  const root = mkTmp();
  init(1234, null, { root, now: '2026-05-29T23:55:00Z' });
  const pulse = JSON.parse(fs.readFileSync(path.join(root, 'planning', 'synthesis-1234', 'pulse.json'), 'utf8'));
  assert.strictEqual(pulse.rdN, 1234);
  assert.strictEqual(pulse.kickoff, '2026-05-29T23:55:00Z');
  assert.strictEqual(pulse.version, 'protocol-v3');
  assert.ok(TEAMS.includes(pulse.admin));
  assert.deepStrictEqual(pulse.teams, ['cc', 'cp', 'cx', 'ag']);
});

test('admin rotation is deterministic per ticket-N mod team-count', () => {
  assert.strictEqual(adminTeam(0), 'cc');
  assert.strictEqual(adminTeam(1), 'cp');
  assert.strictEqual(adminTeam(2), 'cx');
  assert.strictEqual(adminTeam(3), 'ag');
  assert.strictEqual(adminTeam(4), 'cc');
  assert.strictEqual(adminTeam(1112), 'cc');
  assert.strictEqual(adminTeam(2403), 'ag');
});

test('--admin-team override wins over rotation', () => {
  assert.strictEqual(adminTeam(0, 'cx'), 'cx');
  assert.strictEqual(adminTeam(1112, 'ag'), 'ag');
});

test('init is idempotent: re-init on existing dir does not overwrite without --force', () => {
  const root = mkTmp();
  init(99, null, { root });
  // Mark a file so we can detect overwrite
  const stamp = path.join(root, 'planning', 'synthesis-99', 'pulse.json');
  fs.writeFileSync(stamp + '.marker', 'preserved');
  const r2 = init(99, null, { root });
  assert.strictEqual(r2.created, false);
  assert.ok(fs.existsSync(stamp + '.marker'));
});

test('init throws on missing or non-integer --epic', () => {
  const root = mkTmp();
  assert.throws(() => init(null, null, { root }), /epic.*required.*integer/);
  assert.throws(() => init('abc', null, { root }), /epic.*required.*integer/);
});

test('per-team position log files seeded for all 4 teams', () => {
  const root = mkTmp();
  init(1234, null, { root });
  const posDir = path.join(root, 'planning', 'synthesis-1234', 'positions');
  for (const t of TEAMS) {
    assert.ok(fs.existsSync(path.join(posDir, `${t}.md`)));
  }
});

test('stability.json has K-S threshold + consecutive_required per v3 §5', () => {
  const root = mkTmp();
  init(1234, null, { root });
  const stab = JSON.parse(fs.readFileSync(path.join(root, 'planning', 'synthesis-1234', 'stability.json'), 'utf8'));
  assert.strictEqual(stab.threshold, 0.05);
  assert.strictEqual(stab.consecutive_required, 3);
  assert.deepStrictEqual(stab.wave_p_values, []);
});
