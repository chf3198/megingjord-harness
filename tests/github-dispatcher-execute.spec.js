'use strict';

const { test, expect } = require('@playwright/test');
const {
  cliArgs, buildCliArgs, executeViaCli, executeViaMcp, execute,
} = require('../scripts/global/github-dispatcher.js');

test('cliArgs maps create-issue to issue create', () => {
  expect(cliArgs('create-issue')).toEqual(['issue', 'create']);
});

test('cliArgs returns null for unknown operation', () => {
  expect(cliArgs('not-an-op')).toBe(null);
});

test('cliArgs maps get-pull-request to pr view', () => {
  expect(cliArgs('get-pull-request')).toEqual(['pr', 'view']);
});

test('buildCliArgs appends --title and --body', () => {
  const args = buildCliArgs('create-issue', { title: 'T', body: 'B' });
  expect(args).toEqual(['issue', 'create', '--title', 'T', '--body', 'B']);
});

test('buildCliArgs appends positional issue number for add-comment', () => {
  const args = buildCliArgs('add-comment', { issue: 1234, body: 'hello' });
  expect(args).toEqual(['issue', 'comment', '1234', '--body', 'hello']);
});

test('buildCliArgs returns null for unknown operation', () => {
  expect(buildCliArgs('not-an-op', {})).toBe(null);
});

test('buildCliArgs appends repeated labels for create-issue', () => {
  const args = buildCliArgs('create-issue', { labels: ['one', 'two'] });
  expect(args).toEqual(['issue', 'create', '--label', 'one', '--label', 'two']);
});

test('executeViaCli returns ok=true when runner succeeds', async () => {
  let captured = null;
  const fakeRunner = async (cmd, args) => { captured = { cmd, args }; return { stdout: 'OUT', stderr: '' }; };
  const result = await executeViaCli('create-issue', { title: 'T', body: 'B' }, fakeRunner);
  expect(result.ok).toBe(true);
  expect(result.provider).toBe('gh-cli');
  expect(result.stdout).toBe('OUT');
  expect(captured.cmd).toBe('gh');
  expect(captured.args).toEqual(['issue', 'create', '--title', 'T', '--body', 'B']);
});

test('executeViaCli returns ok=false when runner throws', async () => {
  const fakeRunner = async () => { throw new Error('gh: command not found'); };
  const result = await executeViaCli('create-issue', { title: 'T' }, fakeRunner);
  expect(result.ok).toBe(false);
  expect(result.error).toContain('gh: command not found');
});

test('executeViaCli rejects unknown operation', async () => {
  const result = await executeViaCli('mystery-op', {}, async () => ({}));
  expect(result.ok).toBe(false);
  expect(result.reason).toContain('unknown-cli-operation');
});

test('executeViaMcp returns mcp-client-required when no client', async () => {
  const result = await executeViaMcp('create-issue', {}, null);
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('mcp-client-required');
});

test('executeViaMcp invokes mcpClient.invoke with the right tool name', async () => {
  let captured = null;
  const fakeClient = { invoke: async (tool, params) => { captured = { tool, params }; return { number: 42 }; } };
  const result = await executeViaMcp('create-issue', { title: 'T' }, fakeClient);
  expect(result.ok).toBe(true);
  expect(captured.tool).toBe('mcp__github__create_issue');
  expect(captured.params).toEqual({ title: 'T' });
  expect(result.result).toEqual({ number: 42 });
});

test('executeViaMcp returns ok=false when mcp client throws', async () => {
  const fakeClient = { invoke: async () => { throw new Error('rate-limited'); } };
  const result = await executeViaMcp('create-issue', {}, fakeClient);
  expect(result.ok).toBe(false);
  expect(result.error).toContain('rate-limited');
});

test('executeViaMcp rejects unknown operation', async () => {
  const fakeClient = { invoke: async () => ({}) };
  const result = await executeViaMcp('mystery-op', {}, fakeClient);
  expect(result.ok).toBe(false);
  expect(result.reason).toContain('unknown-mcp-operation');
});

test('execute routes to CLI when MEGINGJORD_MCP_DISABLED=1', async () => {
  let cliCalled = false;
  const fakeCli = async () => { cliCalled = true; return { stdout: 'OK', stderr: '' }; };
  const result = await execute('create-issue', { title: 'T' }, {
    env: { MEGINGJORD_MCP_DISABLED: '1' },
    cliRunner: fakeCli,
  });
  expect(cliCalled).toBe(true);
  expect(result.provider).toBe('gh-cli');
});

test('execute routes to MCP when MEGINGJORD_MCP_AVAILABLE=1', async () => {
  let mcpCalled = false;
  const fakeMcp = { invoke: async () => { mcpCalled = true; return { number: 7 }; } };
  const result = await execute('create-issue', { title: 'T' }, {
    env: { MEGINGJORD_MCP_AVAILABLE: '1' },
    mcpClient: fakeMcp,
  });
  expect(mcpCalled).toBe(true);
  expect(result.provider).toBe('mcp');
});

test('execute falls back to CLI when MCP fails', async () => {
  const fakeMcp = { invoke: async () => { throw new Error('mcp-down'); } };
  let cliCalled = false;
  const fakeCli = async () => { cliCalled = true; return { stdout: 'OK', stderr: '' }; };
  const result = await execute('create-issue', { title: 'T' }, {
    env: { MEGINGJORD_MCP_AVAILABLE: '1' },
    mcpClient: fakeMcp,
    cliRunner: fakeCli,
  });
  expect(cliCalled).toBe(true);
  expect(result.provider).toBe('gh-cli');
});

test('execute defaults to CLI when no env signals set', async () => {
  let cliCalled = false;
  const fakeCli = async () => { cliCalled = true; return { stdout: '', stderr: '' }; };
  const result = await execute('create-issue', {}, { env: {}, cliRunner: fakeCli });
  expect(cliCalled).toBe(true);
  expect(result.provider).toBe('gh-cli');
});

test('execute with MCP forced but no client returns CLI fallback', async () => {
  let cliCalled = false;
  const fakeCli = async () => { cliCalled = true; return { stdout: '', stderr: '' }; };
  const result = await execute('create-issue', {}, {
    env: { MEGINGJORD_MCP_AVAILABLE: '1' },
    mcpClient: null,
    cliRunner: fakeCli,
  });
  expect(cliCalled).toBe(true);
  expect(result.provider).toBe('gh-cli');
});
