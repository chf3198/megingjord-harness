'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/global/tavily-mcp-register.js');

function run(home, args) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, MCP_REGISTER_TEST_HOME: home },
  });
}
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function json(file) { return JSON.parse(read(file)); }

test('register --target all writes Copilot, Codex, and Claude config', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tavily-reg-'));
  const r = run(home, ['--target', 'all', '--apply']);
  assert.equal(r.status, 0, r.stderr);
  const copilot = json(path.join(home, '.config/Code/User/mcp.json')).servers.tavily;
  assert.equal(copilot.auth.type, 'oauth');
  assert.equal(copilot.bearerTokenEnvVar, 'TAVILY_API_KEY');
  assert.ok(json(path.join(home, '.claude.json')).mcpServers.tavily);
  assert.match(read(path.join(home, '.codex/config.toml')), /\[mcp_servers\.tavily\]/);
});

test('dry-run reports intent and does not write files', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tavily-dry-'));
  const r = run(home, ['--target', 'all']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /would/);
  assert.equal(fs.existsSync(path.join(home, '.claude.json')), false);
});
