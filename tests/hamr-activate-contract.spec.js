'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CFG = path.join(ROOT, '.codex', 'runtime.config.toml');
const ACT = path.join(ROOT, 'scripts', 'global', 'hamr-activate.sh');

test('contract: Tavily MCP config wiring is present', () => {
  const cfg = fs.readFileSync(CFG, 'utf8');
  assert.match(cfg, /\[mcp_servers\.tavily\]/);
  assert.match(cfg, /bearer_token_env_var = "TAVILY_API_KEY"/);
});

test('contract: hamr-activate contains Tavily drift warning', () => {
  const script = fs.readFileSync(ACT, 'utf8');
  assert.match(script, /TAVILY_API_KEY detected but \[mcp_servers\.tavily\] is missing/);
});
