// Cross-runtime byte-identical baton-artifact invariant (Epic #2037 P1.4, Refs #2674).
// Machine-verifies AC6 cross-team uniformity: identical structured input yields
// byte-identical artifact output no matter which orchestrator runtime (Claude Code /
// Copilot / Codex / Antigravity) — or which locale/timezone — runs the builder.
// The builders are pure functions of input; this is the regression guard that fails
// if any runtime/locale/timezone dependence is ever introduced (e.g. a signer that
// falls through to process.env.HAMR_TEAM instead of the explicit teamModel).
//
// NB filename: the #2674 AC named tests/orchestrator-compatibility.spec.js, but that
// path is already occupied by an UNRELATED Epic #2398 governance-surface parity test.
// This byte-identical invariant lives under its own name to avoid clobbering it.
const { test, expect } = require('@playwright/test');
const { buildArtifact } = require('../scripts/global/baton-artifact-builder');
const { buildPrBody } = require('../scripts/global/baton-pr-builders');

// Each entry simulates a distinct orchestrator runtime PLUS a hostile locale/timezone.
const RUNTIME_ENVS = [
  { name: 'claude-code', env: { HAMR_TEAM: 'claude-code', MEGINGJORD_TEAM: 'claude-code', HAMR_MODEL: 'opus', TZ: 'UTC', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' } },
  { name: 'copilot', env: { HAMR_TEAM: 'copilot', MEGINGJORD_TEAM: 'copilot', HAMR_MODEL: 'gpt-5', TZ: 'America/New_York', LANG: 'C', LC_ALL: 'C' } },
  { name: 'codex', env: { HAMR_TEAM: 'codex', MEGINGJORD_TEAM: 'codex', HAMR_MODEL: 'o1', TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8', LC_ALL: 'ja_JP.UTF-8' } },
  { name: 'antigravity', env: { HAMR_TEAM: 'antigravity', MEGINGJORD_TEAM: 'antigravity', HAMR_MODEL: 'gemini', TZ: 'Pacific/Kiritimati', LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' } },
];
const TM = 'claude-code:opus@anthropic';

// Minimal valid input per comment artifact (all required fields populated, deterministic).
const ARTIFACT_FIXTURES = {
  MANAGER_HANDOFF: { role: 'manager', fields: { scope: 's', lane: 'lane:code-change', test_strategy: 'tdd-pyramid', acceptance: '- AC1', gates: 'lint', related_tickets: 'none', overlap_decision: 'no-overlap' } },
  COLLABORATOR_HANDOFF: { role: 'collaborator', fields: { scope: 's', test_strategy: 'tdd-pyramid', per_ac_verification: '- AC1 PASS', cross_family_rating: '95/100', cross_family_reviewer: 'qwen', cross_family_findings: 'ACCEPT', cross_family_receipt: '0123456789abcdef' } },
  ADMIN_HANDOFF: { role: 'admin', fields: { branch: 'feat/2674-x', commit: 'abc1234', 'signer-independence-check': 'PASS', 'deploy-runtime-impact': 'none' } },
  CONSULTANT_CLOSEOUT: { role: 'consultant', fields: { status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-06-05T00:00:00Z', rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: 'none' } },
  EPIC_RESCOPE: { role: 'manager', fields: { summary: 'rescope summary' } },
  BLOCKER_NOTE: { role: 'manager', fields: { BLOCKER_NOTE: 'blocked', owner: 'orla', unblock_condition: 'fixed', eta_or_review_time: '24h' } },
};

function renderUnderEnv(envOverrides, render) {
  const saved = {};
  for (const key of Object.keys(envOverrides)) { saved[key] = process.env[key]; process.env[key] = envOverrides[key]; }
  try { return render(); } finally {
    for (const key of Object.keys(envOverrides)) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}

for (const [artifact, fixture] of Object.entries(ARTIFACT_FIXTURES)) {
  test(`${artifact} is byte-identical across all orchestrator runtimes`, () => {
    const input = { artifact, role: fixture.role, teamModel: TM, ticket: 2674, fields: fixture.fields };
    const outputs = RUNTIME_ENVS.map((runtime) => ({
      name: runtime.name, text: renderUnderEnv(runtime.env, () => buildArtifact(input)),
    }));
    const reference = outputs[0].text;
    expect(reference.length).toBeGreaterThan(0);
    for (const output of outputs) expect(output.text, `${artifact} drifted under ${output.name}`).toBe(reference);
  });
}

test('PR body is byte-identical across all orchestrator runtimes', () => {
  const input = { ticket: 2674, title: 'feat(x): y', lane: 'lane:code-change', testStrategy: 'tdd-pyramid', summary: 'sum' };
  const outputs = RUNTIME_ENVS.map((runtime) => ({ name: runtime.name, text: renderUnderEnv(runtime.env, () => buildPrBody(input)) }));
  const reference = outputs[0].text;
  expect(reference).toContain('Refs #2674');
  for (const output of outputs) expect(output.text, `PR body drifted under ${output.name}`).toBe(reference);
});

test('covers all six comment artifacts plus PR body', () => {
  expect(Object.keys(ARTIFACT_FIXTURES).sort()).toEqual(
    ['ADMIN_HANDOFF', 'BLOCKER_NOTE', 'COLLABORATOR_HANDOFF', 'CONSULTANT_CLOSEOUT', 'EPIC_RESCOPE', 'MANAGER_HANDOFF'],
  );
});
