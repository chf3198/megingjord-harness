// Epic Close-Readiness matcher tests (#1306).
const { test, expect } = require('@playwright/test');
const path = require('path');
const C = require(path.resolve(__dirname, '..', 'scripts', 'global', 'epic-close-readiness-check.js'));

test('parseTaskListChildren extracts task-list-formatted refs only', () => {
  const body = `
- [ ] #1287 — open child
- [x] #1288 — closed child
- [X] #1289 — capital-X variant
not a list line: #9999
- not a checkbox: #8888
`;
  const refs = C.parseTaskListChildren(body);
  expect(refs.has(1287)).toBe(true);
  expect(refs.has(1288)).toBe(true);
  expect(refs.has(1289)).toBe(true);
  expect(refs.has(9999)).toBe(false);
  expect(refs.has(8888)).toBe(false);
});

test('parseTaskListChildren ignores prose Refs/Closes/Epic mentions (#1306 root-cause regression)', () => {
  const body = `## Body with prose mentions
This Epic relates to Refs #1271, Epic #1308, Closes #500, and mentions #1112 in passing.
Companion: #1111`;
  const refs = C.parseTaskListChildren(body);
  expect(refs.size).toBe(0);
});

test('parseTaskListChildren handles indented + nested checkboxes', () => {
  const body = `
- [ ] #100 — top-level
  - [ ] #101 — nested
    - [x] #102 — deeply nested
`;
  const refs = C.parseTaskListChildren(body);
  expect(refs.has(100)).toBe(true);
  expect(refs.has(101)).toBe(true);
  expect(refs.has(102)).toBe(true);
});

test('parseParentRef detects explicit Parent: text and URL', () => {
  expect(C.parseParentRef({ body: 'Parent: #1308' }, 1308, 'o', 'r')).toBe('parent-text');
  expect(C.parseParentRef({ body: 'Parent: https://github.com/o/r/issues/1308' }, 1308, 'o', 'r')).toBe('parent-url');
});

test('parseParentRef rejects Refs/Epic/Closes prose for parent matching', () => {
  expect(C.parseParentRef({ body: 'Refs #1308' }, 1308, 'o', 'r')).toBeNull();
  expect(C.parseParentRef({ body: 'Epic #1308 progress' }, 1308, 'o', 'r')).toBeNull();
  expect(C.parseParentRef({ body: 'Closes #1308' }, 1308, 'o', 'r')).toBeNull();
});

test('Real #1103-shape body: prose mentions of #1112/#1113/etc. produce ZERO task-list children', () => {
  // Synthesizes the #1103 body shape that previously generated false positives.
  // Real #1103 had children #1115-#1124 in task-list; mentioned #1112/#1113/#1130 only in prose.
  const body = `## Summary
Harden goals across instructions.

## Initial Planned Work (Phase 0 only)
- [ ] Child R&D ticket: #1105 — planning package.

## Companion ticket
#1111 (Allow parallel writes)

## Sibling Epic
Refs #1112, Epic #1113 was filed as a sibling.

## Out of Scope
- Anything related to #1130 (separate Epic)`;
  const refs = C.parseTaskListChildren(body);
  expect([...refs]).toEqual([1105]); // Only the task-list child
});

test('parseTaskListChildren handles complete real #1308 body (8 children)', () => {
  const body = `
### Workstream A — CC Team
- [x] #1309 — done
- [x] #1310 — done
- [x] #1311 — done
- [x] #1312 — done

### Workstream B — CP Team
- [x] #1313 — done
- [x] #1314 — done
- [x] #1315 — done
- [x] #1316 — done

Refs Epic #999 (sibling)`;
  const refs = C.parseTaskListChildren(body);
  expect([...refs].sort()).toEqual([1309, 1310, 1311, 1312, 1313, 1314, 1315, 1316]);
});
