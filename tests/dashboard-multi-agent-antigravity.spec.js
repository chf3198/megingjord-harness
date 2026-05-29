const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const JS_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'dashboard', 'js', 'multi-agent-sessions.js'),
  'utf8');
const CSS_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'dashboard', 'css', 'multi-agent.css'),
  'utf8');

test('VENDOR_ICONS includes antigravity', () => {
  assert.match(JS_SRC, /antigravity:\s*'🌌'/);
});

test('VENDOR_COLORS maps antigravity to agent-antigravity class', () => {
  assert.match(JS_SRC, /antigravity:\s*'agent-antigravity'/);
});

test('multi-agent.css defines .agent-antigravity border-color rule', () => {
  assert.match(CSS_SRC, /\.agent-antigravity\s*\{\s*border-color:\s*#34a853\s*;\s*\}/);
});

test('existing vendor entries retained (parity check)', () => {
  for (const vendor of ['copilot', 'claude', 'codex', 'cursor', 'cline', 'unknown']) {
    assert.match(JS_SRC, new RegExp(`${vendor}:\\s*['"]`));
  }
});
