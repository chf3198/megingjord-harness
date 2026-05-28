'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const SKILL_PATH = path.resolve(__dirname, '..', 'skills', 'role-it-execution', 'SKILL.md');
const AGENT_PATH = path.resolve(__dirname, '..', '.claude', 'agents', 'it.md');
const STANDARDS_PATH = path.resolve(
  __dirname, '..', 'instructions', 'global-standards.instructions.md'
);

// ---------------------------------------------------------------------------
// IT-ops bypass marker recognition
// ---------------------------------------------------------------------------

const IT_OPS_MARKERS = [
  { name: 'env-var', pattern: /MEGINGJORD_IT_OPS=1/ },
  { name: 'subject-literal', pattern: /\[it-ops\]/ },
  { name: 'cc-prefix', pattern: /^chore\(it-ops\):/ },
];

function recognizeBypassMarker(commitSubject, env) {
  if (env && env.MEGINGJORD_IT_OPS === '1') return { matched: true, marker: 'env-var' };
  if (/\[it-ops\]/.test(commitSubject)) return { matched: true, marker: 'subject-literal' };
  if (/^chore\(it-ops\):/.test(commitSubject)) return { matched: true, marker: 'cc-prefix' };
  return { matched: false, marker: null };
}

test('env-var marker MEGINGJORD_IT_OPS=1 is recognized', () => {
  const r = recognizeBypassMarker('chore: pull model', { MEGINGJORD_IT_OPS: '1' });
  assert.equal(r.matched, true);
  assert.equal(r.marker, 'env-var');
});

test('[it-ops] subject literal is recognized', () => {
  const r = recognizeBypassMarker('chore: pull qwen2.5-coder:32b [it-ops]', {});
  assert.equal(r.matched, true);
  assert.equal(r.marker, 'subject-literal');
});

test('chore(it-ops): prefix is recognized', () => {
  const r = recognizeBypassMarker('chore(it-ops): restart dashboard pid', {});
  assert.equal(r.matched, true);
  assert.equal(r.marker, 'cc-prefix');
});

test('normal commit without any marker is not recognized as bypass', () => {
  const r = recognizeBypassMarker('feat(governance): add new rule #2318', {});
  assert.equal(r.matched, false);
  assert.equal(r.marker, null);
});

test('all three marker forms are defined in SKILL.md', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.includes('MEGINGJORD_IT_OPS=1'), 'env-var marker missing from SKILL.md');
  assert.ok(content.includes('[it-ops]'), '[it-ops] marker missing from SKILL.md');
  assert.ok(content.includes('chore(it-ops):'), 'cc-prefix marker missing from SKILL.md');
});

// ---------------------------------------------------------------------------
// IT role scope contract
// ---------------------------------------------------------------------------

test('SKILL.md exists and is non-empty', () => {
  assert.ok(fs.existsSync(SKILL_PATH), 'skills/role-it-execution/SKILL.md must exist');
  const stat = fs.statSync(SKILL_PATH);
  assert.ok(stat.size > 100, 'SKILL.md is suspiciously small');
});

test('SKILL.md declares fleet hardware scope', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.includes('36gbwinresource'), 'fleet host missing');
  assert.ok(content.includes('Tailscale'), 'Tailscale scope missing');
  assert.ok(content.includes('Ollama'), 'Ollama scope missing');
  assert.ok(content.includes('MCP server'), 'MCP server scope missing');
  assert.ok(content.includes('devbox'), 'devbox scope missing');
});

test('SKILL.md declares services scope', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.includes('HAMR'), 'HAMR service missing');
  assert.ok(content.includes('dashboard'), 'dashboard service missing');
  assert.ok(content.includes('cron'), 'cron schedule scope missing');
  assert.ok(content.toLowerCase().includes('hook installation'), 'hook installation missing');
});

test('SKILL.md declares IT boundary (no GitHub work)', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.includes('MUST NOT'), 'boundary section missing');
  assert.ok(content.includes('GitHub issues'), 'GitHub issues boundary missing');
  assert.ok(content.includes('push branches'), 'branch boundary missing');
});

test('SKILL.md lists all four supported runtimes', () => {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  assert.ok(content.includes('claude-code'), 'claude-code runtime missing');
  assert.ok(content.includes('codex'), 'codex runtime missing');
  assert.ok(content.includes('copilot'), 'copilot runtime missing');
  assert.ok(content.includes('antigravity'), 'antigravity runtime missing');
});

// ---------------------------------------------------------------------------
// Agent definition
// ---------------------------------------------------------------------------

test('.claude/agents/it.md exists', () => {
  assert.ok(fs.existsSync(AGENT_PATH), '.claude/agents/it.md must exist');
});

test('it.md declares IT hard limits', () => {
  const content = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(content.includes('Hard limits') || content.includes('hard limits'),
    'hard limits section missing from agent definition');
  assert.ok(content.includes('GitHub issues'), 'GitHub issues boundary missing from agent');
});

test('it.md references the IT skill', () => {
  const content = fs.readFileSync(AGENT_PATH, 'utf8');
  assert.ok(content.includes('role-it-execution'), 'agent must reference the IT skill');
});

// ---------------------------------------------------------------------------
// global-standards cross-reference
// ---------------------------------------------------------------------------

test('global-standards.instructions.md references skills/role-it-execution/SKILL.md', () => {
  const content = fs.readFileSync(STANDARDS_PATH, 'utf8');
  assert.ok(
    content.includes('skills/role-it-execution/SKILL.md'),
    'global-standards must cross-reference the IT skill (#2318)'
  );
});

test('global-standards IT-ops bypass section mentions #2142', () => {
  const content = fs.readFileSync(STANDARDS_PATH, 'utf8');
  assert.ok(content.includes('#2142'), 'bypass origin issue #2142 must be cited');
});
