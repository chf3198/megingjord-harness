'use strict';

const { test, expect } = require('@playwright/test');
const { linkedIssues, issueHasCloseout, scanOpenPRs } = require('../scripts/global/open-pr-closeout-scan.js');

test('linkedIssues extracts Refs/Closes/Fixes/Resolves and deferred-final markers', () => {
  const body = 'Refs #100\nCloses #101\nFixes #102\nResolves: #103\nmerge-evidence-deferred-final: #104';
  expect(linkedIssues(body).sort((a, b) => a - b)).toEqual([100, 101, 102, 103, 104]);
});

test('linkedIssues returns empty for a body with no issue link', () => {
  expect(linkedIssues('chore: tidy with no ticket reference')).toEqual([]);
});

test('issueHasCloseout detects CONSULTANT_CLOSEOUT and deferred-final markers', () => {
  expect(issueHasCloseout({ comments: [{ body: '## CONSULTANT_CLOSEOUT\nverdict: approve' }] })).toBe(true);
  expect(issueHasCloseout({ comments: [{ body: 'merge-evidence-deferred-final: #5' }] })).toBe(true);
  expect(issueHasCloseout({ comments: [{ body: 'just a normal comment' }] })).toBe(false);
});

function fakeFetchers(prs, issues) {
  return {
    listOpenPRs: async () => prs,
    getIssue: async (issueNumber) => issues[issueNumber] || { comments: [] },
  };
}

test('scanOpenPRs flags an open PR whose linked issue lacks a closeout', async () => {
  const fetchers = fakeFetchers(
    [{ number: 7, body: 'Refs #200' }],
    { 200: { comments: [{ body: 'work in progress' }] } },
  );
  const findings = await scanOpenPRs(fetchers);
  expect(findings).toEqual([{ pr: 7, issue: 200 }]);
});

test('scanOpenPRs passes when the linked issue carries a closeout', async () => {
  const fetchers = fakeFetchers(
    [{ number: 8, body: 'Closes #201' }],
    { 201: { comments: [{ body: '## CONSULTANT_CLOSEOUT' }] } },
  );
  expect(await scanOpenPRs(fetchers)).toEqual([]);
});

test('scanOpenPRs is a clean pass when there are no open PRs', async () => {
  expect(await scanOpenPRs(fakeFetchers([], {}))).toEqual([]);
});

test('scanOpenPRs reports every offending PR->issue pair', async () => {
  const fetchers = fakeFetchers(
    [{ number: 9, body: 'Refs #300' }, { number: 10, body: 'Refs #301' }],
    { 300: { comments: [] }, 301: { comments: [{ body: '## CONSULTANT_CLOSEOUT' }] } },
  );
  expect(await scanOpenPRs(fetchers)).toEqual([{ pr: 9, issue: 300 }]);
});
