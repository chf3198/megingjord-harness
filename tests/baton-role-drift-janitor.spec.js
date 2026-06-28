'use strict';
// tdd-pyramid for role-drift-janitor.js. Refs #3291, Epic #3284.
// FAKE github client — no real GitHub API calls.
// Live fixtures: closed Epics #3162/#3021/#2891/#2803 carry role:manager.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sweepTerminalRoles,
  findExecutionRoles,
  isTerminalIssue,
  EXECUTION_ROLES,
} = require('../scripts/global/baton-fsm/reconciler/role-drift-janitor');

// --- Fake github client ---
function buildFakeClient() {
  const calls = { removeLabel: [] };
  return {
    client: {
      removeLabel(num, label) { calls.removeLabel.push({ num, label }); },
    },
    calls,
  };
}

// --- Fake incident writer ---
function buildFakeIncidentWriter() {
  const events = [];
  return { writer: { append(evt) { events.push(evt); } }, events };
}

// --- Live fixtures modeling #3162, #3021, #2891, #2803 ---
const ROLE_LEAK_EPICS = [
  { number: 3162, state: 'closed', labels: ['type:epic', 'status:done', 'role:manager'] },
  { number: 3021, state: 'closed', labels: ['type:epic', 'status:done', 'role:manager'] },
  { number: 2891, state: 'closed', labels: ['type:epic', 'status:done', 'role:manager'] },
  { number: 2803, state: 'closed', labels: ['type:epic', 'status:done', 'role:manager'] },
];

// --- Pure helper tests ---

test('findExecutionRoles: extracts role:manager from label set', () => {
  const labels = ['type:epic', 'status:done', 'role:manager', 'area:scripts'];
  assert.deepEqual(findExecutionRoles(labels), ['role:manager']);
});

test('findExecutionRoles: extracts multiple roles', () => {
  const labels = ['role:manager', 'role:collaborator'];
  assert.deepEqual(findExecutionRoles(labels), ['role:manager', 'role:collaborator']);
});

test('findExecutionRoles: returns empty for no execution roles', () => {
  const labels = ['status:done', 'type:task', 'priority:P2'];
  assert.deepEqual(findExecutionRoles(labels), []);
});

test('findExecutionRoles: ignores non-execution role labels', () => {
  const labels = ['role:red-team', 'role:it', 'role:client'];
  assert.deepEqual(findExecutionRoles(labels), []);
});

test('isTerminalIssue: closed is terminal', () => {
  assert.equal(isTerminalIssue({ state: 'closed' }), true);
});

test('isTerminalIssue: CLOSED (uppercase) is terminal', () => {
  assert.equal(isTerminalIssue({ state: 'CLOSED' }), true);
});

test('isTerminalIssue: open is not terminal', () => {
  assert.equal(isTerminalIssue({ state: 'open' }), false);
});

test('EXECUTION_ROLES: contains exactly the 4 execution roles', () => {
  assert.equal(EXECUTION_ROLES.length, 4);
  assert.ok(EXECUTION_ROLES.includes('role:manager'));
  assert.ok(EXECUTION_ROLES.includes('role:collaborator'));
  assert.ok(EXECUTION_ROLES.includes('role:admin'));
  assert.ok(EXECUTION_ROLES.includes('role:consultant'));
});

// --- sweep tests ---

test('sweepTerminalRoles: detects all 4 role-leak epics (dryRun default)', async () => {
  const { client } = buildFakeClient();
  const { writer, events } = buildFakeIncidentWriter();

  const findings = await sweepTerminalRoles(ROLE_LEAK_EPICS, client, writer);

  assert.equal(findings.length, 4);
  const issueNumbers = findings.map((finding) => finding.issue);
  assert.ok(issueNumbers.includes(3162));
  assert.ok(issueNumbers.includes(3021));
  assert.ok(issueNumbers.includes(2891));
  assert.ok(issueNumbers.includes(2803));

  // All should report role:manager
  for (const finding of findings) {
    assert.equal(finding.strippedRole, 'role:manager');
    assert.equal(finding.applied, false); // dryRun default
  }

  // Incidents emitted even in dry-run (for observability)
  assert.equal(events.length, 4);
  for (const evt of events) {
    assert.equal(evt.event, 'role-drift-stripped');
    assert.equal(evt.dry_run, true);
  }
});

test('sweepTerminalRoles: dryRun=false actually strips labels', async () => {
  const { client, calls } = buildFakeClient();
  const { writer, events } = buildFakeIncidentWriter();

  const findings = await sweepTerminalRoles(ROLE_LEAK_EPICS, client, writer, { dryRun: false });

  assert.equal(findings.length, 4);
  for (const finding of findings) {
    assert.equal(finding.applied, true);
  }

  // Verify removeLabel was called for each
  assert.equal(calls.removeLabel.length, 4);
  const removedLabels = calls.removeLabel.map((call) => call.label);
  assert.ok(removedLabels.every((label) => label === 'role:manager'));

  // Incidents emitted with dry_run=false
  for (const evt of events) {
    assert.equal(evt.dry_run, false);
  }
});

test('sweepTerminalRoles: OPEN issues are NOT touched', async () => {
  const { client, calls } = buildFakeClient();
  const { writer, events } = buildFakeIncidentWriter();

  const openIssues = [
    { number: 9999, state: 'open', labels: ['role:manager', 'status:in-progress'] },
    { number: 8888, state: 'open', labels: ['role:collaborator'] },
  ];

  const findings = await sweepTerminalRoles(openIssues, client, writer, { dryRun: false });

  assert.equal(findings.length, 0);
  assert.equal(calls.removeLabel.length, 0);
  assert.equal(events.length, 0);
});

test('sweepTerminalRoles: mixed open+closed — only closed with roles reported', async () => {
  const { client } = buildFakeClient();
  const { writer } = buildFakeIncidentWriter();

  const mixedIssues = [
    { number: 100, state: 'open', labels: ['role:manager'] },
    { number: 200, state: 'closed', labels: ['role:admin'] },
    { number: 300, state: 'closed', labels: ['status:done'] }, // no role
    { number: 400, state: 'closed', labels: ['role:consultant', 'role:collaborator'] },
  ];

  const findings = await sweepTerminalRoles(mixedIssues, client, writer);

  assert.equal(findings.length, 3); // #200 (admin), #400 (consultant + collaborator)
  const issueNumbers = findings.map((finding) => finding.issue);
  assert.ok(!issueNumbers.includes(100)); // open — skipped
  assert.ok(!issueNumbers.includes(300)); // no role — skipped
  assert.ok(issueNumbers.includes(200));
  assert.equal(findings.filter((finding) => finding.issue === 400).length, 2);
});

test('sweepTerminalRoles: empty input returns empty', async () => {
  const { client } = buildFakeClient();
  const { writer } = buildFakeIncidentWriter();

  const findings = await sweepTerminalRoles([], client, writer);
  assert.equal(findings.length, 0);
});

test('sweepTerminalRoles: closed issue without execution role is not reported', async () => {
  const { client } = buildFakeClient();
  const { writer } = buildFakeIncidentWriter();

  const issues = [
    { number: 555, state: 'closed', labels: ['status:done', 'type:task', 'role:red-team'] },
  ];

  const findings = await sweepTerminalRoles(issues, client, writer);
  assert.equal(findings.length, 0);
});
