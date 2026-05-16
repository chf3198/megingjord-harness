'use strict';

const { test, expect } = require('@playwright/test');
const projects = require('../scripts/global/projects-v2-state.js');

function fakeClient(handler) { return { graphql: handler }; }

const CTX = {
  projectId: 'P_ID', itemId: 'I_ID',
  fields: { claimedBy: 'F_CLAIM', inFlightSince: 'F_FLIGHT', lockedPaths: 'F_LOCK' },
};

test('setField requires projectId, itemId, fieldId', async () => {
  await expect(projects.setField(fakeClient(() => ({})), { itemId: 'i', fieldId: 'f' })).rejects.toThrow();
});

test('setClaim invokes two updateProjectV2ItemFieldValue mutations', async () => {
  let calls = 0;
  await projects.setClaim(fakeClient(() => { calls++; return {}; }), CTX, 'claude-code');
  expect(calls).toBe(2);
});

test('setClaim returns opt-out skip when MEGINGJORD_PROJECTS_V2_DISABLED=1', async () => {
  process.env.MEGINGJORD_PROJECTS_V2_DISABLED = '1';
  const result = await projects.setClaim(fakeClient(() => { throw new Error('should not call'); }), CTX, 'codex');
  delete process.env.MEGINGJORD_PROJECTS_V2_DISABLED;
  expect(result.skipped).toBe('opt-out');
});

test('releaseClaim clears the claimedBy field', async () => {
  let captured = null;
  await projects.releaseClaim(fakeClient((_, vars) => { captured = vars; return {}; }), CTX);
  expect(captured.value).toEqual({ text: '' });
});

test('listInFlight returns nodes array', async () => {
  const client = fakeClient(() => ({ node: { items: { nodes: [{ id: 'A' }, { id: 'B' }] } } }));
  const result = await projects.listInFlight(client, 'P_ID');
  expect(result).toEqual([{ id: 'A' }, { id: 'B' }]);
});

test('listInFlight returns empty when opt-out is set', async () => {
  process.env.MEGINGJORD_PROJECTS_V2_DISABLED = '1';
  const result = await projects.listInFlight(fakeClient(() => { throw new Error('should not call'); }), 'P_ID');
  delete process.env.MEGINGJORD_PROJECTS_V2_DISABLED;
  expect(result).toEqual([]);
});

test('addLockedPath invokes setField with the lockedPaths fieldId', async () => {
  let captured = null;
  await projects.addLockedPath(fakeClient((_, vars) => { captured = vars; return {}; }), CTX, 'dashboard/js/');
  expect(captured.fieldId).toBe('F_LOCK');
  expect(captured.value).toEqual({ text: 'dashboard/js/' });
});

test('disabled() honors MEGINGJORD_PROJECTS_V2_DISABLED env var', () => {
  expect(projects.disabled({ MEGINGJORD_PROJECTS_V2_DISABLED: '1' })).toBe(true);
  expect(projects.disabled({})).toBe(false);
});
