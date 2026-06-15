'use strict';

// @megalint:test-discoverability:opt-out — node:test runner spec (run via `node --test`).
// Unit coverage for the #2989 deterministic auto-remediation engine.
// All GitHub side effects are injected (no live `gh`), so this is a fast,
// hermetic tdd-pyramid spec.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  planFix,
  invertMutation,
  applyFixes,
  rollback,
  stripTitlePrefix,
  SAFE_CLASSES,
} = require('../scripts/global/governance-drift-fix');

const { classifyIssue } = require('../scripts/global/governance-drift-sweep');

const FIXED_CLOCK = class { toISOString() { return '2026-06-14T00:00:00.000Z'; } };

function labelObjs(names) {
  return names.map((name) => ({ name }));
}

test('planFix D4 strips every resolution:* label on an OPEN issue', () => {
  const issue = { number: 1, title: 'Plain title', labels: labelObjs(['resolution:released', 'type:task']) };
  const plan = planFix(issue, ['D4']);
  assert.equal(plan.length, 1);
  assert.deepEqual(
    { action: plan[0].action, label: plan[0].label, after: plan[0].after },
    { action: 'remove-label', label: 'resolution:released', after: null },
  );
});

test('planFix D5 swaps status:backlog -> status:queued', () => {
  const plan = planFix({ number: 2, title: 'x', labels: labelObjs(['status:backlog']) }, ['D5']);
  assert.equal(plan[0].action, 'swap-label');
  assert.equal(plan[0].label_remove, 'status:backlog');
  assert.equal(plan[0].label_add, 'status:queued');
});

test('planFix D8 strips phase-gate:phase-1 from an Epic', () => {
  const plan = planFix({ number: 3, title: 'x', labels: labelObjs(['type:epic', 'phase-gate:phase-1']) }, ['D8']);
  assert.equal(plan[0].action, 'remove-label');
  assert.equal(plan[0].label, 'phase-gate:phase-1');
});

test('planFix D3 strips commit/bracket title prefix and capitalizes', () => {
  assert.equal(stripTitlePrefix('fix: nav contrast'), 'Nav contrast');
  assert.equal(stripTitlePrefix('feat(scope): add thing'), 'Add thing');
  assert.equal(stripTitlePrefix('[Epic] do the work'), 'Do the work');
  const plan = planFix({ number: 4, title: 'fix: nav contrast', labels: [] }, ['D3']);
  assert.equal(plan[0].action, 'set-title');
  assert.equal(plan[0].title_after, 'Nav contrast');
});

test('stripTitlePrefix never yields an empty title', () => {
  assert.equal(stripTitlePrefix('fix:'), 'fix:');
});

test('planFix never auto-fixes propose-only classes D1/D2/D6/D7', () => {
  const issue = { number: 5, title: 'x', labels: labelObjs(['status:in-progress']) };
  for (const cls of ['D1', 'D2', 'D6', 'D7']) {
    assert.deepEqual(planFix(issue, [cls]), []);
  }
  assert.deepEqual([...SAFE_CLASSES].sort(), ['D3', 'D4', 'D5', 'D8']);
});

test('applyFixes dry-run default performs NO mutate and NO log write', () => {
  let mutateCalls = 0;
  let logCalls = 0;
  const issues = [{ number: 6, title: 'fix: thing', labels: labelObjs(['resolution:released']), state: 'open' }];
  const result = applyFixes(issues, {
    classify: classifyIssue,
    mutate: () => { mutateCalls += 1; },
    log: () => { logCalls += 1; },
    clock: FIXED_CLOCK,
  });
  assert.equal(result.applied, false);
  assert.equal(mutateCalls, 0);
  assert.equal(logCalls, 0);
  assert.ok(result.planned >= 1);
  assert.equal(result.mutations[0].mode, 'dry-run');
});

test('applyFixes apply=true calls mutate and writes one log entry per mutation', () => {
  const mutated = [];
  const logged = [];
  const issues = [{ number: 7, title: 'plain', labels: labelObjs(['resolution:released']), state: 'open' }];
  const result = applyFixes(issues, {
    apply: true,
    classify: classifyIssue,
    runId: 'run-A',
    mutate: (mutation) => mutated.push(mutation),
    log: (entry) => logged.push(entry),
    clock: FIXED_CLOCK,
  });
  assert.equal(result.applied, true);
  assert.equal(mutated.length, 1);
  assert.equal(logged.length, 1);
  assert.equal(logged[0].run_id, 'run-A');
  assert.equal(logged[0].mode, 'fix');
  assert.ok('started_at' in logged[0]);
});

test('--classes filter restricts which drift classes are remediated', () => {
  const mutated = [];
  // issue carries BOTH D4 (resolution on open) and D8 (phase-gate on epic)
  const issues = [{ number: 8, title: 'plain', state: 'open', labels: labelObjs(['type:epic', 'resolution:released', 'phase-gate:phase-1']) }];
  applyFixes(issues, {
    apply: true,
    classes: ['D8'],
    classify: classifyIssue,
    mutate: (mutation) => mutated.push(mutation),
    log: () => {},
    clock: FIXED_CLOCK,
  });
  assert.equal(mutated.length, 1);
  assert.equal(mutated[0].class, 'D8');
});

test('invertMutation reverses each safe action', () => {
  assert.deepEqual(invertMutation({ ticket: 1, class: 'D4', action: 'remove-label', label: 'resolution:released' }).action, 'add-label');
  assert.deepEqual(invertMutation({ ticket: 1, class: 'D5', action: 'swap-label', label_remove: 'status:backlog', label_add: 'status:queued' }), {
    ticket: 1, class: 'D5', action: 'swap-label', label_remove: 'status:queued', label_add: 'status:backlog', before: 'status:queued', after: 'status:backlog', reversible: true,
  });
  assert.equal(invertMutation({ ticket: 1, class: 'D3', action: 'set-title', title_before: 'Old', title_after: 'New' }).title_after, 'Old');
});

test('rollback replays inverse mutations newest-first from the log', () => {
  const store = [];
  const log = (entry) => store.push(entry);
  const issues = [{ number: 9, title: 'plain', state: 'open', labels: labelObjs(['resolution:released']) }];
  applyFixes(issues, { apply: true, classify: classifyIssue, runId: 'run-B', mutate: () => {}, log, clock: FIXED_CLOCK });

  const undone = [];
  const result = rollback('run-B', {
    mutate: (mutation) => undone.push(mutation),
    log,
    read: () => store.filter((entry) => entry.mode === 'fix'),
    clock: FIXED_CLOCK,
  });
  assert.equal(result.rolledBack, 1);
  assert.equal(undone[0].action, 'add-label'); // inverse of remove-label
  assert.equal(undone[0].label, 'resolution:released');
});
