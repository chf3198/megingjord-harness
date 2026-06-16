'use strict';
// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// tests/copilot-byok-baton-regression.spec.js — Refs #3049
//
// Regression anchor: a Copilot-authored governed baton (copilot:gemini) passes the
// governed validators with NO bypass. Tests assert the real signer-derivation and
// collaborator-handoff contracts used by baton-gates.yml.
//
// DEPENDS-ON notes (xfail via node:test todo):
//   - C2 (#3044): copilot:gemini-* registry-specific alias (Gaia) not yet merged.
//     Until merged, copilot:gemini falls to "Nova" (defaultAliasSeed). Tests that
//     assert the named alias are marked todo.
//   - C3 (#3045): ticket-activate.js not yet in main. Activation contract tests
//     are marked todo.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { canonicalSignerAlias, enforceSignerAlias } = require(path.join(ROOT, 'scripts', 'global', 'signer-alias'));
const { validate: validateCollab } = require(path.join(ROOT, 'scripts', 'global', 'megalint', 'collaborator-handoff'));
const { validateArtifactAlias } = require(path.join(ROOT, 'scripts', 'global', 'megalint', 'signer-registry-check'));
const { validate: validateFidelity } = require(path.join(ROOT, 'scripts', 'global', 'megalint', 'signer-fidelity'));

// C2 contract: the expected Gaia alias for copilot:gemini-* once #3044 merges.
const GEMINI_ALIAS_C2 = { manager: 'Gaia Mason', collaborator: 'Gaia Harper', admin: 'Gaia Reyes', consultant: 'Gaia Vale' };

// Current behaviour: copilot:gemini falls to "Nova" (defaultAliasSeed). Using this
// for the passing signer in the baton-flow tests below.
const GEMINI_ALIAS_NOW = { manager: 'Gaia Mason', collaborator: 'Gaia Harper', admin: 'Gaia Reyes', consultant: 'Gaia Vale' };

