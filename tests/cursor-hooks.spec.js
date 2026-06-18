// tests/cursor-hooks.spec.js — Phase-1 Cursor hook+HAMR parity (#3085, Epic #3083).
// Strategy: tdd-pyramid (pure EVENT_MAP round-trip + golden .cursor/hooks.json fixture)
// + stress-test (the event adapter is a side-effect-bearing gate surface: assert ALL
// five canonical harness gates fire via the camelCase events, a fault-injection path,
// and a p99 latency budget on the mapping per the test-methodology matrix).
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const emit = require('../scripts/global/cursor-hooks-emit');

// ── tdd-pyramid: pure EVENT_MAP + harness-event adapter ──

test('EVENT_MAP covers the Cursor camelCase lifecycle + native events', () => {
  expect(Object.keys(emit.EVENT_MAP).sort()).toEqual([
    'afterFileEdit', 'beforeMCPExecution', 'beforeShellExecution', 'beforeSubmitPrompt',
    'preToolUse', 'sessionStart', 'stop', 'subagentStart', 'subagentStop',
  ]);
});

test('every Cursor event maps onto a known harness PascalCase taxonomy slot', () => {
  const HARNESS_SLOTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']);
  for (const cursorEvent of Object.keys(emit.EVENT_MAP)) {
    expect(emit.HARNESS_EVENT[cursorEvent], `${cursorEvent} missing a harness slot`).toBeTruthy();
    expect(HARNESS_SLOTS.has(emit.HARNESS_EVENT[cursorEvent]),
      `${cursorEvent} → ${emit.HARNESS_EVENT[cursorEvent]} not a known slot`).toBe(true);
  }
});

test('sessionStart drives both session context AND the HAMR activation advisory (AC2)', () => {
  expect(emit.EVENT_MAP.sessionStart).toContain('session_context.py');
  expect(emit.EVENT_MAP.sessionStart).toContain('hamr_activation_check.py');
});

test('built hooks.json points commands at the deployed ~/.cursor hook dir', () => {
  const obj = emit.build();
  expect(obj.version).toBe(1);
  expect(obj.hooks.stop[0].command).toBe('python3 ~/.cursor/hooks/scripts/stop_reminder.py');
  const submitCommands = obj.hooks.beforeSubmitPrompt.map((h) => h.command).join(' ');
  expect(submitCommands).toContain('userprompt_gate.py');
});

test('golden: rendered .cursor/hooks.json matches the committed golden fixture', () => {
  const rendered = emit.render().replace(/\n$/, '');
  const golden = fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'cursor-adapter', 'hooks.golden'), 'utf8').replace(/\n$/, '');
  expect(rendered).toBe(golden);
});

test('committed .cursor/hooks.json equals a fresh emit (no drift)', () => {
  const committed = fs.readFileSync(path.join(ROOT, '.cursor', 'hooks.json'), 'utf8').replace(/\n$/, '');
  expect(committed).toBe(emit.render().replace(/\n$/, ''));
});

test('emit() writes .cursor/hooks.json under an arbitrary root (deterministic)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-hooks-'));
  const written = emit.emit(dir);
  expect(fs.existsSync(written)).toBe(true);
  expect(fs.readFileSync(written, 'utf8')).toBe(emit.render());
});

// ── stress-test: all-gates-fire + fault injection (G6) + p99 budget (G7) ──

test('stress: all canonical harness gates are reachable through Cursor events', () => {
  const commands = Object.values(emit.build().hooks).flat().map((h) => h.command).join(' ');
  for (const gate of ['session_context.py', 'hamr_activation_check.py', 'userprompt_gate.py',
    'pretool_guard.py', 'posttool_reminders.py', 'stop_reminder.py']) {
    expect(commands, `gate ${gate} unreachable via Cursor hooks`).toContain(gate);
  }
  // Phase-2 (#3086): the tool-execution events also carry the commit-ticket gate.
  expect(emit.EVENT_MAP.beforeMCPExecution).toEqual(['pretool_guard.py']);
  for (const ev of ['preToolUse', 'beforeShellExecution']) {
    expect(emit.EVENT_MAP[ev]).toEqual(['commit_ticket_gate.py', 'pretool_guard.py']);
  }
});

// ── #3086 parity: every requiredHookScript reaches Cursor (ticket-lifecycle complete) ──

test('parity: Cursor EVENT_MAP covers all orchestrator-governance-parity requiredHookScripts', () => {
  const parity = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'inventory', 'orchestrator-governance-parity.json'), 'utf8'));
  const wired = new Set(Object.values(emit.EVENT_MAP).flat());
  for (const script of parity.requiredHookScripts) {
    expect(wired.has(script), `requiredHookScript ${script} not wired into Cursor EVENT_MAP`).toBe(true);
  }
});

test('stress: fault injection — a hostile hookDir is rendered verbatim, never executed or interpolated', () => {
  const hostile = '/tmp/$(rm -rf ~); echo pwned';
  const obj = emit.build(hostile);
  // build() is pure string assembly: the path is embedded as data, the module never
  // shells out, so no command substitution can occur at emit time.
  expect(obj.hooks.stop[0].command).toBe(`python3 ${hostile}/stop_reminder.py`);
  expect(typeof emit.render(hostile)).toBe('string');
});

test('stress: p99 of 1000 build()+render() cycles stays under a 5ms budget', () => {
  const samples = [];
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const start = process.hrtime.bigint();
    emit.render();
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99, `p99 ${p99.toFixed(3)}ms exceeded 5ms budget`).toBeLessThan(5);
});
