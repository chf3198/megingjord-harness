// hamr-activate tests (#954).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const ACTIVATE = path.join(REPO_ROOT, 'scripts', 'global', 'hamr-activate.sh');
const CODEX_RUNTIME_CONFIG = path.join(REPO_ROOT, '.codex', 'runtime.config.toml');

test.describe.configure({ mode: 'serial' });

test('hamr-activate.sh exists and is executable', () => {
  expect(fs.existsSync(ACTIVATE)).toBe(true);
  expect(fs.statSync(ACTIVATE).mode & 0o100).toBeTruthy();
});

test('hamr-activate.sh runs all 5 steps and exits 0', () => {
  const result = spawnSync('bash', [ACTIVATE], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.status).toBe(0);
  for (const step of ['1/5', '2/5', '3/5', '4/5', '5/5']) {
    expect(result.stdout).toContain(step);
  }
  expect(result.stdout).toContain('HAMR activation complete');
});

test('hamr-activate.sh reports Worker reachability check', () => {
  const result = spawnSync('bash', [ACTIVATE], { cwd: REPO_ROOT, encoding: 'utf8' });
  expect(result.stdout + result.stderr).toMatch(/Worker (\/healthz reachable|unreachable)/);
});

test('managed Codex runtime config includes Tavily MCP env-auth server', () => {
  const cfg = fs.readFileSync(CODEX_RUNTIME_CONFIG, 'utf8');
  expect(cfg).toContain('[mcp_servers.tavily]');
  expect(cfg).toContain('url = "https://mcp.tavily.com/mcp/"');
  expect(cfg).toContain('bearer_token_env_var = "TAVILY_API_KEY"');
});

test('hamr-activate.sh warns on Tavily key/config drift', () => {
  const original = fs.readFileSync(CODEX_RUNTIME_CONFIG, 'utf8');
  const stripped = original
    .split('\n')
    .filter(line => !line.includes('mcp_servers.tavily'))
    .filter(line => !line.includes('mcp.tavily.com'))
    .filter(line => !line.includes('TAVILY_API_KEY'))
    .join('\n');
  fs.writeFileSync(CODEX_RUNTIME_CONFIG, stripped);
  try {
    const result = spawnSync('bash', [ACTIVATE], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...process.env, TAVILY_API_KEY: 'test-key' }
    });
    expect(result.stdout).toContain('TAVILY_API_KEY detected but [mcp_servers.tavily] is missing');
  } finally {
    fs.writeFileSync(CODEX_RUNTIME_CONFIG, original);
  }
});
