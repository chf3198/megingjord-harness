'use strict';

const { test, expect } = require('@playwright/test');
const { maybeCreateTicket } = require('../scripts/global/anneal-tier2-autofile');

const candidate = { pattern_id: 'stall-loop', severity: 'high', count: 3, events: [] };
const meta = { dedupe_key: 'anneal:stall-loop:high', proposal_id: 'anneal:stall-loop:high:2026-05-26' };

test('maybeCreateTicket returns DRY-RUN when applyFlag is false', async () => {
  const ref = await maybeCreateTicket(candidate, meta, '2026-05-26T00:00:00Z', false);
  expect(ref).toBe('DRY-RUN');
});

test('maybeCreateTicket uses MCP path when forced', async () => {
  let seenTool = '';
  let seenLabels = [];
  const ref = await maybeCreateTicket(candidate, meta, '2026-05-26T00:00:00Z', true, {
    dedupeLookup: () => '',
    dispatcherOpts: {
      env: { MEGINGJORD_MCP_FORCE_AVAILABLE: '1' },
      mcpClient: {
        invoke: async (tool, params) => {
          seenTool = tool;
          seenLabels = params.labels || [];
          return { issue: { url: 'https://github.com/chf3198/megingjord-harness/issues/9999' } };
        },
      },
    },
  });
  expect(seenTool).toBe('mcp__github__create_issue');
  expect(seenLabels).toEqual(['type:task', 'area:governance', 'status:backlog']);
  expect(ref).toContain('/issues/9999');
});

test('maybeCreateTicket honors MCP-disabled CLI fallback', async () => {
  let cliArgs = [];
  const ref = await maybeCreateTicket(candidate, meta, '2026-05-26T00:00:00Z', true, {
    dedupeLookup: () => '',
    dispatcherOpts: {
      env: { MEGINGJORD_MCP_DISABLED: '1' },
      cliRunner: async (_cmd, args) => {
        cliArgs = args;
        return { stdout: 'https://github.com/chf3198/megingjord-harness/issues/7777\n', stderr: '' };
      },
    },
  });
  expect(cliArgs.slice(0, 2)).toEqual(['issue', 'create']);
  expect(cliArgs.filter((a) => a === '--label').length).toBe(3);
  expect(ref).toContain('/issues/7777');
});

test('maybeCreateTicket short-circuits on dedupe hit', async () => {
  let invoked = false;
  const ref = await maybeCreateTicket(candidate, meta, '2026-05-26T00:00:00Z', true, {
    dedupeLookup: () => 'https://github.com/chf3198/megingjord-harness/issues/1234',
    dispatcherOpts: {
      env: { MEGINGJORD_MCP_DISABLED: '1' },
      cliRunner: async () => {
        invoked = true;
        return { stdout: '', stderr: '' };
      },
    },
  });
  expect(invoked).toBe(false);
  expect(ref).toContain('/issues/1234');
});
