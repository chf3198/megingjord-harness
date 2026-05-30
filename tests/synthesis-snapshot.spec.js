const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { snapshot, shouldTerminate } = require('../scripts/global/synthesis-snapshot.js');
const { ks2Sample } = require('../scripts/global/ks-test.js');

function mkSynth(rdN, opts = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-'));
  const synth = path.join(root, 'planning', `synthesis-${rdN}`);
  fs.mkdirSync(synth, { recursive: true });
  fs.writeFileSync(path.join(synth, 'pulse.json'), JSON.stringify({
    rdN, admin: 'cc', kickoff: opts.kickoff || '2026-05-30T16:00:00Z',
    version: 'protocol-v3',
  }));
  if (opts.decisions) {
    fs.writeFileSync(path.join(synth, 'decisions.md'), opts.decisions);
  }
  if (opts.stability) {
    fs.writeFileSync(path.join(synth, 'stability.json'), JSON.stringify(opts.stability));
  }
  return root;
}

test('K-S 2-sample on identical distributions yields high p-value', () => {
  const r = ks2Sample([1, 1, 2, 2, 3, 3], [1, 1, 2, 2, 3, 3]);
  assert.ok(r.p_value > 0.5, `expected p>0.5 on identical; got ${r.p_value}`);
});

test('K-S 2-sample on different distributions yields low p-value', () => {
  const r = ks2Sample([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
  assert.ok(r.p_value < 0.05, `expected p<0.05 on different; got ${r.p_value}`);
});

test('K-S throws on empty array', () => {
  assert.throws(() => ks2Sample([], [1, 2, 3]), /non-empty/);
});

test('shouldTerminate true when 3 consecutive p-values < 0.05', () => {
  assert.strictEqual(shouldTerminate({ wave_p_values: [0.04, 0.03, 0.02] }, false), true);
});

test('shouldTerminate false when only 2 consecutive p-values < 0.05', () => {
  assert.strictEqual(shouldTerminate({ wave_p_values: [0.04, 0.03] }, false), false);
});

test('shouldTerminate true when ceiling reached', () => {
  assert.strictEqual(shouldTerminate({ wave_p_values: [] }, true), true);
});

test('snapshot returns ceilingReached=true when elapsed > ceiling', () => {
  const root = mkSynth(1234, { kickoff: '2026-05-30T00:00:00Z' });
  const r = snapshot(1234, { root, now: '2026-05-31T01:00:00Z' });
  assert.strictEqual(r.ceilingReached, true);
  assert.strictEqual(r.terminate, true);
});

test('snapshot returns terminate=false on fresh kickoff with no decisions', () => {
  const root = mkSynth(1234, { kickoff: '2026-05-30T15:00:00Z' });
  const r = snapshot(1234, { root, now: '2026-05-30T16:00:00Z' });
  assert.strictEqual(r.terminate, false);
  assert.strictEqual(r.ks.computed, false);
});

test('snapshot throws on missing --epic', () => {
  assert.throws(() => snapshot(null, { root: '/tmp' }), /epic.*required/);
});

test('snapshot throws on non-existent synthesis dir', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'no-synth-'));
  assert.throws(() => snapshot(1234, { root }), /does not exist/);
});

test('snapshot appends p-value to stability.json on consecutive waves', () => {
  const root = mkSynth(1234, {
    kickoff: '2026-05-30T16:00:00Z',
    stability: { wave_p_values: [0.12], threshold: 0.05, consecutive_required: 3 },
    decisions: `# Decisions
<!-- wave-1 -->
- D-1: state: concur
- D-2: state: reject
<!-- wave-2 -->
- D-1: state: concur
- D-2: state: concur
`,
  });
  const r = snapshot(1234, { root, now: '2026-05-30T17:00:00Z' });
  assert.strictEqual(r.ks.computed, true);
  const stab = JSON.parse(fs.readFileSync(path.join(root, 'planning', 'synthesis-1234', 'stability.json'), 'utf8'));
  assert.strictEqual(stab.wave_p_values.length, 2);
});
