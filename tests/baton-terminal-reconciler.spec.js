'use strict';
// tdd-pyramid for terminal-reconciler.js. Refs #3291, Epic #3284.
// FAKE github client — no real GitHub API calls.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reconcileClose,
  deriveDecision,
  hasCloseoutArtifact,
  hasDispositionLabel,
} = require('../scripts/global/baton-fsm/reconciler/terminal-reconciler');

// --- Fake github client builder ---
function buildFakeClient(commentBodies) {
  const calls = { reopen: [], addLabel: [], comment: [] };
  return {
    client: {
      getIssue(num) { return { number: num, state: 'closed', labels: [] }; },
      listComments() { return commentBodies.map((body) => ({ body })); },
      reopenIssue(num) { calls.reopen.push(num); },
      addLabel(num, label) { calls.addLabel.push({ num, label }); },
      removeLabel() {},
      comment(num, body) { calls.comment.push({ num, body }); },
    },
    calls,
  };
}

// --- Fake incident writer ---
function buildFakeIncidentWriter() {
  const events = [];
  return { writer: { append(evt) { events.push(evt); } }, events };
}

// --- Pure helper tests ---

test('hasCloseoutArtifact: recognizes CONSULTANT_CLOSEOUT', () => {
  const comments = [{ body: '## CONSULTANT_CLOSEOUT\nverdict: approve_for_merge' }];
  assert.equal(hasCloseoutArtifact(comments), true);
});

test('hasCloseoutArtifact: recognizes CONSULTANT_EPIC_CLOSEOUT', () => {
  const comments = [{ body: '## CONSULTANT_EPIC_CLOSEOUT\nAll children terminal.' }];
  assert.equal(hasCloseoutArtifact(comments), true);
});

test('hasCloseoutArtifact: recognizes CANCELLATION', () => {
  const comments = [{ body: 'CANCELLATION: goal invalidated by upstream change' }];
  assert.equal(hasCloseoutArtifact(comments), true);
});

test('hasCloseoutArtifact: recognizes batch evidence', () => {
  const comments = [{ body: 'resolved as part of batch with #1234' }];
  assert.equal(hasCloseoutArtifact(comments), true);
});

test('hasCloseoutArtifact: returns false for empty comments', () => {
  assert.equal(hasCloseoutArtifact([]), false);
});

test('hasCloseoutArtifact: returns false for unrelated comments', () => {
  const comments = [{ body: 'This is a progress update.' }, { body: 'LGTM' }];
  assert.equal(hasCloseoutArtifact(comments), false);
});

test('hasDispositionLabel: recognizes resolution:released', () => {
  assert.equal(hasDispositionLabel(['resolution:released', 'status:done']), true);
});

test('hasDispositionLabel: recognizes resolution:duplicate', () => {
  assert.equal(hasDispositionLabel(['resolution:duplicate']), true);
});

test('hasDispositionLabel: recognizes governance:close-without-merge', () => {
  assert.equal(hasDispositionLabel(['governance:close-without-merge']), true);
});

test('hasDispositionLabel: returns false for no disposition', () => {
  assert.equal(hasDispositionLabel(['status:done', 'type:task']), false);
});

// --- deriveDecision pure tests ---

test('deriveDecision: ACCEPT when CONSULTANT_CLOSEOUT present', () => {
  const issue = { number: 100, labels: [] };
  const comments = [{ body: '## CONSULTANT_CLOSEOUT\nverdict: approve_for_merge' }];
  const result = deriveDecision(issue, comments);
  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.reason, 'closeout-artifact-present');
});

test('deriveDecision: ACCEPT when disposition label present (no closeout)', () => {
  const issue = { number: 200, labels: ['resolution:duplicate'] };
  const comments = [{ body: 'Duplicate of #50' }];
  const result = deriveDecision(issue, comments);
  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.reason, 'disposition-label-present');
});

test('deriveDecision: REVERT when no closeout and no disposition', () => {
  const issue = { number: 300, labels: ['status:done'] };
  const comments = [{ body: 'Closed without evidence.' }];
  const result = deriveDecision(issue, comments);
  assert.equal(result.decision, 'REVERT');
  assert.equal(result.reason, 'incomplete-trail-no-disposition');
});

// --- #1673 force-close anti-pattern simulation ---