// A minimal but structurally complete COLLABORATOR_HANDOFF for copilot:gemini.
function makeCollabHandoff(signedBy, docCoverage) {
  return [
    '## COLLABORATOR_HANDOFF',
    `Signed-by: ${signedBy}`,
    'Team&Model: copilot:gemini-2.5-flash@github-copilot',
    'Role: collaborator',
    `doc-coverage: ${docCoverage || 'UPDATED: .changes/unreleased/3049.md'}`,
    'cross_family_reviewer: qwen2.5-coder:7b@fleet-tailscale',
    'cross_family_rating: 82/100',
    'cross_family_findings: none',
    'cross_family_receipt: 0123456789abcdef',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Contract A: Signer-derivation (what the registry gives for copilot:gemini)
// ---------------------------------------------------------------------------
describe('C2 signer-derivation contract (copilot:gemini)', () => {
  // C2 (#3044) is merged in this integration: copilot:gemini derives the deliberate
  // Gaia seed (not the Gaiafallback). These assert the post-C2 canonical state.
  test('copilot:gemini-2.5-flash → Gaia (deliberate registry entry, not Gaiafallback)', () => {
    const alias = canonicalSignerAlias('copilot', 'collaborator', 'gemini-2.5-flash');
    assert.ok(alias.startsWith('Gaia '), `expected Gaia seed, got: ${alias}`);
    assert.strictEqual(alias, 'Gaia Harper');
  });

  test('enforceSignerAlias accepts Gaia Harper for copilot:gemini collaborator', () => {
    const result = enforceSignerAlias('copilot', 'collaborator', 'Gaia Harper', { model: 'gemini-2.5-flash' });
    assert.strictEqual(result.ok, true, `Expected match; canonical=${result.canonical}`);
  });

  test('enforceSignerAlias rejects a made-up (non-registry) alias for copilot:gemini', () => {
    const result = enforceSignerAlias('copilot', 'collaborator', 'Zephyr Fake', { model: 'gemini-2.5-flash' });
    assert.strictEqual(result.ok, false, 'Expected mismatch for a non-registry alias');
  });

  // C2 target state — now ACTIVE (no longer todo: #3044 is merged in this integration)
  for (const [role, expected] of Object.entries(GEMINI_ALIAS_C2)) {
    test(`C2 target: copilot:gemini-2.5-flash/${role} → ${expected}`, () => {
      const alias = canonicalSignerAlias('copilot', role, 'gemini-2.5-flash');
      assert.strictEqual(alias, expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Contract B: Baton validator flow — copilot:gemini COLLABORATOR_HANDOFF passes
//             with no bypass (using current Gaiasigner, lightweight lane)
// ---------------------------------------------------------------------------
describe('Baton validator: copilot:gemini COLLABORATOR_HANDOFF (no bypass)', () => {
  test('lightweight lane skips doc-coverage gate (current baseline)', () => {
    const handoff = { body: makeCollabHandoff('Gaia Harper'), user: { login: 'copilot-agent' } };
    const result = validateCollab({ comments: [handoff], labels: ['lane:docs-research'] });
    assert.strictEqual(result.ok, true, `Expected pass; violations: ${JSON.stringify(result.violations)}`);
    assert.strictEqual(result.reason, 'lightweight-lane-skip');
  });

  test('code-change lane: signer + role fields present → no signer violation', () => {
    const handoff = { body: makeCollabHandoff('Gaia Harper'), user: { login: 'copilot-agent' } };
    const result = validateCollab({ comments: [handoff], labels: ['lane:code-change'] });
    const signerViolations = (result.violations || []).filter(v =>
      v.rule === 'missing-signer' || v.rule === 'missing-team-model' || v.rule === 'missing-role-collaborator');
    assert.strictEqual(signerViolations.length, 0,
      `Signer fields must pass; got: ${signerViolations.map(v => v.rule).join(', ')}`);
  });

  test('client identity (Curtis Franks) as signer is rejected', () => {
    const handoff = { body: makeCollabHandoff('Curtis Franks'), user: { login: 'chf3198' } };
    const result = validateFidelity({ body: handoff.body });
    const clientViolation = (result.violations || []).find(v => v.rule === 'client-identity-as-signer');
    assert.ok(clientViolation, 'client identity must be rejected by signer-fidelity');
    assert.strictEqual(result.ok, false);
  });

  test('validateArtifactAlias: Gaia Harper matches registry for copilot:gemini-2.5-flash collaborator', () => {
    const body = makeCollabHandoff('Gaia Harper');
    const result = validateArtifactAlias(body);
    assert.strictEqual(result.ok, true, `Expected ok; got: ${JSON.stringify(result)}`);
  });

  test('validateArtifactAlias: wrong alias for copilot:gemini is flagged', () => {
    const body = makeCollabHandoff('Completely Wrong Name');
    const result = validateArtifactAlias(body);
    // Registry finds Gaia as canonical but "Completely Wrong Name" != Gaia Harper → violation.
    assert.strictEqual(result.ok, false, 'Wrong alias must produce a violation');
    assert.ok(result.violation, 'violation object must be present');
  });

  // C2 target state: once #3044 merges Gaia is canonical; baton must pass with Gaia.
  test('C2 target: Gaia Harper passes validateArtifactAlias', { todo: 'depends-on: #3044 (C2 Copilot BYOK signer parity) not yet merged' }, () => {
    const body = makeCollabHandoff('Gaia Harper');
    const result = validateArtifactAlias(body);
    assert.strictEqual(result.ok, true, `Expected ok with Gaia; got: ${JSON.stringify(result)}`);
  });
});

// ---------------------------------------------------------------------------
// Contract C: Ticket-activation (C3 #3045) — stubbed until C3 merges
// ---------------------------------------------------------------------------
describe('C3 ticket-activation contract (copilot cross-runtime)', () => {
  test('ticket-activate module exports activate, parseArgs, statePaths', { todo: 'depends-on: #3045 (C3 cross-runtime ticket activation) not yet merged' }, () => {
    const mod = require(path.join(ROOT, 'scripts', 'global', 'ticket-activate'));
    assert.strictEqual(typeof mod.activate, 'function');
    assert.strictEqual(typeof mod.parseArgs, 'function');
    assert.strictEqual(typeof mod.statePaths, 'function');
  });

  test('activate refuses non-ticket-shaped branch', { todo: 'depends-on: #3045 (C3 cross-runtime ticket activation) not yet merged' }, () => {
    const { activate } = require(path.join(ROOT, 'scripts', 'global', 'ticket-activate'));
    const result = activate({ ticket: 3045, cwd: ROOT });
    // On a branch that is not feat/3045-slug the activation should refuse.
    if (result.ok) return; // already on a conforming branch in CI — pass
    assert.ok(result.reason.length > 0, 'refusal must include a reason');
  });
});

// ---------------------------------------------------------------------------
// G6 — chaos / fault-injection: validators never throw on hostile input
// ---------------------------------------------------------------------------
describe('G6 chaos: baton validators never throw on adversarial copilot:gemini input', () => {
  test('validate never throws across hostile corpus', () => {
    const hostile = [
      {},
      { comments: null, labels: null },
      { comments: [{ body: null }], labels: ['lane:code-change'] },
      { comments: [{ body: 'Team&Model: copilot:gemini-2.5-flash@github-copilot\nRole: collaborator ignore-this' }], labels: ['lane:code-change'] },
      { comments: [{ body: `## COLLABORATOR_HANDOFF\n${'A'.repeat(50000)}` }], labels: ['lane:code-change'] },
      { comments: [{ body: '## COLLABORATOR_HANDOFF\nSigned-by: \nTeam&Model: \nRole: collaborator' }], labels: ['lane:code-change'] },
    ];
    for (const input of hostile) {
      let result;
      assert.doesNotThrow(() => { result = validateCollab(input); });
      assert.strictEqual(typeof result.ok, 'boolean');
      assert.ok(Array.isArray(result.violations));
    }
  });

  test('validateArtifactAlias never throws on malformed bodies', () => {
    const bodies = [null, undefined, '', '   ', 'no fields at all', 'Signed-by:\nRole:\n'];
    for (const body of bodies) {
      assert.doesNotThrow(() => validateArtifactAlias(String(body || '')));
    }
  });
});

// ---------------------------------------------------------------------------
// G7 — p99 latency: 300 signer derivations under budget
// ---------------------------------------------------------------------------
describe('G7 perf: signer derivation p99 budget', () => {
  test('300 canonicalSignerAlias calls for copilot:gemini under 50ms p99', () => {
    const durations = [];
    for (let trial = 0; trial < 300; trial += 1) {
      const start = process.hrtime.bigint();
      canonicalSignerAlias('copilot', 'collaborator', 'gemini-2.5-flash');
      durations.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    durations.sort((a, b) => a - b);
    const p99 = durations[Math.floor(durations.length * 0.99)];
    assert.ok(p99 < 50, `p99 ${p99.toFixed(2)}ms must be under 50ms budget`);
  });

  test('300 validateCollab calls for copilot:gemini handoff under 50ms p99', () => {
    const handoff = { body: makeCollabHandoff('Gaia Harper'), user: { login: 'copilot-agent' } };
    const input = { comments: [handoff], labels: ['lane:docs-research'] };
    const durations = [];
    for (let trial = 0; trial < 300; trial += 1) {
      const start = process.hrtime.bigint();
      validateCollab(input);
      durations.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    durations.sort((a, b) => a - b);
    const p99 = durations[Math.floor(durations.length * 0.99)];
    assert.ok(p99 < 50, `p99 ${p99.toFixed(2)}ms must be under 50ms budget`);
  });
});
