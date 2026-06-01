'use strict';
// @megalint:test-discoverability:opt-out — node:test CLI spec; registered via
// `npm run test:collaborator-input-shape`.
// #2562 — collaborator-gate input-shape regression: findCollaboratorHandoff/validate
// must accept BOTH {body,user} objects AND bare string comment elements, so a caller
// passing comment bodies (baton-gates.yml line 52) cannot false-fail the gate.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ch = require(path.join(__dirname, '..', 'scripts', 'global', 'megalint', 'collaborator-handoff.js'));

const HANDOFF = '## COLLABORATOR_HANDOFF\nticket: #2562\nSigned-by: X\nTeam&Model: t:m@s\nRole: collaborator';

test('#2562: finds handoff in OBJECT-shaped comments', () => {
  const found = ch.findCollaboratorHandoff([{ body: 'noise' }, { body: HANDOFF, user: { login: 'a' } }]);
  assert.ok(found && found.body === HANDOFF);
});

test('#2562: finds handoff in STRING-shaped comments (the regression)', () => {
  assert.strictEqual(ch.findCollaboratorHandoff(['noise', HANDOFF]), HANDOFF);
});

test('#2562: malformed elements (null/number/missing-body) do not throw', () => {
  assert.doesNotThrow(() => ch.findCollaboratorHandoff([null, 42, {}, { body: undefined }]));
  assert.strictEqual(ch.findCollaboratorHandoff([null, 42, {}]), undefined);
});

test('#2562: validate finds handoff (no missing-collaborator-handoff) under STRING shape', () => {
  const r = ch.validate({ comments: ['noise', HANDOFF], labels: ['lane:code-change'], lane: 'lane:code-change' });
  const rules = (r.violations || []).map((v) => v.rule);
  assert.ok(!rules.includes('missing-collaborator-handoff'), `unexpected missing-handoff: ${rules}`);
  assert.strictEqual(r.found, true);
});

test('#2562: validate finds handoff under OBJECT shape', () => {
  const r = ch.validate({ comments: [{ body: HANDOFF, user: { login: 'a' } }], labels: ['lane:code-change'], lane: 'lane:code-change' });
  assert.strictEqual(r.found, true);
});
