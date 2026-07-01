// tests/copilot-detection-deltakind.spec.js — Epic #3411 T2.6 (#3449).
// Strategy: tdd-pyramid. Asserts:
//   1. copilot.json declares deltaKind: "ai-agent-value" + aiAgentValue field.
//   2. Schema conditional REJECTS a copilot-like descriptor missing aiAgentValue.
//   3. Validator treats copilot's detection as valid (no detection-gap finding).
//   4. detect-runtime.js was NOT modified from origin/main.
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const rd = require('../scripts/global/runtime-descriptor');

// --- 1. copilot.json declares ai-agent-value deltaKind with aiAgentValue field ---

test('copilot.json declares deltaKind ai-agent-value', () => {
  const copilot = rd.loadDescriptor('copilot');
  assert.equal(copilot.detection.deltaKind, 'ai-agent-value');
});

test('copilot.json provides the aiAgentValue field', () => {
  const copilot = rd.loadDescriptor('copilot');
  assert.ok(copilot.detection.aiAgentValue, 'aiAgentValue must be set');
  assert.equal(typeof copilot.detection.aiAgentValue, 'string');
});

test('copilot.json aiAgentValue matches the expected runtime name', () => {
  const copilot = rd.loadDescriptor('copilot');
  assert.equal(copilot.detection.aiAgentValue, 'copilot');
});

// --- 2. Validator REJECTS a descriptor with deltaKind ai-agent-value but no aiAgentValue ---

test('validator rejects ai-agent-value descriptor missing aiAgentValue', () => {
  const malformed = {
    runtime: 'copilot',
    detection: { primaryEnvMarkers: [], deltaKind: 'ai-agent-value' },
    signing: { team: 'copilot', substrates: ['github-copilot'] },
    deploy: { home: '~/.copilot', artifactClasses: ['settings'] },
    hooks: { configPath: 'hooks/global-standards.json', eventCase: 'PascalCase', events: [] },
    capabilities: { ghAuth: 'available via GitHub session', hookExecution: 'integrated terminal', fallback: 'none' },
  };
  const errors = [];
  // Call internal validateShape by re-requiring the module logic via validateAll with roundTrip off
  // We test via a duck-typed call: build the descriptor object and confirm the error surfaces.
  // validateAll reads from disk; replicate the shape check directly via module internals.
  // Since validateShape is not exported, we test via validateAll on real descriptors and
  // confirm the error message for the missing-aiAgentValue path is present by building a
  // temporary descriptor file, then restoring it.
  const descriptorPath = path.join(REPO_ROOT, 'inventory', 'runtimes', '_test-malformed-aav.json');
  try {
    fs.writeFileSync(descriptorPath, JSON.stringify(malformed, null, 2) + '\n', 'utf8');
    const result = rd.validateAll({ roundTrip: false });
    const relevantError = result.errors.find((errMsg) => errMsg.includes('ai-agent-value') && errMsg.includes('aiAgentValue'));
    assert.ok(relevantError, 'expected a validation error about missing aiAgentValue for ai-agent-value deltaKind');
  } finally {
    try { fs.unlinkSync(descriptorPath); } catch (_unlinkErr) { /* already gone */ }
  }
});

// --- 3. Validator treats copilot detection as valid — no detection-gap finding ---

test('full validateAll reports no errors (copilot detection is valid)', () => {
  const result = rd.validateAll();
  assert.ok(result.ok, 'validateAll must pass: ' + JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
});

test('validateAll produces no copilot-specific detection-gap error', () => {
  const result = rd.validateAll();
  const copilotErrors = result.errors.filter((errMsg) => errMsg.includes('copilot'));
  assert.deepEqual(copilotErrors, [], 'no copilot errors expected');
});

test('copilot appears in the validated runtime set', () => {
  const result = rd.validateAll();
  assert.ok(result.runtimes.includes('copilot'), 'copilot must be in the validated runtimes list');
});

// --- 4. detect-runtime.js was NOT modified ---

test('detect-runtime.js is unchanged from origin/main', () => {
  let diffOutput;
  try {
    diffOutput = execSync(
      'git diff --stat origin/main -- scripts/global/detect-runtime.js',
      { cwd: REPO_ROOT, encoding: 'utf8' }
    ).trim();
  } catch (execErr) {
    // git diff exits non-zero when there are differences; that IS the failure case
    diffOutput = execErr.stdout ? execErr.stdout.trim() : execErr.message;
  }
  assert.equal(diffOutput, '', 'detect-runtime.js must not differ from origin/main — logic must not change');
});
