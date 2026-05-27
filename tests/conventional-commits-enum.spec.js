'use strict';
// #2304 -- drift-detection spec: verify conventional-commits-enum module stays
// in sync with validate-branch-name.sh, pr-title.yml, and the instructions doc.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const ENUM_MODULE = path.resolve(__dirname, '../scripts/global/conventional-commits-enum');
const BRANCH_SCRIPT = path.resolve(__dirname, '../hooks/scripts/validate-branch-name.sh');
const PR_TITLE_WF = path.resolve(__dirname, '../.github/workflows/pr-title.yml');
const INST_DOC = path.resolve(__dirname, '../instructions/github-governance.instructions.md');

const EXPECTED_TYPES = [
  'feat', 'fix', 'chore', 'content', 'perf',
  'refactor', 'docs', 'style', 'test', 'skill', 'hotfix',
];

test('#2304 module exports required constants', () => {
  const { CONVENTIONAL_COMMIT_TYPES, regexPattern, branchPrefixRegex, prTitleRegex } =
    require(ENUM_MODULE);
  expect(Array.isArray(CONVENTIONAL_COMMIT_TYPES)).toBe(true);
  expect(CONVENTIONAL_COMMIT_TYPES).toHaveLength(11);
  for (const t of EXPECTED_TYPES) {
    expect(CONVENTIONAL_COMMIT_TYPES).toContain(t);
  }
  expect(typeof regexPattern).toBe('string');
  expect(regexPattern).toContain('skill');
  expect(regexPattern).toContain('hotfix');
  expect(branchPrefixRegex).toBeInstanceOf(RegExp);
  expect(prTitleRegex).toBeInstanceOf(RegExp);
});

test('#2304 branchPrefixRegex: all 11 types accepted', () => {
  const { branchPrefixRegex } = require(ENUM_MODULE);
  for (const t of EXPECTED_TYPES) {
    const branch = `${t}/some-slug`;
    expect(branchPrefixRegex.test(branch),
      `branchPrefixRegex should accept '${branch}'`).toBe(true);
  }
});

test('#2304 branchPrefixRegex: skill/<name> and hotfix/<N>-slug accepted', () => {
  const { branchPrefixRegex } = require(ENUM_MODULE);
  expect(branchPrefixRegex.test('skill/my-new-skill')).toBe(true);
  expect(branchPrefixRegex.test('hotfix/99-critical-fix')).toBe(true);
  expect(branchPrefixRegex.test('unknown/some-slug')).toBe(false);
});

test('#2304 prTitleRegex: all 11 types accepted in PR title form', () => {
  const { prTitleRegex } = require(ENUM_MODULE);
  for (const t of EXPECTED_TYPES) {
    const title = `${t}: do something useful`;
    expect(prTitleRegex.test(title),
      `prTitleRegex should accept '${title}'`).toBe(true);
  }
});

test('#2304 prTitleRegex: skill(scope) and hotfix(scope) forms accepted', () => {
  const { prTitleRegex } = require(ENUM_MODULE);
  expect(prTitleRegex.test('skill(governance): add new skill #2304')).toBe(true);
  expect(prTitleRegex.test('hotfix(auth): fix token expiry #2304')).toBe(true);
});

test('#2304 drift: validate-branch-name.sh VALID pattern contains all 11 types', () => {
  const script = fs.readFileSync(BRANCH_SCRIPT, 'utf8');
  const validMatch = script.match(/^VALID="([^"]+)"/m);
  expect(validMatch, 'Could not find VALID= line in validate-branch-name.sh').not.toBeNull();
  const validLine = validMatch[1];
  for (const t of EXPECTED_TYPES) {
    expect(validLine,
      `Type '${t}' missing from VALID pattern in validate-branch-name.sh`
    ).toContain(t);
  }
});

test('#2304 drift: pr-title.yml types block contains all 11 types', () => {
  const wf = fs.readFileSync(PR_TITLE_WF, 'utf8');
  const typesMatch = wf.match(/types:\s*\|([\s\S]+?)requireScope/);
  expect(typesMatch, 'Could not find types block in pr-title.yml').not.toBeNull();
  const typesBlock = typesMatch[1];
  for (const t of EXPECTED_TYPES) {
    expect(typesBlock,
      `Type '${t}' missing from types block in pr-title.yml`
    ).toContain(t);
  }
});

test('#2304 drift: instructions doc Allowed types line contains all 11 types', () => {
  const doc = fs.readFileSync(INST_DOC, 'utf8');
  const allowedMatch = doc.match(/Allowed types:([^\n]+)/);
  expect(allowedMatch,
    'Could not find "Allowed types:" line in github-governance.instructions.md'
  ).not.toBeNull();
  const allowedLine = allowedMatch[1];
  for (const t of EXPECTED_TYPES) {
    expect(allowedLine,
      `Type '${t}' missing from Allowed types line in github-governance.instructions.md`
    ).toContain(t);
  }
});
