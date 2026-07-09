'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const scaffold = require('../scripts/global/epic-scaffold.js');
const cli = require('../scripts/global/epic-scaffold-cli.js');
const phaseGate = require('../scripts/global/megalint/research-first-phase-gate.js');
const traceability = require('../scripts/global/megalint/epic-ac-traceability.js');

test('buildEpicLabels emits the canonical research-first Epic label set', () => {
  const labels = scaffold.buildEpicLabels({ priority: 'P1', area: 'scripts' });
  for (const req of ['type:epic', 'phase-gate:research-first', 'role:manager', 'status:backlog', 'priority:P1', 'area:scripts']) {
    assert.ok(labels.includes(req), `missing ${req}`);
  }
});

test('normalizers accept bare or prefixed priority/area', () => {
  assert.equal(scaffold.normPriority('P2'), 'priority:P2');
  assert.equal(scaffold.normPriority('priority:P3'), 'priority:P3');
  assert.equal(scaffold.normArea('governance'), 'area:governance');
  assert.equal(scaffold.normArea('area:hooks'), 'area:hooks');
});

test('the Epic body is JIT — zero checkbox dev-ACs (none may exist before the gate closes)', () => {
  const body = scaffold.buildEpicBody({ title: 'x', childNumber: 42 });
  assert.equal(traceability.countAcs(body), 0);
  assert.match(body, /research-first Epic/i);
  assert.match(body, /#42/); // gate ref present
});

test('research-child body states the min(G1..G9)>=7 + EPIC_RESCOPE unlock contract', () => {
  const body = scaffold.buildResearchChildBody({ title: 'x' }, 100);
  assert.match(body, /min\(G1\.\.G9\)\s*>=\s*7/);
  assert.match(body, /EPIC_RESCOPE/);
  assert.match(body, /Refs #100/);
});

test('AC2 composition: scaffold output passes BOTH canonical validators, zero violations', () => {
  const opts = { title: 'demo capability', area: 'governance', priority: 'P2', childNumber: 222 };
  const epicLabels = scaffold.buildEpicLabels(opts);
  const epicBody = scaffold.buildEpicBody(opts);
  const check = scaffold.roundTripCheck({ epicLabels, epicBody, epicNumber: 111, childNumber: 222 });
  assert.equal(check.ok, true, `violations: ${JSON.stringify(check.violations)}`);
  // Cross-verify directly against each canonical validator.
  assert.equal(phaseGate.validate({ labels: epicLabels, body: epicBody, comments: [] }).ok, true);
  assert.equal(traceability.validate({ labels: epicLabels, body: epicBody, issueNumber: 111, linkedChildren: [222], isClosingAttempt: false }).ok, true);
});

test('provenanceRecord is a one-line auditable G8 signal', () => {
  assert.equal(scaffold.provenanceRecord(10, 11, true), 'epic-scaffold: created #10 + gate #11, validators=pass');
  assert.match(scaffold.provenanceRecord(10, 11, false), /validators=FAIL/);
});

test('CLI dry-run prints a passing round-trip and makes NO gh calls', () => {
  const calls = [];
  const r = cli.applyScaffold({ title: 't', apply: false }, { execGh: (a) => { calls.push(a); return 1; }, log: () => {} });
  assert.equal(r.mode, 'dry-run');
  assert.equal(r.roundTrip.ok, true);
  assert.equal(calls.length, 0);
});

test('CLI apply creates Epic + gate child, links the ref, and emits provenance on a passing check', () => {
  const seq = [301, 302];
  const created = [];
  const r = cli.applyScaffold({ title: 't', area: 'governance', apply: true }, {
    execGh: (args) => { created.push(args[0] + ':' + args[1]); return args[1] === 'create' ? seq.shift() : ''; },
    log: () => {},
  });
  assert.equal(r.mode, 'apply');
  assert.equal(r.epicNumber, 301); assert.equal(r.childNumber, 302);
  assert.equal(r.roundTrip.ok, true);
  assert.match(r.provenance, /created #301 \+ gate #302, validators=pass/);
});

test('parseArgs reads flags + --apply', () => {
  const p = cli.parseArgs(['--title', 'hello world', '--area', 'hooks', '--apply']);
  assert.equal(p.title, 'hello world'); assert.equal(p.area, 'hooks'); assert.equal(p.apply, true);
});
