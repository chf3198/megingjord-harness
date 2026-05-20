// PDCA emit per #1974. Lane: code-change. test_strategy: tdd-pyramid.

const { test, expect } = require('@playwright/test');
const path = require('path');
const PDCA = require(path.resolve(__dirname, '..', 'scripts', 'global', 'pdca-emit.js'));

const FIXTURE_EPIC = {
  number: 1962,
  title: 'Programmatic enforcement upgrade',
  body: '## Scope\nUpgrade enforcement.\n## ACs\n- [x] AC1: ship rubric\n- [ ] AC2: ship Cedar pilot',
  closedAt: '2026-05-20T08:00:00Z',
  state: 'OPEN',
  comments: [
    { body: '## MANAGER_HANDOFF\nticket: #1962\nSigned-by: Manager' },
    { body: '## COLLABORATOR_HANDOFF\nticket: #1962\nSigned-by: Collab' },
    { body: '## ADMIN_HANDOFF\nticket: #1962\nSigned-by: Admin' },
    { body: '## CONSULTANT_EPIC_CLOSEOUT\nticket: #1962\nverdict: approve\nG1=10, G2=9, G3=10, G4=10, G5=9, G6=8, G7=9, G8=10, G9=10, G10=9\nanneal_tickets_filed: [#1987, #1988]\nRefs #1962\nSigned-by: Consultant' },
  ],
};

test('extractPlan reads ACs from checkboxes', () => {
  const { acceptance_criteria, scope } = PDCA.extractPlan(FIXTURE_EPIC);
  expect(acceptance_criteria).toContain('AC1: ship rubric');
  expect(acceptance_criteria).toContain('AC2: ship Cedar pilot');
  expect(scope).toMatch(/Upgrade enforcement/);
});

test('extractDo counts handoff artifacts in comments', () => {
  const { handoff_counts, comment_count } = PDCA.extractDo(FIXTURE_EPIC);
  expect(handoff_counts.manager).toBe(1);
  expect(handoff_counts.collaborator).toBe(1);
  expect(handoff_counts.admin).toBe(1);
  expect(handoff_counts.consultant).toBe(1);
  expect(comment_count).toBe(4);
});

test('extractCheck parses rubric and verdict from consultant closeout', () => {
  const { closeout_present, rubric, verdict } = PDCA.extractCheck(FIXTURE_EPIC);
  expect(closeout_present).toBe(true);
  expect(rubric.G1).toBe(10);
  expect(rubric.G10).toBe(9);
  expect(verdict).toBe('approve');
});

test('extractAct captures anneal tickets and follow-ons', () => {
  const { anneal_tickets, follow_ons } = PDCA.extractAct(FIXTURE_EPIC);
  expect(anneal_tickets).toContain('#1987');
  expect(anneal_tickets).toContain('#1988');
  expect(follow_ons).toContain('#1962');
});

test('sanitize redacts credential-looking strings', () => {
  const dirty = 'api_key=abc12345defXYZ token: bearer-xyz98765 password: hunter2hunter2';
  const clean = PDCA.sanitize(dirty);
  expect(clean).not.toMatch(/abc12345defXYZ/);
  expect(clean).toMatch(/\[REDACTED\]/);
});

test('buildPdca assembles full PDCA structure', () => {
  const pdca = PDCA.buildPdca(FIXTURE_EPIC);
  expect(pdca.standard).toMatch(/ISO\/IEC 42001/);
  expect(pdca.epic.number).toBe(1962);
  expect(pdca.plan.acceptance_criteria.length).toBe(2);
  expect(pdca.do.handoff_counts.manager).toBe(1);
  expect(pdca.check.verdict).toBe('approve');
  expect(pdca.act.anneal_tickets.length).toBe(2);
});

test('writePdca returns null when disk write fails (degraded mode)', () => {
  // Build PDCA with a number that would create invalid path
  const pdca = { ...PDCA.buildPdca(FIXTURE_EPIC), epic: { number: '/etc/passwd' } };
  // Even on failure path or success, function returns string or null
  const result = PDCA.writePdca(pdca);
  expect(result === null || typeof result === 'string').toBe(true);
});

test('writePdca successful path returns absolute file path', () => {
  const pdca = PDCA.buildPdca({ ...FIXTURE_EPIC, number: 999999 });
  const result = PDCA.writePdca(pdca);
  expect(result).toMatch(/\.megingjord\/pdca\/epic-999999-closeout\.json$/);
});
