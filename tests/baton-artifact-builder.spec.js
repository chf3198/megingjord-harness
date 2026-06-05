'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  buildArtifact, deriveSigner, emitBuildDecision,
} = require('../scripts/global/baton-artifact-builder');
const { ARTIFACT_SPECS } = require('../scripts/global/baton-artifact-schema');

const TM = 'claude-code:opus@anthropic';

function managerInput() {
  return {
    artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TM,
    fields: {
      scope: 'do the thing', lane: 'lane:code-change', test_strategy: 'tdd-pyramid',
      acceptance: '- AC1 works', gates: 'lint, test',
    },
  };
}

test('signer is DERIVED from teamModel, never hand-typed', () => {
  assert.equal(deriveSigner(TM, 'manager'), 'Orla Mason');
  assert.equal(deriveSigner(TM, 'collaborator'), 'Orla Harper');
  assert.equal(deriveSigner(TM, 'admin'), 'Orla Reyes');
  assert.equal(deriveSigner(TM, 'consultant'), 'Orla Vale');
});

test('MANAGER_HANDOFF renders header, fields in order, and a Role: signing line', () => {
  const out = buildArtifact(managerInput());
  assert.match(out, /^## MANAGER_HANDOFF\n\n/);
  assert.ok(out.indexOf('scope:') < out.indexOf('lane:'), 'scope before lane');
  assert.ok(out.indexOf('lane:') < out.indexOf('test_strategy:'), 'lane before strategy');
  assert.match(out, /\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus@anthropic\nRole: manager$/);
});

test('Role is a signing line — no bare role-colon prose form', () => {
  const out = buildArtifact(managerInput());
  assert.match(out, /\nRole: manager$/);
  assert.equal(/(^|\n)role:\s*manager/i.test(out.replace(/Role: manager$/, '')), false);
});

test('byte-identical determinism: same input -> same bytes (repeat + env-invariant)', () => {
  const a = buildArtifact(managerInput());
  const b = buildArtifact(managerInput());
  assert.strictEqual(a, b);
  // Simulate a different runtime env; builder reads no env, so bytes are identical.
  const saved = { ...process.env };
  process.env.AI_AGENT = 'codex'; process.env.CLAUDECODE = '';
  const c = buildArtifact(managerInput());
  process.env = saved;
  assert.strictEqual(a, c);
});

test('unknown field is rejected (catches typos / prose leakage)', () => {
  const bad = managerInput();
  bad.fields.scopee = 'typo';
  assert.throws(() => buildArtifact(bad), /unknown field 'scopee'/);
});

test('missing required field throws', () => {
  const bad = managerInput();
  delete bad.fields.gates;
  assert.throws(() => buildArtifact(bad), /missing required field 'gates'/);
});

test('unknown artifact / missing role / missing teamModel throw', () => {
  assert.throws(() => buildArtifact({ artifact: 'NOPE', role: 'manager', teamModel: TM }), /unknown artifact/);
  assert.throws(() => buildArtifact({ artifact: 'MANAGER_HANDOFF', teamModel: TM, fields: {} }), /role is required/);
  assert.throws(() => buildArtifact({ artifact: 'MANAGER_HANDOFF', role: 'manager', fields: {} }), /teamModel is required/);
});

test('all six comment artifacts build from minimal valid input', () => {
  const minimal = {
    COLLABORATOR_HANDOFF: {
      scope: 's', test_strategy: 'tdd-pyramid', per_ac_verification: '- AC1 PASS',
      cross_family_rating: '95', cross_family_reviewer: 'qwen@host', cross_family_findings: 'none',
    },
    ADMIN_HANDOFF: {
      branch: 'feat/1-x', commit: 'abc123', 'signer-independence-check': 'PASS',
      'deploy-runtime-impact': 'none',
    },
    CONSULTANT_CLOSEOUT: {
      status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-01-01T00:00:00Z',
      rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: 'none',
    },
    EPIC_RESCOPE: { summary: 'rescoped' },
    BLOCKER_NOTE: {
      BLOCKER_NOTE: 'blocked', owner: 'mgr', unblock_condition: 'x', eta_or_review_time: 'soon',
    },
  };
  for (const [artifact, fields] of Object.entries(minimal)) {
    const role = artifact === 'CONSULTANT_CLOSEOUT' ? 'consultant' : 'collaborator';
    const out = buildArtifact({ artifact, role, teamModel: TM, ticket: 7, fields });
    assert.match(out, new RegExp(`^## ${artifact}\\n`));
    assert.match(out, /\nRole: /);
  }
  // ticket-bearing artifacts render `ticket: #N`; non-bearing do not.
  assert.match(buildArtifact({ artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TM, ticket: 7, fields: minimal.ADMIN_HANDOFF }), /ticket: #7/);
  assert.equal(ARTIFACT_SPECS.EPIC_RESCOPE.ticket, false);
});

test('emitBuildDecision is impure but never throws; returns a v3 event', () => {
  const os = require('node:os'); const fs = require('node:fs'); const path = require('node:path');
  const file = path.join(os.tmpdir(), `baton-builds-test-${process.pid}.jsonl`);
  const ev = emitBuildDecision({ artifact: 'MANAGER_HANDOFF', ticket: 2671, role: 'manager' }, file, '2026-01-01T00:00:00Z');
  assert.equal(ev.version, 3);
  assert.equal(ev.service, 'baton-artifact-builder');
  assert.equal(ev.ticket, '#2671');
  assert.ok(fs.readFileSync(file, 'utf8').includes('artifact_built'));
  fs.unlinkSync(file);
});
