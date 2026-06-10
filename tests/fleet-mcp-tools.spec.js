// Refs #2847 P1-0 child of #2802 — governed MCP tool catalog + OA2 gate + token-brokering broker.
// Network-free: gh exec / wiki are injected; repo_map exercises the real (file-only) primitive.
const { test, expect } = require('@playwright/test');
const {
  authorizeToolCall, fleetToolCatalog,
} = require('../scripts/global/fleet-mcp-tools.js');
const { invokeTool, FLEET_COMMENT_HEADER } = require('../scripts/global/fleet-mcp-broker.js');

test('#2847 AC1 catalog advertises the 4 governed tools with their permission classes', () => {
  const catalog = fleetToolCatalog();
  expect(catalog).toEqual([
    { name: 'github_read', perm: 'read' },
    { name: 'wiki_search', perm: 'read' },
    { name: 'repo_map', perm: 'read' },
    { name: 'github_self_comment', perm: 'self-comment-write' },
  ]);
});

test('#2847 AC2 authorize allows a valid read and default-denies unknown tools', () => {
  expect(authorizeToolCall('github_read', { kind: 'issue', number: 2847 }).allowed).toBe(true);
  expect(authorizeToolCall('repo_map', { paths: ['a.js'] }).allowed).toBe(true);
  const denied = authorizeToolCall('github_label', { issue: 1, label: 'x' });
  expect(denied.allowed).toBe(false);
  expect(denied.reason).toMatch(/unknown tool/);
});

test('#2847 AC2 authorize denies malformed read args', () => {
  expect(authorizeToolCall('github_read', { kind: 'bogus' }).allowed).toBe(false);
  expect(authorizeToolCall('github_read', { kind: 'issue' }).allowed).toBe(false); // missing number
  expect(authorizeToolCall('wiki_search', { query: '  ' }).allowed).toBe(false);
  expect(authorizeToolCall('repo_map', { paths: 'a.js' }).allowed).toBe(false); // not an array
});

test('#2847 AC3 self-comment refuses empty + baton-artifact impersonation, allows analysis', () => {
  expect(authorizeToolCall('github_self_comment', { issue: 1, body: '' }).allowed).toBe(false);
  for (const body of ['## CONSULTANT_CLOSEOUT\nverdict: approve', 'MANAGER_HANDOFF here',
    'Signed-by: Orla Vale', 'Team&Model: x:y@z']) {
    const verdict = authorizeToolCall('github_self_comment', { issue: 1, body });
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/impersonate/);
  }
  expect(authorizeToolCall('github_self_comment', { issue: 1, body: 'My analysis: looks correct.' }).allowed).toBe(true);
});

test('#2847 AC2 broker authorizes first: a denied call never reaches a handler', () => {
  let execCalls = 0;
  const out = invokeTool('github_merge', { pr: 1 }, { exec: () => { execCalls += 1; return ''; } });
  expect(out.ok).toBe(false);
  expect(execCalls).toBe(0);
});

test('#2847 AC4 github_read brokers via injected exec; the token never appears in the result', () => {
  const seen = {};
  const fakeExec = (cmd, args) => { seen.cmd = cmd; seen.args = args; return JSON.stringify({ title: 'T', state: 'OPEN' }); };
  const out = invokeTool('github_read', { kind: 'issue', number: 42 }, { exec: fakeExec });
  expect(out.ok).toBe(true);
  expect(out.result.title).toBe('T');
  expect(seen.cmd).toBe('gh'); // brokered through gh (token in gh keyring, not in args)
  expect(JSON.stringify(out)).not.toContain('SECRET'); // no credential material in the result
  expect(seen.args.join(' ')).not.toMatch(/token|SECRET/i);
});

test('#2847 AC4 self-comment stamps the provenance header via injected exec', () => {
  let body = null;
  const fakeExec = (cmd, args) => { body = args[args.indexOf('--body') + 1]; return ''; };
  const out = invokeTool('github_self_comment', { issue: 7, body: 'My finding.' }, { exec: fakeExec });
  expect(out.ok).toBe(true);
  expect(out.result).toEqual({ posted: true, issue: 7 });
  expect(body.startsWith(FLEET_COMMENT_HEADER)).toBe(true);
  expect(body).toContain('My finding.');
});

test('#2847 AC5 repo_map reuses the shipped fleet-context-bundle primitive (real, file-only)', () => {
  const out = invokeTool('repo_map', { paths: ['scripts/global/fleet-mcp-tools.js'] },
    { root: process.cwd() });
  expect(out.ok).toBe(true);
  expect(out.result[0].available).toBe(true);
  expect(out.result[0].symbols.join('\n')).toMatch(/authorizeToolCall/);
});
