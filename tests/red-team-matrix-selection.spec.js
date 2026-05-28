// red-team-matrix-selection.spec.js
// Refs #2317 (Phase-1 P1.1 of Epic #2299)
// test_strategy: tdd-pyramid
// Covers selectModel() across 5 factors: availability, capability-vs-task,
// cost, throughput, cross-family. Also verifies SKILL.md cross-runtime loadability.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const DISPATCH_PATH = path.resolve(__dirname, '..', 'scripts', 'global', 'fleet-red-team-dispatch.js');
const MATRIX_PATH = path.resolve(__dirname, '..', 'config', 'red-team-model-matrix.yml');
const SKILL_PATH = path.resolve(__dirname, '..', 'skills', 'role-red-team-critique', 'SKILL.md');
const AGENT_PATH = path.resolve(__dirname, '..', '.claude', 'agents', 'red-team.md');

const { selectModel, loadMatrix } = require(DISPATCH_PATH);

// Factor 1 — availability: low-stakes selects 7b (generally_available)
test('selectModel: low stakes selects 7b (generally_available)', () => {
  const result = selectModel({ stakes: 'low' });
  expect(result.modelId).toBe('qwen2.5-coder:7b');
  expect(result.rationale).toBe('matrix-stakes-low');
});

// Factor 2 — capability-vs-task: high stakes selects 32b (higher capability)
test('selectModel: high stakes selects 32b (higher capability)', () => {
  const result = selectModel({ stakes: 'high' });
  expect(result.modelId).toBe('qwen2.5-coder:32b');
  expect(result.rationale).toBe('matrix-stakes-high');
});

// Factor 3 — cost: medium stakes selects 32b (medium cost, medium capability)
test('selectModel: medium stakes selects 32b', () => {
  const result = selectModel({ stakes: 'medium' });
  expect(result.modelId).toBe('qwen2.5-coder:32b');
  expect(result.rationale).toBe('matrix-stakes-medium');
});

// Factor 4 — throughput: unset stakes defaults to low (fast path 7b, high throughput)
test('selectModel: unset stakes defaults to low throughput path (7b)', () => {
  const result = selectModel({});
  expect(result.modelId).toBe('qwen2.5-coder:7b');
});

// Factor 5 — cross-family: explicit opts.model bypasses matrix but is caller-override
test('selectModel: explicit model override bypasses matrix', () => {
  const result = selectModel({ stakes: 'high' }, { model: 'llama3.2:8b' });
  expect(result.modelId).toBe('llama3.2:8b');
  expect(result.rationale).toBe('caller-override');
});

// qwen3:32b is blocked — must not appear in automatic selection
test('selectModel: blocked model (qwen3:32b) excluded from selection', () => {
  const result = selectModel({ stakes: 'high' });
  expect(result.modelId).not.toBe('qwen3:32b');
});

// loadMatrix: parses YAML and returns models array with expected structure
test('loadMatrix: parses matrix file and returns models with required fields', () => {
  const matrix = loadMatrix(MATRIX_PATH);
  expect(Array.isArray(matrix.models)).toBe(true);
  expect(matrix.models.length).toBeGreaterThanOrEqual(2);
  const m32 = matrix.models.find((m) => m.id === 'qwen2.5-coder:32b');
  expect(m32).toBeDefined();
  expect(m32.cross_family_ok).toBe(true);
  expect(m32.blocked).toBeFalsy();
});

// cross_family_required field is present and true in raw matrix YAML
test('matrix YAML: cross_family_required is true', () => {
  const raw = fs.readFileSync(MATRIX_PATH, 'utf8');
  expect(raw).toMatch(/cross_family_required:\s*true/);
});

// AC6 cross-runtime: SKILL.md has frontmatter with name field (Copilot/Antigravity loadable)
test('SKILL.md: frontmatter name field present for cross-runtime loadability', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  expect(content).toMatch(/^---/);
  expect(content).toMatch(/name:\s*role-red-team-critique/);
  expect(content).toMatch(/user-invocable:\s*true/);
});

// AC6: agent definition has required frontmatter fields
test('red-team.md agent: has name, model, and tools frontmatter', () => {
  const content = fs.readFileSync(AGENT_PATH, 'utf8');
  expect(content).toMatch(/name:\s*Red-Team Reviewer/);
  expect(content).toMatch(/model:\s*claude-sonnet/);
  expect(content).toMatch(/tools:/);
});

// AC5: baton-fleet-review-comment.js header updated to red-team
test('baton-fleet-review-comment.js: header updated to red-team naming', () => {
  const filePath = path.resolve(__dirname, '..', 'scripts', 'global', 'baton-fleet-review-comment.js');
  const firstLines = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 4).join('\n');
  expect(firstLines).toMatch(/red-team comment formatter/);
  expect(firstLines).not.toMatch(/guest-collaborator comment formatter/);
});
