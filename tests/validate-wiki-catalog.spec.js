'use strict';
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { autoCatalogTicket, parseCloseoutScore } = require('../scripts/wiki/auto-catalog-ticket.js');

let originalExec = cp.execFileSync;
let originalWrite = fs.writeFileSync;
let originalMkdir = fs.mkdirSync;

let mockResponses = {};
let writtenFiles = {};

beforeEach(() => {
  mockResponses = {};
  writtenFiles = {};

  cp.execFileSync = (cmd, args, opts) => {
    if (args.includes('issue') && args.includes('view')) {
      const issueNum = args[args.indexOf('view') + 1];
      if (mockResponses[issueNum]) return mockResponses[issueNum];
    }
    if (args.includes('pr') && args.includes('list')) {
      return JSON.stringify([]);
    }
    return '';
  };

  fs.mkdirSync = () => {};
  fs.writeFileSync = (file, content) => {
    writtenFiles[file] = content;
  };
});

afterEach(() => {
  cp.execFileSync = originalExec;
  fs.writeFileSync = originalWrite;
  fs.mkdirSync = originalMkdir;
});

test('parseCloseoutScore extracts ratings', () => {
  const comments = [
    { body: '## CONSULTANT_CLOSEOUT\nRubric Rating: 9/10\nSigned-by: Soren' }
  ];
  assert.equal(parseCloseoutScore(comments), 9);
});

test('autoCatalogTicket throws if issue is not closed', () => {
  mockResponses['100'] = JSON.stringify({
    state: 'OPEN',
    title: 'Open ticket title',
    comments: [{ body: 'CONSULTANT_CLOSEOUT\nRubric Rating: 9/10' }]
  });
  assert.throws(() => autoCatalogTicket(100), /is not closed/);
});

test('autoCatalogTicket throws if score is below 8', () => {
  mockResponses['200'] = JSON.stringify({
    state: 'CLOSED',
    title: 'Closed ticket title',
    comments: [{ body: 'CONSULTANT_CLOSEOUT\nRubric Rating: 6/10' }]
  });
  assert.throws(() => autoCatalogTicket(200), /below the required threshold/);
});

test('autoCatalogTicket writes article and passes when closed and score >= 8', () => {
  mockResponses['300'] = JSON.stringify({
    state: 'CLOSED',
    title: 'Closed ticket title',
    body: 'Goal definition body',
    comments: [{ body: 'CONSULTANT_CLOSEOUT\nRubric Rating: 9/10' }]
  });

  const file = autoCatalogTicket(300);
  assert.match(file, /issue-300\.md/);
  const written = Object.values(writtenFiles)[0];
  assert.match(written, /title: "Resolved: Issue #300/);
  assert.match(written, /Verified with closeout rubric score: \*\*9\/10\*\*/);
});
