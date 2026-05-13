const { test, expect } = require('@playwright/test');
const EB = require('../dashboard/js/event-bus.js');

test('status-only in-progress hydrates active baton role', () => {
  EB.mergeBatonEvents([{ issue: '2001', type: 'ticket:status', status: 'in-progress', ts: new Date().toISOString() }]);
  const row = EB.getBatonState().find(t => String(t.issue) === '2001');
  expect(row).toBeTruthy();
  expect(row.activeRole).toBe('collaborator');
});

test('role-only event does not create phantom active row from backlog', () => {
  EB.mergeBatonEvents([{ issue: '2002', type: 'ticket:created', ts: new Date().toISOString() }]);
  EB.mergeBatonEvents([{ issue: '2002', type: 'ticket:role', role: 'collaborator', ts: new Date().toISOString() }]);
  const row = EB.getBatonState().find(t => String(t.issue) === '2002');
  expect(row).toBeFalsy();
});

test('done status evicts baton row', () => {
  EB.mergeBatonEvents([{ issue: '2003', type: 'ticket:status', status: 'in-progress', ts: new Date().toISOString() }]);
  EB.mergeBatonEvents([{ issue: '2003', type: 'ticket:status', status: 'done', ts: new Date().toISOString() }]);
  const row = EB.getBatonState().find(t => String(t.issue) === '2003');
  expect(row).toBeFalsy();
});

test('parallel Claude and Copilot active streams both remain visible', () => {
  EB.mergeBatonEvents([
    { issue: '2101', type: 'ticket:status', status: 'in-progress', agent: 'claude-code', ts: new Date().toISOString() },
    { issue: '2102', type: 'ticket:status', status: 'in-progress', agent: 'copilot', ts: new Date().toISOString() }
  ]);
  const state = EB.getBatonState().filter(t => ['2101', '2102'].includes(String(t.issue)));
  expect(state.length).toBe(2);
  expect(state.find(t => String(t.issue) === '2101')?.activeRole).toBe('collaborator');
  expect(state.find(t => String(t.issue) === '2102')?.activeRole).toBe('collaborator');
});

test('delayed role event does not suppress status-hydrated active row', () => {
  EB.mergeBatonEvents([{ issue: '2103', type: 'ticket:status', status: 'review', agent: 'copilot', ts: new Date().toISOString() }]);
  EB.mergeBatonEvents([{ issue: '2103', type: 'ticket:role', role: 'consultant', agent: 'copilot', ts: new Date().toISOString() }]);
  const row = EB.getBatonState().find(t => String(t.issue) === '2103');
  expect(row).toBeTruthy();
  expect(row.activeRole).toBe('consultant');
  expect(row.status).toBe('review');
});

test('closing one parallel stream does not evict the other', () => {
  EB.mergeBatonEvents([{ issue: '2104', type: 'ticket:status', status: 'in-progress', agent: 'claude-code', ts: new Date().toISOString() }]);
  EB.mergeBatonEvents([{ issue: '2105', type: 'ticket:status', status: 'in-progress', agent: 'copilot', ts: new Date().toISOString() }]);
  EB.mergeBatonEvents([{ issue: '2104', type: 'ticket:status', status: 'done', agent: 'claude-code', ts: new Date().toISOString() }]);
  const state = EB.getBatonState().filter(t => ['2104', '2105'].includes(String(t.issue)));
  expect(state.length).toBe(1);
  expect(String(state[0].issue)).toBe('2105');
});
