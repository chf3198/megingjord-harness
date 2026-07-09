'use strict';
// Stress coverage for epic-scaffold (#3713, Epic #3255 Phase-1). The scaffold's value is that
// it CANNOT emit a non-compliant Epic, so the invariant is: across adversarial inputs, its
// output always passes the canonical validators (or is refused) — it never silently produces
// a malformed Epic. (G6) chaos/fault-injection; (G7) p99 budget on the build+round-trip path.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const scaffold = require('../scripts/global/epic-scaffold.js');
const cli = require('../scripts/global/epic-scaffold-cli.js');

test('invariant: for any hostile opts, the scaffold output passes both validators (G6)', () => {
  const hostile = [
    {}, { title: '' }, { title: 'x'.repeat(20000) }, { title: '[ ] AC1 sneaky checkbox' },
    { title: 't', area: '', priority: '' }, { title: 't', area: 'area:area:x' },
    { title: 't', priority: 'priority:priority:P2' }, { title: 'AC-R1 [x] injected', area: 'governance' },
    { title: '#3398 #3255 refs', area: 'scripts', priority: 'P1' },
  ];
  for (const opts of hostile) {
    const withChild = { ...opts, childNumber: 999 };
    const check = scaffold.roundTripCheck({
      epicLabels: scaffold.buildEpicLabels(opts), epicBody: scaffold.buildEpicBody(withChild),
      epicNumber: 111, childNumber: 999,
    });
    assert.equal(check.ok, true, `hostile ${JSON.stringify(opts).slice(0, 40)} → ${JSON.stringify(check.violations)}`);
  }
});

test('a title that injects checkbox-AC syntax still yields zero dev-ACs (JIT preserved)', () => {
  // The Epic body must not let a malicious title smuggle a checkbox AC into the traceability count.
  const traceability = require('../scripts/global/megalint/epic-ac-traceability.js');
  const body = scaffold.buildEpicBody({ title: '- [ ] AC1: sneak a dev AC in via the title', childNumber: 5 });
  assert.equal(traceability.countAcs(body), 0);
});

test('CLI apply throws (never silently ships) if the composition self-check would fail', () => {
  // Force a degraded round-trip by making the injected gh return a child number that is not
  // referenced — the real builder always references it, so this asserts the guard exists.
  const original = scaffold.roundTripCheck;
  scaffold.roundTripCheck = () => ({ ok: false, violations: [{ rule: 'forced' }] });
  try {
    assert.throws(() => cli.applyScaffold({ title: 't', apply: true }, { execGh: (a) => (a[1] === 'create' ? 1 : ''), log: () => {} }), /self-check FAILED/);
  } finally { scaffold.roundTripCheck = original; }
});

test('p99 latency budget: build + round-trip < 3ms p99 over 3k adversarial runs (G7)', () => {
  const samples = [];
  for (let i = 0; i < 3000; i += 1) {
    const opts = { title: `cap ${i} ${'x'.repeat(i % 200)}`, area: i % 2 ? 'governance' : 'scripts', priority: i % 3 ? 'P1' : 'P2', childNumber: i + 1 };
    const t0 = process.hrtime.bigint();
    scaffold.roundTripCheck({ epicLabels: scaffold.buildEpicLabels(opts), epicBody: scaffold.buildEpicBody(opts), epicNumber: i, childNumber: i + 1 });
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < 3, `p99=${p99.toFixed(3)}ms exceeds 3ms budget`);
});
