'use strict';

const { test, expect } = require('@playwright/test');
const { renderProjectsV2Panel, loadAndRender } = require('../dashboard/js/projects-v2-panel.js');
const baton = require('../scripts/global/baton-projects-integration.js');

function fakeEl() {
  return { innerHTML: '', _set(v) { this.innerHTML = v; } };
}
function fakeClient(handler) { return { graphql: handler }; }
const CTX = { projectId: 'P', itemId: 'I', fields: { claimedBy: 'F1', inFlightSince: 'F2', lockedPaths: 'F3' } };

test('renderProjectsV2Panel shows empty state when no items', () => {
  const el = fakeEl();
  renderProjectsV2Panel(el, []);
  expect(el.innerHTML).toContain('No cross-team items');
});

test('renderProjectsV2Panel renders a table row per item', () => {
  const el = fakeEl();
  renderProjectsV2Panel(el, [
    { content: { number: 1604, title: 'Cross-team Epic' }, claimedBy: 'claude-code', crossTeamStage: 'in-progress' },
  ]);
  expect(el.innerHTML).toContain('#1604');
  expect(el.innerHTML).toContain('claude-code');
});

test('loadAndRender handles fetch failure gracefully', async () => {
  const el = fakeEl();
  const fakeFetch = async () => ({ ok: false });
  await loadAndRender(el, fakeFetch);
  expect(el.innerHTML).toContain('unavailable');
});

test('loadAndRender renders data from the API', async () => {
  const el = fakeEl();
  const fakeFetch = async () => ({ ok: true, json: async () => ({ items: [{ content: { number: 1, title: 'X' } }] }) });
  await loadAndRender(el, fakeFetch);
  expect(el.innerHTML).toContain('#1');
});

test('baton integration onManagerHandoff returns skipped when opt-out', async () => {
  process.env.MEGINGJORD_PROJECTS_V2_DISABLED = '1';
  const result = await baton.onManagerHandoff(fakeClient(() => ({})), CTX, 'claude-code');
  delete process.env.MEGINGJORD_PROJECTS_V2_DISABLED;
  expect(result.skipped).toBe('opt-out');
});

test('baton integration onManagerHandoff fires when enabled', async () => {
  let calls = 0;
  const result = await baton.onManagerHandoff(fakeClient(() => { calls++; return {}; }), CTX, 'claude-code');
  expect(calls).toBeGreaterThan(0);
  expect(result.ok).toBe(true);
});

test('baton integration degrades on GraphQL error', async () => {
  const result = await baton.onManagerHandoff(fakeClient(() => { throw new Error('graphql 500'); }), CTX, 'claude-code');
  expect(result.degraded).toBe(true);
});

test('baton integration onConsultantCloseout releases the claim', async () => {
  let captured = null;
  const result = await baton.onConsultantCloseout(fakeClient((_, vars) => { captured = vars; return {}; }), CTX);
  expect(result.ok).toBe(true);
  expect(captured.value).toEqual({ text: '' });
});
