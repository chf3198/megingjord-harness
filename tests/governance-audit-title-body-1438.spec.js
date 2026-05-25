// #1438 — Title-case + title-prefix + body-structure checks added to
// governance-audit.js detectViolations(). Covers AC1 (lowercase title),
// AC2 (Conventional Commits prefix on issues), AC3 (body missing
// structured section). AC4 satisfied by this spec.
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-audit.js'));

// --- AC1: title-case ---
test('#1438 AC1: detectViolations flags lowercase-starting title', () => {
  const v = A.detectViolations([
    { number: 100, title: 'this should be flagged', body: '## Summary\nx', labels: ['type:task', 'status:backlog'] },
  ]);
  expect(v.find(x => x.rule === 'title-case')).toBeTruthy();
  expect(v.find(x => x.rule === 'title-case').ticket).toBe(100);
});

test('#1438 AC1 negative: capitalized title passes', () => {
  const v = A.detectViolations([
    { number: 101, title: 'This is properly capitalized', body: '## Summary\nx', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'title-case')).toBeUndefined();
});

// --- AC2: title-conventional-prefix ---
test('#1438 AC2: detectViolations flags Conventional Commits prefix on issue', () => {
  const v = A.detectViolations([
    { number: 200, title: 'fix(infra): bump nginx', body: '## Summary\nx', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'title-conventional-prefix')).toBeTruthy();
});

test('#1438 AC2: detectViolations flags scopeless commit prefix (feat:, chore:)', () => {
  const v = A.detectViolations([
    { number: 201, title: 'feat: add cache layer', body: '## Summary\nx', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'title-conventional-prefix')).toBeTruthy();
});

test('#1438 AC2 negative: plain imperative title with colon-after-noun passes', () => {
  // "Tier-2 anneal: ..." starts with uppercase noun + colon — NOT a commit prefix
  const v = A.detectViolations([
    { number: 202, title: 'Tier-2 anneal: signer-alias canonical extension', body: '## Summary\nx', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'title-conventional-prefix')).toBeUndefined();
});

// --- AC3: body-structure ---
test('#1438 AC3: detectViolations flags body missing structured section', () => {
  const v = A.detectViolations([
    { number: 300, title: 'Properly capitalized title', body: 'just freeform text, no H2 headers', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'body-structure')).toBeTruthy();
});

test('#1438 AC3 negative: body with ## Summary passes', () => {
  const v = A.detectViolations([
    { number: 301, title: 'Properly capitalized', body: '## Summary\n\nclear description here.', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'body-structure')).toBeUndefined();
});

test('#1438 AC3 negative: body with ## Acceptance Criteria passes (case-insensitive)', () => {
  const v = A.detectViolations([
    { number: 302, title: 'Properly capitalized', body: '## acceptance criteria\n\n- [ ] AC1', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'body-structure')).toBeUndefined();
});

test('#1438 AC3: empty body is NOT flagged (not all tickets need bodies)', () => {
  const v = A.detectViolations([
    { number: 303, title: 'Properly capitalized', body: '', labels: ['type:task', 'status:triage'] },
  ]);
  expect(v.find(x => x.rule === 'body-structure')).toBeUndefined();
});

// --- combined: ticket with multiple drift kinds emits multiple violations ---
test('#1438 combined: title-case + title-prefix + body-structure all flag together', () => {
  const v = A.detectViolations([
    { number: 400, title: 'fix(scripts): do thing', body: 'no header here', labels: ['type:task', 'status:triage'] },
  ]);
  const ticket400 = v.filter(x => x.ticket === 400).map(x => x.rule).sort();
  expect(ticket400).toEqual(['body-structure', 'title-case', 'title-conventional-prefix']);
});

// --- existing rules continue to fire (no regression) ---
test('#1438 regression: Rule 4 (non-Epic backlog with role) still fires', () => {
  const v = A.detectViolations([
    { number: 500, title: 'Valid title', body: '## Summary\nx', labels: ['type:task', 'status:backlog', 'role:manager'] },
  ]);
  expect(v.find(x => x.rule === 'Rule 4')).toBeTruthy();
});
