'use strict';

const { test, expect } = require('@playwright/test');
const listener = require('../scripts/global/cross-team-event-listener.js');
const poll = require('../scripts/global/cross-team-poll.js');
const { writeEventToBoard } = require('../scripts/global/event-to-board-writer.js');

function fakeClient(handler) { return { graphql: handler }; }
const CTX = { projectId: 'P', itemId: 'I', fields: { claimedBy: 'F1', inFlightSince: 'F2', lockedPaths: 'F3' } };

test('normalize handles repository_dispatch payloads', () => {
  const event = listener.normalize({ event_type: 'cross-team-claim', client_payload: { issue: { number: 1604 } } });
  expect(event.source).toBe('repository_dispatch');
  expect(event.issueNumber).toBe(1604);
});

test('normalize handles webhook payloads with delivery', () => {
  const event = listener.normalize({ event: 'issues.closed', delivery: 'abc', payload: { issue: { number: 42 } } });
  expect(event.source).toBe('webhook');
  expect(event.eventName).toBe('issues.closed');
});

test('normalize handles workflow_dispatch payloads', () => {
  const event = listener.normalize({ event: 'workflow_dispatch', inputs: { pr: '100' } });
  expect(event.source).toBe('workflow_dispatch');
});

test('isInteresting returns true for governed event names', () => {
  expect(listener.isInteresting({ eventName: 'issues.closed' })).toBe(true);
  expect(listener.isInteresting({ eventName: 'cross-team-claim' })).toBe(true);
  expect(listener.isInteresting({ eventName: 'unrelated' })).toBe(false);
});

test('normalize returns null for non-object input', () => {
  expect(listener.normalize(null)).toBe(null);
  expect(listener.normalize('string')).toBe(null);
});

test('poll intervalSeconds honors MEGINGJORD_POLL_INTERVAL_SECONDS', () => {
  expect(poll.intervalSeconds({ MEGINGJORD_POLL_INTERVAL_SECONDS: '15' })).toBe(15);
  expect(poll.intervalSeconds({})).toBe(60);
});

test('poll intervalSeconds enforces minimum 5s', () => {
  expect(poll.intervalSeconds({ MEGINGJORD_POLL_INTERVAL_SECONDS: '1' })).toBe(5);
});

test('poll backoff doubles on rate-limit signal', () => {
  expect(poll.backoff(60, 'rate-limit')).toBe(120);
});

test('poll backoff caps at 3600s', () => {
  expect(poll.backoff(3000, 'rate-limit')).toBe(3600);
});

test('poll backoff reduces on ok signal', () => {
  expect(poll.backoff(100, 'ok')).toBeLessThan(100);
});

test('pollLoop returns one result per iteration', async () => {
  const results = await poll.pollLoop({}, async () => 'ok', { iterations: 2, sleepFn: async () => {} });
  expect(results).toHaveLength(2);
  expect(results[0].ok).toBe(true);
});

test('pollLoop catches errors and continues', async () => {
  let calls = 0;
  const queryFn = async () => { calls++; if (calls === 1) throw new Error('rate'); return 'ok'; };
  const results = await poll.pollLoop({}, queryFn, { iterations: 2, sleepFn: async () => {} });
  expect(results[0].ok).toBe(false);
  expect(results[1].ok).toBe(true);
});

test('writeEventToBoard returns opt-out skip', async () => {
  process.env.MEGINGJORD_PROJECTS_V2_DISABLED = '1';
  const result = await writeEventToBoard(fakeClient(() => ({})), CTX, { eventName: 'cross-team-claim' });
  delete process.env.MEGINGJORD_PROJECTS_V2_DISABLED;
  expect(result.skipped).toBe('opt-out');
});

test('writeEventToBoard routes cross-team-claim to setClaim', async () => {
  let calls = 0;
  const result = await writeEventToBoard(fakeClient(() => { calls++; return {}; }), CTX, { eventName: 'cross-team-claim', actor: 'claude-code' });
  expect(result.ok).toBe(true);
  expect(calls).toBeGreaterThan(0);
});

test('writeEventToBoard handles unknown events gracefully', async () => {
  const result = await writeEventToBoard(fakeClient(() => ({})), CTX, { eventName: 'unrelated' });
  expect(result.ok).toBe(false);
  expect(result.reason).toContain('unknown-event');
});
