'use strict';
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const cp = require('node:child_process');
const { lintEpicDrift } = require('../scripts/global/lint-epic-drift.js');

let originalExec = cp.execFileSync;
let mockResponses = {};

beforeEach(() => {
  mockResponses = {};
  cp.execFileSync = (cmd, args) => {
    const isGraphql = args.includes('graphql');
    const isIssueList = args.includes('list');

    if (isGraphql && mockResponses.graphql !== undefined) {
      return mockResponses.graphql;
    }
    if (isIssueList && mockResponses.issueList !== undefined) {
      return mockResponses.issueList;
    }

    if (isGraphql) {
      return JSON.stringify({ data: { repository: { issues: { nodes: [] } } } });
    }
    if (isIssueList) {
      return JSON.stringify([]);
    }
    return '';
  };
});

afterEach(() => {
  cp.execFileSync = originalExec;
});

test('lintEpicDrift passes when no Epics exist', () => {
  mockResponses.graphql = JSON.stringify({
    data: { repository: { issues: { nodes: [] } } }
  });

  const findings = lintEpicDrift('chf3198', 'megingjord-harness');
  assert.equal(findings.length, 0);
});

test('lintEpicDrift catches Class A Status Sync Drift', () => {
  mockResponses.graphql = JSON.stringify({
    data: {
      repository: {
        issues: {
          nodes: [{
            number: 1000,
            title: 'Drift Epic',
            labels: { nodes: [{ name: 'type:epic' }, { name: 'status:backlog' }] },
            subIssues: { nodes: [{ number: 1001, state: 'CLOSED', body: '' }] },
            comments: { nodes: [{ body: '## Epic Progress Update for #1001' }] }
          }]
        }
      }
    }
  });

  const findings = lintEpicDrift('chf3198', 'megingjord-harness');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'A');
  assert.match(findings[0].message, /all children are CLOSED/);
});

test('lintEpicDrift catches Class B Prose-Only Linkage Drift', () => {
  mockResponses.graphql = JSON.stringify({
    data: {
      repository: {
        issues: {
          nodes: [{
            number: 1000,
            title: 'Drift Epic',
            labels: { nodes: [{ name: 'type:epic' }, { name: 'status:in-progress' }] },
            subIssues: { nodes: [] },
            comments: { nodes: [] }
          }]
        }
      }
    }
  });

  mockResponses.issueList = JSON.stringify([
    { number: 1005, body: 'Parent Epic: #1000' }
  ]);

  const findings = lintEpicDrift('chf3198', 'megingjord-harness');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'B');
  assert.match(findings[0].message, /references Parent Epic #1000.*but is not natively linked/);
});

test('lintEpicDrift catches Class C Progress Logging Drift', () => {
  mockResponses.graphql = JSON.stringify({
    data: {
      repository: {
        issues: {
          nodes: [{
            number: 1000,
            title: 'Drift Epic',
            labels: { nodes: [{ name: 'type:epic' }, { name: 'status:review' }] },
            subIssues: { nodes: [{ number: 1001, state: 'CLOSED', body: '' }] },
            comments: { nodes: [{ body: 'Stale comments with no update header' }] }
          }]
        }
      }
    }
  });

  const findings = lintEpicDrift('chf3198', 'megingjord-harness');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].class, 'C');
  assert.match(findings[0].message, /missing progress update/);
});
