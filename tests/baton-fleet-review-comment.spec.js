// Refs #2179 - tests for fleet-review comment formatter
const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRedTeamComment, classifyFinding, renderFindingsTable } = require('../scripts/global/baton-fleet-review-comment.js');

test('classifyFinding: ACCEPT verdict extracted', () => {
  const r = classifyFinding('ACCEPT: real defect');
  assert.equal(r.verdict, 'ACCEPT');
  assert.equal(r.text, 'real defect');
});

test('classifyFinding: handles markdown-bold formatting', () => {
  const r = classifyFinding('**REJECT**: hallucination');
  assert.equal(r.verdict, 'REJECT');
  assert.equal(r.text, 'hallucination');
});

test('classifyFinding: returns UNCLASSIFIED for non-matching text', () => {
  const r = classifyFinding('random unstructured prose');
  assert.equal(r.verdict, 'UNCLASSIFIED');
});

test('renderFindingsTable: empty findings returns placeholder', () => {
  assert.match(renderFindingsTable([]), /No findings/);
});

test('renderFindingsTable: produces markdown table with header', () => {
  const out = renderFindingsTable([{ raw: 'ACCEPT: x' }, { raw: 'REJECT: y' }]);
  assert.match(out, /\| # \| Verdict \| Finding \|/);
  assert.match(out, /ACCEPT/);
  assert.match(out, /REJECT/);
});

test('renderFindingsTable: escapes pipe chars in finding text', () => {
  const out = renderFindingsTable([{ raw: 'ACCEPT: contains | pipe' }]);
  assert.match(out, /contains \\\| pipe/);
});

test('formatRedTeamComment: includes canonical Role: red-team-reviewer signature', () => {
  const out = formatRedTeamComment({ findings: [{ raw: 'ACCEPT: x' }], artifactType: 'pr-diff' });
  assert.match(out, /Signed-by: ollama-/);
  assert.match(out, /Team&Model: ollama:/);
  assert.match(out, /Role: red-team-reviewer/);
  assert.match(out, /verification-timestamp:/);
});

test('formatRedTeamComment: hyphenated artifact-name prose (no validator collision)', () => {
  const out = formatRedTeamComment({ findings: [], artifactType: 'collaborator-handoff' });
  assert.match(out, /the-collaborator-handoff/);
  // Critical: must NOT contain literal uppercase artifact name in prose
  assert.equal(out.includes('COLLABORATOR_HANDOFF'), false);
});

test('formatRedTeamComment: iteration number in header', () => {
  const out = formatRedTeamComment({ findings: [], iterationN: 3 });
  assert.match(out, /iteration 3/);
});

test('formatRedTeamComment: warning rendered as blockquote', () => {
  const out = formatRedTeamComment({ findings: [], warning: 'fleet-refused' });
  assert.match(out, /> \*\*Note\*\*: fleet-refused/);
});
