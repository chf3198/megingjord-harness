// Behavioral coverage for the #1596 try/catch+setFailed pattern in
// .github/workflows/label-lint.yml auto-transition path (#2088).
//
// Existing specs verify the try/catch is STRUCTURALLY present. This spec
// verifies it BEHAVIORALLY: when removeLabel or addLabels throws,
// core.setFailed actually fires with the expected message (containing the
// #1596 reference and the original error). A regression to a silent catch
// body would fail this spec.
//
// Approach (Option B per #2088 user-authorized 2026-05-24):
//   1. Read the workflow YAML and assert the literal setFailed call texts
//      exist (couples the behavioral test to the actual workflow text).
//   2. Execute a faithful replica of the try/catch chain in a Node vm
//      sandbox with mocked github + core, stubbing the mutations to throw,
//      asserting setFailed was invoked with the expected message structure.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WORKFLOW = fs.readFileSync(
  path.resolve(__dirname, '..', '.github', 'workflows', 'label-lint.yml'),
  'utf8',
);

test('#2088 AC: workflow contains setFailed inside removeLabel catch', () => {
  expect(WORKFLOW).toMatch(/catch \(e\)[\s\S]{0,200}setFailed\(`label-lint auto-transition failed on removeLabel/);
  expect(WORKFLOW).toContain('(#1596)');
});

test('#2088 AC: workflow contains setFailed inside addLabels catch', () => {
  expect(WORKFLOW).toMatch(/catch \(e\)[\s\S]{0,200}setFailed\(`label-lint auto-transition failed on addLabels/);
});

const REPLICA = `
(async function(github, core, issueNum, decision, owner, repo, labels) {
  if (decision.action === 'auto-transition') {
    for (const name of decision.removeLabels) {
      if (labels.includes(name)) {
        try {
          await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNum, name });
        } catch (e) {
          console.log(\`#\${issueNum}: removeLabel(\${name}) failed: \${e.status} \${e.message} (#1596)\`);
          core.setFailed(\`label-lint auto-transition failed on removeLabel(\${name}): \${e.message}\`);
        }
      }
    }
    try {
      await github.rest.issues.addLabels({ owner, repo, issue_number: issueNum, labels: decision.addLabels });
    } catch (e) {
      console.log(\`#\${issueNum}: addLabels(\${decision.addLabels}) failed: \${e.status} \${e.message} (#1596)\`);
      core.setFailed(\`label-lint auto-transition failed on addLabels: \${e.message}\`);
    }
  }
})
`;

function runReplica(opts) {
  const setFailedCalls = [];
  const core = { setFailed: (msg) => setFailedCalls.push(msg) };
  const ctx = vm.createContext({ console: { log: () => {} } });
  const fn = vm.runInContext(REPLICA, ctx);
  return {
    setFailedCalls,
    run: () => fn(opts.github, core, 42, opts.decision, 'o', 'r', opts.labels || ['status:in-progress']),
  };
}

test('#2088 AC1 behavioral: removeLabel throw → setFailed invoked', async () => {
  const harness = runReplica({
    github: { rest: { issues: {
      removeLabel: async () => { const e = new Error('boom'); e.status = 500; throw e; },
      addLabels: async () => {},
    } } },
    decision: { action: 'auto-transition', removeLabels: ['status:in-progress'], addLabels: ['status:done'] },
  });
  await harness.run();
  expect(harness.setFailedCalls.length).toBeGreaterThanOrEqual(1);
  expect(harness.setFailedCalls[0]).toMatch(/label-lint auto-transition failed on removeLabel\(status:in-progress\): boom/);
});

test('#2088 AC2 behavioral: addLabels throw → setFailed invoked', async () => {
  const harness = runReplica({
    github: { rest: { issues: {
      removeLabel: async () => {},
      addLabels: async () => { const e = new Error('rate-limit'); e.status = 429; throw e; },
    } } },
    decision: { action: 'auto-transition', removeLabels: ['status:in-progress'], addLabels: ['status:done'] },
  });
  await harness.run();
  expect(harness.setFailedCalls.length).toBe(1);
  expect(harness.setFailedCalls[0]).toMatch(/label-lint auto-transition failed on addLabels: rate-limit/);
});

test('#2088 negative: both mutations succeed → setFailed NOT invoked', async () => {
  const harness = runReplica({
    github: { rest: { issues: { removeLabel: async () => {}, addLabels: async () => {} } } },
    decision: { action: 'auto-transition', removeLabels: ['status:in-progress'], addLabels: ['status:done'] },
  });
  await harness.run();
  expect(harness.setFailedCalls).toEqual([]);
});

test('#2088 negative: decision.action !== auto-transition → catch chain not executed', async () => {
  const harness = runReplica({
    github: { rest: { issues: {
      removeLabel: async () => { throw new Error('would-fire-if-called'); },
      addLabels: async () => {},
    } } },
    decision: { action: 'reopen', removeLabels: ['status:in-progress'], addLabels: ['status:done'] },
  });
  await harness.run();
  expect(harness.setFailedCalls).toEqual([]);
});
