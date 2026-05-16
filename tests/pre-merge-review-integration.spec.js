'use strict';

const { test, expect } = require('@playwright/test');
const orch = require('../scripts/global/pre-merge-review-orchestrator.js');
const fs = require('node:fs');
const path = require('node:path');

const F_PASS = { severity: 'low', category: 'bug', file: 'a.js', line: 1, message: 'minor', confidence: 0.5, sub_agent: 'bug-detect' };
const F_MED = { severity: 'medium', category: 'bug', file: 'b.js', line: 2, message: 'maybe', confidence: 0.7, sub_agent: 'bug-detect' };
const F_HIGH = { severity: 'high', category: 'security', file: 'c.js', line: 3, message: 'hardcoded secret', confidence: 0.95, sub_agent: 'security' };

test('SUB_AGENTS enumerates all 4 specialized sub-agents', () => {
  expect(orch.SUB_AGENTS).toEqual(['bug-detect', 'security', 'test-coverage', 'architectural-drift']);
});

test('planSubAgents returns opt-out when env var set', () => {
  process.env.MEGINGJORD_MODEL_REVIEW_DISABLED = '1';
  expect(orch.planSubAgents({}).skipped).toBe('opt-out');
  delete process.env.MEGINGJORD_MODEL_REVIEW_DISABLED;
});

test('planSubAgents returns all 4 sub-agents by default', () => {
  const plan = orch.planSubAgents({});
  expect(plan.skipped).toBe(null);
  expect(plan.sub_agents).toEqual(orch.SUB_AGENTS);
});

test('planSubAgents filters to requested sub-agents only', () => {
  const plan = orch.planSubAgents({ sub_agents: ['security', 'bug-detect'] });
  expect(plan.sub_agents).toEqual(['security', 'bug-detect']);
});

test('aggregateFindings flattens findings across sub-agent results', () => {
  const findings = orch.aggregateFindings([{ findings: [F_PASS] }, { findings: [F_HIGH] }]);
  expect(findings).toHaveLength(2);
});

test('severityDistribution counts each tier', () => {
  const dist = orch.severityDistribution([F_PASS, F_MED, F_HIGH, F_PASS]);
  expect(dist).toEqual({ low: 2, medium: 1, high: 1 });
});

test('applySeverityGate advisory-only returns advisory_findings when any non-low', () => {
  expect(orch.applySeverityGate([F_MED], 'advisory-only').decision).toBe('advisory_findings');
});

test('applySeverityGate enforcing returns fail when high', () => {
  expect(orch.applySeverityGate([F_HIGH], 'enforcing').decision).toBe('fail');
});

test('applySeverityGate enforcing returns fail when medium', () => {
  expect(orch.applySeverityGate([F_MED], 'enforcing').decision).toBe('fail');
});

test('applySeverityGate returns pass on empty findings', () => {
  expect(orch.applySeverityGate([], 'enforcing').decision).toBe('pass');
});

test('applyTriggerEscalation raises severity to high for auth-code-change at high confidence', () => {
  const f = { severity: 'low', confidence: 0.8, trigger: 'auth-code-change' };
  expect(orch.applyTriggerEscalation(f).severity).toBe('high');
});

test('applyTriggerEscalation downgrades by one tier at medium confidence', () => {
  const f = { severity: 'low', confidence: 0.5, trigger: 'auth-code-change' };
  expect(orch.applyTriggerEscalation(f).severity).toBe('medium');
});

test('applyTriggerEscalation does NOT raise at low confidence', () => {
  const f = { severity: 'low', confidence: 0.2, trigger: 'auth-code-change' };
  expect(orch.applyTriggerEscalation(f).severity).toBe('low');
});

test('applyTriggerEscalation no-op when no trigger', () => {
  const f = { severity: 'low', confidence: 0.9 };
  expect(orch.applyTriggerEscalation(f).severity).toBe('low');
});

test('agents/pre-merge-review/ has 4 sub-agent prompt files', () => {
  const dir = path.join(__dirname, '..', 'agents', 'pre-merge-review');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  expect(files.sort()).toEqual(['architectural-drift.md', 'bug-detect.md', 'security.md', 'test-coverage.md']);
});

test('pre-merge-review.yml workflow exists with PR-event triggers', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'pre-merge-review.yml'), 'utf8');
  expect(wf).toContain('pull_request:');
  expect(wf).toContain('types: [opened, synchronize, reopened, ready_for_review]');
  expect(wf).toContain('contents: read');
  expect(wf).toContain('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5');
});

test('review-run.ts route exports reviewRun function', () => {
  const ts = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'hamr', 'routes', 'review-run.ts'), 'utf8');
  expect(ts).toContain('export function reviewRun');
  expect(ts).toContain("'advisory-only'");
  expect(ts).toContain("'enforcing'");
});

test('mcp-dispatch.ts wires review:run capability', () => {
  const ts = fs.readFileSync(path.join(__dirname, '..', 'cloudflare', 'hamr', 'routes', 'mcp-dispatch.ts'), 'utf8');
  expect(ts).toContain("case 'review:run'");
  expect(ts).toContain("import { reviewRun }");
});
