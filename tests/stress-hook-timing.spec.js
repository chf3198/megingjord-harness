// Stress: hook timing + timeout-field invariants for #2009.
// Lane: code-change. test_strategy: tdd-pyramid + stress-test.
// Asserts:
//  - every hook entry in the deploy template carries a `timeout` field (claude-code#44435)
//  - env.BASH_DEFAULT_TIMEOUT_MS and BASH_MAX_TIMEOUT_MS are set
//  - PreToolUse hook scripts complete in <2s under typical load (smoke spawn)

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, '.claude', 'settings.json.template');
const PRE_TOOL_USE_BUDGET_MS = 2000;

function loadTemplate() {
  return JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
}

function walkHookEntries(template) {
  const entries = [];
  for (const eventName of Object.keys(template.hooks || {})) {
    for (const matcher of template.hooks[eventName]) {
      for (const hook of matcher.hooks || []) {
        entries.push({ event: eventName, matcher: matcher.matcher || '*', hook });
      }
    }
  }
  return entries;
}

test('template carries env.BASH_DEFAULT_TIMEOUT_MS', () => {
  const t = loadTemplate();
  expect(t.env).toBeDefined();
  expect(t.env.BASH_DEFAULT_TIMEOUT_MS).toBeDefined();
  expect(Number(t.env.BASH_DEFAULT_TIMEOUT_MS)).toBeGreaterThanOrEqual(120000);
});

test('template carries env.BASH_MAX_TIMEOUT_MS', () => {
  const t = loadTemplate();
  expect(t.env.BASH_MAX_TIMEOUT_MS).toBeDefined();
  expect(Number(t.env.BASH_MAX_TIMEOUT_MS)).toBeGreaterThanOrEqual(
    Number(t.env.BASH_DEFAULT_TIMEOUT_MS)
  );
});

test('every hook entry carries a numeric `timeout` (claude-code#44435 race fix)', () => {
  const t = loadTemplate();
  const entries = walkHookEntries(t);
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect.soft(typeof entry.hook.timeout).toBe('number');
    expect.soft(entry.hook.timeout).toBeGreaterThanOrEqual(1);
    expect.soft(entry.hook.timeout).toBeLessThanOrEqual(60);
  }
});

test('PreToolUse hook entries timeout <= 5s (must not stall the permission stream)', () => {
  const t = loadTemplate();
  const pre = walkHookEntries(t).filter((e) => e.event === 'PreToolUse');
  expect(pre.length).toBeGreaterThan(0);
  for (const entry of pre) {
    expect(entry.hook.timeout).toBeLessThanOrEqual(5);
  }
});

test('stress: pretool_guard.py spawn completes in <2s with empty stdin', () => {
  const script = path.join(REPO_ROOT, 'hooks', 'scripts', 'pretool_guard.py');
  if (!fs.existsSync(script)) {
    test.skip(true, 'pretool_guard.py not present at expected location');
    return;
  }
  const start = process.hrtime.bigint();
  const r = spawnSync('python3', [script], { input: '{}', timeout: PRE_TOOL_USE_BUDGET_MS });
  const elapsed_ms = Number(process.hrtime.bigint() - start) / 1e6;
  expect(elapsed_ms).toBeLessThan(PRE_TOOL_USE_BUDGET_MS);
  expect(r.status).toBeDefined();
});

test('stress: baton_gate.py spawn completes in <2s with empty stdin', () => {
  const script = path.join(REPO_ROOT, 'hooks', 'scripts', 'baton_gate.py');
  if (!fs.existsSync(script)) {
    test.skip(true, 'baton_gate.py not present at expected location');
    return;
  }
  const start = process.hrtime.bigint();
  const r = spawnSync('python3', [script], { input: '{}', timeout: PRE_TOOL_USE_BUDGET_MS });
  const elapsed_ms = Number(process.hrtime.bigint() - start) / 1e6;
  expect(elapsed_ms).toBeLessThan(PRE_TOOL_USE_BUDGET_MS);
  expect(r.status).toBeDefined();
});
