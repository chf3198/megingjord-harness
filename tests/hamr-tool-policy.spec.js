// #3013 — hamr tool policy + proxy tests (Epic #3008 Phase B).
'use strict';
const { test, expect } = require('@playwright/test');
const policy = require('../scripts/global/hamr-tool-policy');
const proxy = require('../scripts/global/hamr-tool-proxy');
const audit = require('../scripts/global/hamr-tool-audit');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('default-deny unknown tool', () => {
  const v = policy.evaluateToolPolicy('evil_tool', {}, { role: 'collaborator' });
  expect(v.allowed).toBe(false);
});

test('collaborator may wiki_search', () => {
  const v = policy.evaluateToolPolicy('wiki_search', { query: 'baton' }, { role: 'collaborator' });
  expect(v.allowed).toBe(true);
});

test('manager denied github_self_comment', () => {
  const v = policy.evaluateToolPolicy('github_self_comment', { issue: 1, body: 'note' }, { role: 'manager' });
  expect(v.allowed).toBe(false);
});

test('workflow compliance rate >= 0.99 for collaborator', () => {
  const rows = proxy.topWorkflowCompliance().filter((r) => r.role === 'collaborator');
  expect(rows[0].rate).toBeGreaterThanOrEqual(0.99);
});

test('proxyToolCall audits denied execution', async () => {
  const log = path.join(os.tmpdir(), `hamr-audit-${process.pid}.jsonl`);
  const out = await proxy.proxyToolCall('unknown', {}, { role: 'collaborator' }, { logPath: log });
  expect(out.ok).toBe(false);
  expect(fs.readFileSync(log, 'utf8')).toContain('unknown');
});
