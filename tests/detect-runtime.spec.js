'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { detectRuntime } = require('../scripts/global/detect-runtime');

test('AI_AGENT convention → high-confidence runtime', () => {
  assert.deepStrictEqual(detectRuntime({ AI_AGENT: 'claude-code_2-1-162_agent' }).runtime, 'claude-code');
  assert.strictEqual(detectRuntime({ AI_AGENT: 'copilot_1.2' }).runtime, 'copilot');
  assert.strictEqual(detectRuntime({ AI_AGENT: 'codex-cli' }).runtime, 'codex');
});
test('claude-code primary markers (no AI_AGENT)', () => {
  assert.strictEqual(detectRuntime({ CLAUDECODE: '1' }).runtime, 'claude-code');
  assert.strictEqual(detectRuntime({ CLAUDE_CODE_ENTRYPOINT: 'claude-vscode' }).runtime, 'claude-code');
});
test('codex / antigravity primary markers', () => {
  assert.strictEqual(detectRuntime({ CODEX_HOME: '/x' }).runtime, 'codex');
  assert.strictEqual(detectRuntime({ ANTIGRAVITY_AGENT: '1' }).runtime, 'antigravity');
});
test('CRITICAL: COPILOT_OTEL_* alone is NOT a copilot runtime signal → unknown', () => {
  const r = detectRuntime({ COPILOT_OTEL_ENABLED: 'true', COPILOT_OTEL_EXPORTER_TYPE: 'file' });
  assert.strictEqual(r.runtime, 'unknown');
  assert.match(r.signal, /workspace-injected/);
});
test('empty env → unknown (never guesses)', () => {
  assert.strictEqual(detectRuntime({}).runtime, 'unknown');
});

const SIG = path.join(__dirname, '..', 'scripts', 'global', 'agent-signature.js');
function runSig(env) {
  try { return execFileSync('node', [SIG, '--model', 'opus', '--role', 'collaborator'], { env, encoding: 'utf8' }); }
  catch (e) { return { code: e.status, stderr: String(e.stderr || '') }; }
}
test('agent-signature: auto-resolves team from runtime detection when HAMR_TEAM unset', () => {
  const out = runSig({ PATH: process.env.PATH, CLAUDECODE: '1' }); // no HAMR_TEAM
  assert.match(String(out), /claude-code:opus@local/); // team auto-resolved from runtime detection
});
test('agent-signature: unknown runtime still fails loud (no guessing)', () => {
  const out = runSig({ PATH: process.env.PATH, COPILOT_OTEL_ENABLED: 'true' }); // OTEL only, no team
  assert.strictEqual(out.code, 2);
  assert.match(out.stderr, /unresolved identity/);
});
