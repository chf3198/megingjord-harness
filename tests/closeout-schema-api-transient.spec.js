const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.resolve(__dirname, '..', '.github', 'workflows', 'closeout-lint.yml');
const RUNBOOK = path.resolve(__dirname, '..', 'docs', 'howto', 'closeout-schema-api-transient.md');

test('closeout-lint workflow includes transient retry and advisory guardrails', () => {
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  expect(workflow).toContain('const isTransientApiError = (err) =>');
  expect(workflow).toContain('const withApiRetry = async (label, fn, retries = 2, backoffMs = 2000) =>');
  expect(workflow).toContain('<!-- closeout-schema-api-transient -->');
  expect(workflow).toContain('closeout-schema: api-transient');
  expect(workflow).toContain('return;');
  expect(workflow).toContain('throw err;');
});

test('closeout transient runbook documents rerun guidance', () => {
  const runbook = fs.readFileSync(RUNBOOK, 'utf8');
  expect(runbook).toContain('gh run rerun --failed <run-id>');
  expect(runbook).toContain('closeout-schema: api-transient');
});
