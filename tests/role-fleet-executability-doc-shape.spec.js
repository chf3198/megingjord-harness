// Doc-shape spec for role-fleet-executability research doc #2319
// Verifies expected section headers + non-empty assessment table exist.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const DOC_PATH = path.resolve(
  __dirname, '..', 'wiki', 'wisdom', 'project', 'research',
  'role-fleet-executability-2026-05-28.md'
);

function loadDoc() {
  return fs.readFileSync(DOC_PATH, 'utf8');
}

test('research doc exists at expected path', () => {
  expect(fs.existsSync(DOC_PATH)).toBe(true);
});

test('doc has required frontmatter fields', () => {
  const content = loadDoc();
  expect(content).toContain('wiki_type: wisdom');
  expect(content).toContain('scope: project');
  expect(content).toContain('phase_1_ticket: 2319');
  expect(content).toContain('parent_epic: 2299');
});

test('doc has executive summary section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## Executive summary/);
});

test('doc has per-role assessment table section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## Per-role fleet-executability assessment table/);
});

test('assessment table has all required roles', () => {
  const content = loadDoc();
  const roles = ['Manager', 'Collaborator', 'Admin', 'Consultant', 'IT', 'Red-Team'];
  for (const role of roles) {
    expect(content).toContain(role);
  }
});

test('assessment table is non-empty (has data rows)', () => {
  const content = loadDoc();
  const lines = content.split('\n');
  const tableRows = lines.filter(l => l.startsWith('| ') && !l.includes('---'));
  expect(tableRows.length).toBeGreaterThan(2);
});

test('doc has A1 matrix design section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## A1 matrix design/);
});

test('A1 matrix covers all five required factors', () => {
  const content = loadDoc();
  const factors = ['Availability', 'Capability vs task', 'Cost', 'Throughput', 'Cross-family'];
  for (const factor of factors) {
    expect(content).toContain(factor);
  }
});

test('doc has migration prioritization section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## Migration prioritization/);
});

test('migration table has impact x feasibility scores', () => {
  const content = loadDoc();
  expect(content).toContain('I x F');
});

test('doc has per-runtime applicability section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## Per-runtime applicability/);
});

test('per-runtime section covers all four runtimes', () => {
  const content = loadDoc();
  const runtimes = ['Claude Code', 'Codex', 'Copilot', 'Antigravity'];
  for (const runtime of runtimes) {
    expect(content).toContain(runtime);
  }
});

test('doc has goal-lens assessment section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## Goal-lens assessment/);
});

test('goal-lens table covers all G1-G10 goals', () => {
  const content = loadDoc();
  for (let i = 1; i <= 10; i++) {
    expect(content).toContain(`G${i}`);
  }
});

test('doc has references section', () => {
  const content = loadDoc();
  expect(content).toMatch(/## References/);
});

test('references include parent epic and phase-0 source', () => {
  const content = loadDoc();
  expect(content).toContain('#2299');
  expect(content).toContain('phase_0_sources');
});
