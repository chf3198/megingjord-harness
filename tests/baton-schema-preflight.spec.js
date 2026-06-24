// baton-schema-preflight tests — D2 (#1565).
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const { spawnSync } = require('node:child_process');
const { validate } = require(path.resolve(__dirname, '..', 'scripts', 'global', 'baton-schema-preflight.js'));

const VALID = {
  manager: `## MANAGER_HANDOFF\nscope: test\nlane: lane:code-change\ntest_strategy: tdd-pyramid\nacceptance:\n- AC1\ngates:\n- lint\nSigned-by: Soren Mason\nTeam&Model: copilot:model\nRole: manager`,
  collaborator: `## COLLABORATOR_HANDOFF\nscope: done\ntest_strategy: tdd-pyramid\nSigned-by: Soren Harper\nTeam&Model: copilot:model\nRole: collaborator`,
  admin: `## ADMIN_HANDOFF\nSigned-by: Soren Reyes\nTeam&Model: copilot:model\nRole: admin`,
  consultant: `## CONSULTANT_CLOSEOUT\nrubric: G1=9, G2=8, G3=10\nverification-timestamp: 2026-05-14T23:00:00Z\nverdict: approved\nSigned-by: Soren Vale\nTeam&Model: copilot:model\nRole: consultant`,
};

for (const [role, body] of Object.entries(VALID)) {
  test(`${role}: valid body passes`, () => {
    const { ok, violations } = validate(role, body);
    expect(violations).toEqual([]);
    expect(ok).toBe(true);
  });
}

test('manager: missing acceptance fails', () => {
  const body = VALID.manager.replace(/acceptance:.*\n- AC1/, '');
  const { ok, violations } = validate('manager', body);
  expect(ok).toBe(false);
  expect(violations.some(v => v.includes('acceptance'))).toBe(true);
});

test('manager: missing gates fails', () => {
  const body = VALID.manager.replace(/gates:.*\n- lint/, '');
  const { ok, violations } = validate('manager', body);
  expect(ok).toBe(false);
  expect(violations.some(v => v.includes('gates'))).toBe(true);
});

test('consultant: missing rubric fails', () => {
  const body = VALID.consultant.replace(/rubric:.*\n/, '');
  const { ok, violations } = validate('consultant', body);
  expect(ok).toBe(false);
  expect(violations.some(v => v.includes('rubric'))).toBe(true);
});

test('consultant: missing verification-timestamp fails', () => {
  const body = VALID.consultant.replace(/verification-timestamp:.*\n/, '');
  const { ok, violations } = validate('consultant', body);
  expect(ok).toBe(false);
  expect(violations.some(v => v.includes('verification-timestamp'))).toBe(true);
});

test('unknown role returns violation', () => {
  const { ok, violations } = validate('unknown', 'anything');
  expect(ok).toBe(false);
  expect(violations[0]).toContain("Unknown role");
});

test('CLI exits 0 for valid manager body', () => {
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '..', 'scripts', 'global', 'baton-schema-preflight.js'),
    '--role', 'manager', '--body', VALID.manager,
  ]);
  expect(result.status).toBe(0);
  expect(result.stdout.toString()).toContain('PASS');
});

test('CLI exits 1 for incomplete consultant body', () => {
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '..', 'scripts', 'global', 'baton-schema-preflight.js'),
    '--role', 'consultant', '--body', '## CONSULTANT_CLOSEOUT\nSigned-by: X\nRole: consultant',
  ]);
  expect(result.status).toBe(1);
  expect(result.stderr.toString()).toContain('FAIL');
});

// #3225 — bold-markdown field parsing via shared helper integration
test('manager: bold-markdown fields pass (#3225)', () => {
  const body = `## MANAGER_HANDOFF\n**scope:** test\n**lane:** lane:code-change\n**test_strategy:** tdd-pyramid\n**acceptance:**\n- AC1\n**gates:**\n- lint\nSigned-by: Soren Mason\nTeam&Model: copilot:model\nRole: manager`;
  const { ok, violations } = validate('manager', body);
  expect(violations).toEqual([]);
  expect(ok).toBe(true);
});

test('manager: colon-outside-bold fields pass (#3225 AC4)', () => {
  const body = `## MANAGER_HANDOFF\n**scope**: test\n**lane**: lane:code-change\n**test_strategy**: tdd-pyramid\n**acceptance**:\n- AC1\n**gates**:\n- lint\nSigned-by: Soren Mason\nTeam&Model: copilot:model\nRole: manager`;
  const { ok, violations } = validate('manager', body);
  expect(violations).toEqual([]);
  expect(ok).toBe(true);
});

test('manager: hyphen list-prefix fields pass (#3225 AC4)', () => {
  const body = `## MANAGER_HANDOFF\n- scope: test\n- lane: lane:code-change\n- test_strategy: tdd-pyramid\n- acceptance:\n- AC1\n- gates:\n- lint\nSigned-by: Soren Mason\nTeam&Model: copilot:model\nRole: manager`;
  const { ok, violations } = validate('manager', body);
  expect(violations).toEqual([]);
  expect(ok).toBe(true);
});