test('reconcileClose: #1673-style force-close -> REVERT (reopen+label+incident+ping)', async () => {
  // Simulate: issue #1673 closed without any closeout/cancellation/disposition
  const { client, calls } = buildFakeClient([
    'Manager scoped this ticket.',
    'Implementation done, pushing now.',
    // No CONSULTANT_CLOSEOUT, no CANCELLATION, no batch evidence
  ]);
  const { writer, events } = buildFakeIncidentWriter();
  const issue = { number: 1673, title: 'Force-closed ticket', state: 'closed', labels: ['status:done'] };

  const result = await reconcileClose(issue, client, writer);

  assert.equal(result.decision, 'REVERT');
  assert.equal(result.reason, 'incomplete-trail-no-disposition');
  assert.equal(result.applied, true);
  assert.equal(result.issue, 1673);

  // Verify reopen was called
  assert.equal(calls.reopen.length, 1);
  assert.equal(calls.reopen[0], 1673);

  // Verify governance:close-reverted label added
  assert.equal(calls.addLabel.length, 1);
  assert.equal(calls.addLabel[0].label, 'governance:close-reverted');

  // Verify owner-ping comment posted
  assert.equal(calls.comment.length, 1);
  assert.ok(calls.comment[0].body.includes('governance:close-reverted'));

  // Verify incident emitted
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'terminal-reconciler-revert');
  assert.equal(events[0].pattern_id, 'force-close-without-closeout');
  assert.equal(events[0].issue, 1673);
  assert.equal(events[0].version, 3);
});

test('reconcileClose: properly closed issue -> ACCEPT (no-op)', async () => {
  const { client, calls } = buildFakeClient([
    '## MANAGER_HANDOFF\nscope: something',
    '## COLLABORATOR_HANDOFF\nall ACs pass',
    '## ADMIN_HANDOFF\nbranch: feat/100-foo',
    '## CONSULTANT_CLOSEOUT\nverdict: approve_for_merge\nrubric_rating: 9/10',
  ]);
  const { writer, events } = buildFakeIncidentWriter();
  const issue = { number: 100, title: 'Properly closed', state: 'closed', labels: ['status:done'] };

  const result = await reconcileClose(issue, client, writer);

  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.applied, false);
  assert.equal(calls.reopen.length, 0);
  assert.equal(calls.addLabel.length, 0);
  assert.equal(calls.comment.length, 0);
  assert.equal(events.length, 0);
});

test('reconcileClose: dispositioned close (resolution:duplicate) -> ACCEPT', async () => {
  const { client, calls } = buildFakeClient(['Duplicate of #50.']);
  const { writer, events } = buildFakeIncidentWriter();
  const issue = {
    number: 250,
    title: 'Dup ticket',
    state: 'closed',
    labels: ['resolution:duplicate'],
  };

  const result = await reconcileClose(issue, client, writer);

  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.applied, false);
  assert.equal(calls.reopen.length, 0);
  assert.equal(events.length, 0);
});

test('reconcileClose: cancelled with CANCELLATION comment -> ACCEPT', async () => {
  const { client, calls } = buildFakeClient(['CANCELLATION: scope invalidated by Epic rescope']);
  const { writer, events } = buildFakeIncidentWriter();
  const issue = {
    number: 500,
    title: 'Cancelled ticket',
    state: 'closed',
    labels: ['status:cancelled'],
  };

  const result = await reconcileClose(issue, client, writer);

  assert.equal(result.decision, 'ACCEPT');
  assert.equal(result.applied, false);
  assert.equal(events.length, 0);
});

test('reconcileClose: batch sibling with batch evidence -> ACCEPT', async () => {
  const { client } = buildFakeClient([
    '## CONSULTANT_CLOSEOUT\nticket: #600 (resolved as part of batch with #599)\nverdict: approve_for_merge',
  ]);
  const { writer } = buildFakeIncidentWriter();
  const issue = { number: 600, title: 'Batch sibling', state: 'closed', labels: ['status:done'] };

  const result = await reconcileClose(issue, client, writer);
  assert.equal(result.decision, 'ACCEPT');
});

test('reconcileClose: #1676-style force-close (another anti-pattern) -> REVERT', async () => {
  // Like #1673 but different issue number — same anti-pattern class
  const { client, calls } = buildFakeClient(['WIP - closing to clean board']);
  const { writer, events } = buildFakeIncidentWriter();
  const issue = { number: 1676, title: 'Board cleanup close', state: 'closed', labels: [] };

  const result = await reconcileClose(issue, client, writer);

  assert.equal(result.decision, 'REVERT');
  assert.equal(result.applied, true);
  assert.equal(calls.reopen.length, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].pattern_id, 'force-close-without-closeout');
});
