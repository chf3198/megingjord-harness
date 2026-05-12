// megalint/{signer-fidelity,body-ac-truthfulness,epic-ac-traceability,index} tests.
const { test, expect } = require('@playwright/test');
const path = require('path');
const dir = path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint');
const Sig = require(path.join(dir, 'signer-fidelity.js'));
const AC = require(path.join(dir, 'body-ac-truthfulness.js'));
const Trace = require(path.join(dir, 'epic-ac-traceability.js'));
const Idx = require(path.join(dir, 'index.js'));

test('signer-fidelity: Curtis Franks Signed-by rejected', () => {
  const r = Sig.validate({ body: 'Signed-by: Curtis Franks\nTeam&Model: claude-code:opus-4-7' });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('client-identity-as-signer');
});

test('signer-fidelity: worker alias accepted', () => {
  const r = Sig.validate({ body: 'Signed-by: Nova Mason\nTeam&Model: copilot:gpt-5.3-codex@github' });
  expect(r.ok).toBe(true);
});

test('signer-fidelity: AI-Signature trailer with client identity rejected', () => {
  const r = Sig.validate({ body: 'AI-Signature: Curtis Franks' });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('client-identity-as-ai-signature');
});

test('signer-fidelity: multiple Curtis-Franks occurrences deduplicated', () => {
  const body = 'Signed-by: Curtis Franks\nElsewhere\nSigned-by: Curtis Franks';
  const r = Sig.validate({ body });
  expect(r.violations.length).toBe(1);
});

test('body-ac: closed ticket with unticked ACs fails', () => {
  const body = '- [ ] AC1: foo\n- [x] AC2: bar';
  const r = AC.validate({ body, labels: ['status:done'], state: 'closed' });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('unticked-ac-on-terminal');
});

test('body-ac: closed ticket with all ticked ACs passes', () => {
  const body = '- [x] AC1\n- [x] AC2';
  const r = AC.validate({ body, labels: ['status:done'], state: 'closed' });
  expect(r.ok).toBe(true);
});

test('body-ac: cancelled state permits unticked ACs', () => {
  const r = AC.validate({
    body: '- [ ] AC1', labels: ['status:cancelled'], state: 'closed',
  });
  expect(r.ok).toBe(true);
});

test('body-ac: open tickets are advisory (no fail)', () => {
  const r = AC.validate({ body: '- [ ] AC1', labels: ['status:in-progress'], state: 'open' });
  expect(r.ok).toBe(true);
});

test('body-ac: countCheckboxes counts ticked + unticked', () => {
  const c = AC.countCheckboxes('- [x] AC1\n- [ ] AC2\n- [ ] AC3');
  expect(c).toEqual({ total: 3, ticked: 1, unticked: 2 });
});

test('epic-traceability: Epic with 5 ACs and 0 refs fails', () => {
  const body = '- [ ] AC1\n- [ ] AC2\n- [ ] AC3\n- [ ] AC4\n- [ ] AC5';
  const r = Trace.validate({ body, labels: ['type:epic'], issueNumber: 99 });
  expect(r.ok).toBe(false);
  expect(r.violations[0].rule).toBe('epic-body-missing-child-refs');
});

test('epic-traceability: Epic with child refs passes', () => {
  const body = '- [ ] AC1\n- [ ] AC2\n- [ ] AC3\nChildren: #100, #101, #102';
  const r = Trace.validate({ body, labels: ['type:epic'], issueNumber: 99 });
  expect(r.ok).toBe(true);
});

test('epic-traceability: non-Epic is not validated', () => {
  const r = Trace.validate({ body: '- [ ] AC1', labels: ['type:task'] });
  expect(r.ok).toBe(true);
  expect(r.reason).toBe('not-an-epic');
});

test('epic-traceability: self-ref does not count', () => {
  const body = '- [ ] AC1\n- [ ] AC2\n- [ ] AC3\nThis is #99';
  const r = Trace.validate({ body, labels: ['type:epic'], issueNumber: 99 });
  expect(r.ok).toBe(false);
});

test('index.runAll: dispatches to all 7 validators', () => {
  const result = Idx.runAll({ comments: [], body: '', labels: [] });
  expect(Object.keys(result.results).length).toBe(7);
});

test('index.run: unknown validator throws', () => {
  expect(() => Idx.run('bogus', {})).toThrow(/Unknown validator/);
});
