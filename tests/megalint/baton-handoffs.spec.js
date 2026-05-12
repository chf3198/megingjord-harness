// megalint/{collaborator,admin,consultant}-* tests (#1420, Epic #1407 AC1).
const { test, expect } = require('@playwright/test');
const path = require('path');
const dir = path.resolve(__dirname, '..', '..', 'scripts', 'global', 'megalint');
const Coll = require(path.join(dir, 'collaborator-handoff.js'));
const Adm = require(path.join(dir, 'admin-handoff.js'));
const Cons = require(path.join(dir, 'consultant-closeout.js'));

const collaboratorBody = `**COLLABORATOR_HANDOFF — Orla Harper**
work done.
Signed-by: Orla Harper · Team&Model: claude-code:opus-4-7@anthropic · Role: collaborator`;
const adminBody = `**ADMIN_HANDOFF — Mira Reyes**
ready.
Signed-by: Mira Reyes · Team&Model: claude-code:opus-4-7@anthropic · Role: admin`;
const consultantBody = `**CONSULTANT_CLOSEOUT — Yara Vale**
Rubric: G1=9, G2=9, G3=10, G4=10, G5=10, G6=9, G7=8, G8=8, G9=9. Mean 9.0.
verdict: approve
verification timestamp: 2026-05-12T11:30Z
Signed-by: Yara Vale · Team&Model: claude-code:opus-4-7@anthropic · Role: consultant`;

test('collaborator: full handoff passes; signer extracted', () => {
  const r = Coll.validate({ comments: [{ body: collaboratorBody }] });
  expect(r.ok).toBe(true);
  expect(r.signer).toContain('Orla');
});

test('collaborator: lightweight lane skips check', () => {
  const r = Coll.validate({ comments: [], lane: 'lane:docs-only' });
  expect(r.ok).toBe(true);
  expect(r.reason).toBe('lightweight-lane-skip');
});

test('collaborator: missing handoff fails', () => {
  const r = Coll.validate({ comments: [{ body: 'no marker' }] });
  expect(r.ok).toBe(false);
});

test('admin: full handoff passes; signer-independence verified', () => {
  const r = Adm.validate({
    comments: [{ body: collaboratorBody }, { body: adminBody }],
  });
  expect(r.ok).toBe(true);
});

test('admin: same signer as collaborator fails independence check', () => {
  const sameSigner = adminBody.replace(/Mira Reyes/g, 'Orla Harper');
  const r = Adm.validate({
    comments: [{ body: collaboratorBody }, { body: sameSigner }],
  });
  expect(r.ok).toBe(false);
  expect(r.violations.some(v => v.rule === 'admin-signer-not-independent')).toBe(true);
});

test('consultant: full closeout with rubric + timestamp + verdict passes', () => {
  const r = Cons.validate({ comments: [{ body: consultantBody }] });
  expect(r.ok).toBe(true);
});

test('consultant: missing G1-9 rubric fails', () => {
  const body = consultantBody.replace(/Rubric:.+\n/, '');
  const r = Cons.validate({ comments: [{ body }] });
  expect(r.violations.some(v => v.rule === 'missing-rubric')).toBe(true);
});

test('consultant: missing verification timestamp fails', () => {
  const body = consultantBody.replace(/verification timestamp:.+\n/, '');
  const r = Cons.validate({ comments: [{ body }] });
  expect(r.violations.some(v => v.rule === 'missing-verification-timestamp')).toBe(true);
});

test('consultant: missing verdict fails', () => {
  const body = consultantBody.replace(/verdict:.+\n/, '');
  const r = Cons.validate({ comments: [{ body }] });
  expect(r.violations.some(v => v.rule === 'missing-verdict')).toBe(true);
});
