const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const W = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'write-safety.js'));

const BASE = { author: 'test', model: 'local', agent_role: 'collaborator', commit: 'abc123',
  thread_id: 'thread-1' };

test('#1111 readThreadStatus derives status.md without a lock', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-thread-status-'));
  const items = [
    ['claude.md', { ...BASE, team: 'claude-code', append_position: 1 }],
    ['copilot.md', { ...BASE, team: 'copilot-team', append_position: 2 }],
    ['codex.md', { ...BASE, team: 'codex-team', append_position: 3 }],
  ];
  for (const [file, provenance] of items) {
    const stamped = W.stampProvenance(`# ${file}`, provenance, { scope: 'team-append' });
    fs.writeFileSync(path.join(dir, file), stamped.stamped);
  }
  const status = W.readThreadStatus(dir);
  expect(status.ok).toBe(true);
  expect(status.appends.map(item => item.team).sort()).toEqual([
    'claude-code', 'codex-team', 'copilot-team',
  ]);
  expect(status.status_md).toContain('# Thread Status');
  const locks = fs.existsSync(W.LOCK_DIR) ? fs.readdirSync(W.LOCK_DIR) : [];
  expect(locks.filter(file => file.endsWith('.lock')).length).toBe(0);
  fs.rmSync(dir, { recursive: true, force: true });
});
