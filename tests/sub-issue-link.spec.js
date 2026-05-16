'use strict';

const { test, expect } = require('@playwright/test');
const link = require('../scripts/global/sub-issue-link.js');
const { extractRefsEpic, plan } = require('../scripts/global/sub-issue-migrate.js');

function fakeClient(handler) { return { graphql: handler }; }

test('addSubIssue requires both parent and child node IDs', async () => {
  await expect(link.addSubIssue(fakeClient(() => ({})), null, 'child')).rejects.toThrow();
  await expect(link.addSubIssue(fakeClient(() => ({})), 'parent', null)).rejects.toThrow();
});

test('addSubIssue invokes the addSubIssue mutation with both IDs', async () => {
  let captured = null;
  const client = fakeClient((query, vars) => { captured = { query, vars }; return { subIssue: { number: 5 } }; });
  await link.addSubIssue(client, 'P_ID', 'C_ID');
  expect(captured.query).toContain('addSubIssue');
  expect(captured.vars).toEqual({ issueId: 'P_ID', subId: 'C_ID' });
});

test('removeSubIssue invokes the removeSubIssue mutation', async () => {
  let captured = null;
  const client = fakeClient((query) => { captured = query; return {}; });
  await link.removeSubIssue(client, 'P_ID', 'C_ID');
  expect(captured).toContain('removeSubIssue');
});

test('listSubIssues returns nodes array', async () => {
  const client = fakeClient(() => ({
    repository: { issue: { subIssues: { nodes: [{ number: 5 }, { number: 7 }] } } },
  }));
  const result = await link.listSubIssues(client, 'chf3198', 'megingjord-harness', 1604);
  expect(result).toEqual([{ number: 5 }, { number: 7 }]);
});

test('listSubIssues returns empty array when no sub-issues exist', async () => {
  const client = fakeClient(() => ({ repository: { issue: { subIssues: { nodes: [] } } } }));
  expect(await link.listSubIssues(client, 'chf3198', 'repo', 1)).toEqual([]);
});

test('extractRefsEpic extracts the epic number from prose Refs Epic #N', () => {
  expect(extractRefsEpic('Body text\nRefs Epic #1604\nMore body')).toBe(1604);
  expect(extractRefsEpic('No epic reference here')).toBe(null);
});

test('plan returns proposals for closed children with Refs Epic prose', () => {
  const children = [
    { number: 100, id: 'C100', body: 'Refs Epic #1604' },
    { number: 101, id: 'C101', body: 'No reference' },
    { number: 102, id: 'C102', body: 'Refs Epic #2000' },
  ];
  const proposals = plan(children);
  expect(proposals).toHaveLength(2);
  expect(proposals[0]).toMatchObject({ parent: 1604, child: 100 });
  expect(proposals[1]).toMatchObject({ parent: 2000, child: 102 });
});

test('plan returns empty list for empty input', () => {
  expect(plan([])).toEqual([]);
  expect(plan(null)).toEqual([]);
});
