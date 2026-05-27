const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scan } = require('../scripts/global/credentials-env-guard.js');

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cred-env-'));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
  }
  return dir;
}

test('passes when Tavily env template and runtime config are env-backed', () => {
  const dir = fixture({
    '.env.example': 'TAVILY_API_KEY=tvly-...\nTAVILY_MCP_BASE_URL=https://mcp.tavily.com/mcp/\n',
    '.codex/runtime.config.toml': '[mcp_servers.tavily]\nurl = "https://mcp.tavily.com/mcp/"\nbearer_token_env_var = "TAVILY_API_KEY"\n',
  });
  assert.deepEqual(scan(dir), { ok: true, issues: [] });
});

test('fails when Tavily env template is missing', () => {
  const dir = fixture({
    '.env.example': 'OPENAI_API_KEY=sk-...\n',
    '.codex/runtime.config.toml': '[mcp_servers.tavily]\nurl = "https://mcp.tavily.com/mcp/"\nbearer_token_env_var = "TAVILY_API_KEY"\n',
  });
  assert.match(scan(dir).issues.join('\n'), /missing TAVILY_API_KEY template/);
});

test('fails when runtime config inlines Tavily credentials', () => {
  const dir = fixture({
    '.env.example': 'TAVILY_API_KEY=tvly-...\nTAVILY_MCP_BASE_URL=https://mcp.tavily.com/mcp/\n',
    '.codex/runtime.config.toml': '[mcp_servers.tavily]\nurl = "https://mcp.tavily.com/mcp/?tavilyApiKey=tvly-secret"\n',
  });
  const joined = scan(dir).issues.join('\n');
  assert.match(joined, /inline Tavily credentials are forbidden/);
  assert.match(joined, /bearer_token_env_var/);
});
