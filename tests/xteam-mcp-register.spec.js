const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/global/xteam-mcp-register.js');

function run(tmpHome, args) {
  return spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT, encoding: 'utf8',
    env: { ...process.env, MCP_REGISTER_TEST_HOME: tmpHome },
  });
}
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }
function json(file) { return JSON.parse(read(file)); }

test('create from absent with --target all writes all runtime configs', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-reg-'));
  const r = run(home, ['--target', 'all', '--root', ROOT, '--apply']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(json(path.join(home, '.config/Code/User/mcp.json')).servers['megingjord-xteam']);
  assert.ok(json(path.join(home, '.claude.json')).mcpServers['megingjord-xteam']);
  assert.ok(json(path.join(home, '.config/Antigravity/User/mcp.json')).servers['megingjord-xteam']);
  assert.match(read(path.join(home, '.codex/config.toml')), /\[mcp_servers\.megingjord-xteam\]/);
});

test('idempotent re-run preserves content byte-for-byte', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-idem-'));
  assert.strictEqual(run(home, ['--target', 'all', '--root', ROOT, '--apply']).status, 0);
  const files = [
    path.join(home, '.config/Code/User/mcp.json'), path.join(home, '.claude.json'),
    path.join(home, '.config/Antigravity/User/mcp.json'), path.join(home, '.codex/config.toml'),
  ];
  const before = files.map(read).join('\n@@\n');
  assert.strictEqual(run(home, ['--target', 'all', '--root', ROOT, '--apply']).status, 0);
  const after = files.map(read).join('\n@@\n');
  assert.strictEqual(after, before);
});

test('merge preserves unrelated existing entries and handles 0-byte JSON file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-merge-'));
  const codeFile = path.join(home, '.config/Code/User/mcp.json');
  fs.mkdirSync(path.dirname(codeFile), { recursive: true });
  fs.writeFileSync(codeFile, '');
  const claude = path.join(home, '.claude.json');
  fs.mkdirSync(path.dirname(claude), { recursive: true });
  fs.writeFileSync(claude, JSON.stringify({ mcpServers: { existing: { command: 'npx' } } }, null, 2));
  assert.strictEqual(run(home, ['--target', 'all', '--root', ROOT, '--apply']).status, 0);
  assert.ok(json(codeFile).servers['megingjord-xteam']);
  assert.ok(json(claude).mcpServers.existing);
});

test('dry-run performs no writes and reports intent', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-dry-'));
  const r = run(home, ['--target', 'all', '--root', ROOT]);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /would/);
  assert.strictEqual(fs.existsSync(path.join(home, '.claude.json')), false);
});

test('target-scoped failure does not corrupt failing target and other targets proceed', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xteam-fail-'));
  const bad = path.join(home, '.config/Code/User');
  fs.mkdirSync(path.dirname(bad), { recursive: true });
  fs.writeFileSync(bad, 'not-a-dir');
  const r = run(home, ['--target', 'all', '--root', ROOT, '--apply']);
  assert.notStrictEqual(r.status, 0);
  assert.strictEqual(read(bad), 'not-a-dir');
  assert.ok(json(path.join(home, '.claude.json')).mcpServers['megingjord-xteam']);
  assert.match(read(path.join(home, '.codex/config.toml')), /\[mcp_servers\.megingjord-xteam\]/);
  const userDir = path.join(home, '.config/Code/User');
  const leftover = fs.existsSync(userDir) && fs.statSync(userDir).isDirectory()
    ? fs.readdirSync(userDir, { withFileTypes: true })
      .some((d) => d.isFile() && d.name.startsWith('mcp.json.tmp-'))
    : false;
  assert.strictEqual(leftover, false);
});
