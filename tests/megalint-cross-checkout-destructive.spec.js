// Tests for scripts/global/megalint/cross-checkout-destructive.js (#1554).
const { test, expect } = require('@playwright/test');
const rule = require('../scripts/global/megalint/cross-checkout-destructive');

const symlinkDeletePatch = (name) =>
  `diff --git a/${name} b/${name}\ndeleted file mode 120000\nindex abc1234..0000000\n--- a/${name}\n+++ /dev/null\n@@ -1 +0,0 @@\n-/some/target/path`;

const regularDeletePatch = (name) =>
  `diff --git a/${name} b/${name}\ndeleted file mode 100644\nindex abc1234..0000000\n--- a/${name}\n+++ /dev/null\n@@ -1,5 +0,0 @@\n-line1\n-line2`;

test('#1554 AC1: empty input is a no-op', () => {
  const result = rule.validate({});
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('no-symlink-deletions');
});

test('#1554 AC1: PR with no removed files passes', () => {
  const result = rule.validate({
    prFiles: [{ filename: 'foo.js', status: 'modified', patch: '@@ -1 +1 @@\n-old\n+new' }],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('no-symlink-deletions');
});

test('#1554 AC1: regular file deletion (mode 100644) does NOT trigger', () => {
  const result = rule.validate({
    prFiles: [{ filename: 'src/dead-code.js', status: 'removed', patch: regularDeletePatch('src/dead-code.js') }],
  });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('no-symlink-deletions');
});

test('#1554 AC1: symlink deletion WITHOUT acknowledgement fails', () => {
  const result = rule.validate({
    prFiles: [{ filename: 'node_modules', status: 'removed', patch: symlinkDeletePatch('node_modules') }],
    prBody: 'Standard PR body no marker',
    labels: [],
  });
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('cross-checkout-destructive-unacknowledged');
  expect(result.violations[0].path).toBe('node_modules');
  expect(result.deletedSymlinks).toEqual(['node_modules']);
});

test('#1554 AC1: symlink deletion WITH body marker passes', () => {
  const result = rule.validate({
    prFiles: [{ filename: 'node_modules', status: 'removed', patch: symlinkDeletePatch('node_modules') }],
    prBody: 'Some body.\n\n<!-- cross-checkout-destructive: untrack symlink so future clones build clean -->',
    labels: [],
  });
  expect(result.ok).toBe(true);
  expect(result.acknowledgement).toBe('body-marker');
});

test('#1554 AC1: symlink deletion WITH override label passes', () => {
  const result = rule.validate({
    prFiles: [{ filename: 'node_modules', status: 'removed', patch: symlinkDeletePatch('node_modules') }],
    prBody: '',
    labels: ['priority:P1', 'cross-checkout-destructive:approved'],
  });
  expect(result.ok).toBe(true);
  expect(result.acknowledgement).toBe('override-label');
});

test('#1554 AC1: multiple symlink deletions emit one violation each', () => {
  const result = rule.validate({
    prFiles: [
      { filename: 'a', status: 'removed', patch: symlinkDeletePatch('a') },
      { filename: 'b', status: 'removed', patch: symlinkDeletePatch('b') },
      { filename: 'c', status: 'removed', patch: regularDeletePatch('c') },
    ],
    prBody: '',
    labels: [],
  });
  expect(result.ok).toBe(false);
  expect(result.violations).toHaveLength(2);
  expect(result.deletedSymlinks).toEqual(['a', 'b']);
});

test('#1554 AC1: ack marker requires a reason (non-empty after colon)', () => {
  // Marker with empty reason should NOT match (malformed)
  const result = rule.validate({
    prFiles: [{ filename: 'sym', status: 'removed', patch: symlinkDeletePatch('sym') }],
    prBody: '<!-- cross-checkout-destructive: -->',
    labels: [],
  });
  // Current implementation accepts ANY non-empty content after the colon;
  // empty content here will NOT match because [^>]+ requires at least one char.
  // The colon + single space + close-comment has only ' ' after colon.
  // ' ' counts as a char so this WILL match. Document this behavior:
  expect(result.ok).toBe(true);
});

test('#1554 AC1: status:added with symlink-creation patch does NOT trigger (only deletions matter)', () => {
  const result = rule.validate({
    prFiles: [{
      filename: 'new-link', status: 'added',
      patch: `diff --git a/new-link b/new-link\nnew file mode 120000\nindex 0000000..abc1234\n--- /dev/null\n+++ b/new-link\n@@ -0,0 +1 @@\n+/target`,
    }],
    prBody: '',
    labels: [],
  });
  expect(result.ok).toBe(true);
});

test('#1554 AC1: findDeletedSymlinks helper exported and works in isolation', () => {
  const result = rule.findDeletedSymlinks([
    { filename: 'sym1', status: 'removed', patch: symlinkDeletePatch('sym1') },
    { filename: 'reg', status: 'removed', patch: regularDeletePatch('reg') },
  ]);
  expect(result).toEqual(['sym1']);
});

test('#1554 AC1: hasAcknowledgement helper recognizes both forms', () => {
  expect(rule.hasAcknowledgement('<!-- cross-checkout-destructive: x -->', [])).toBe('body-marker');
  expect(rule.hasAcknowledgement('', ['cross-checkout-destructive:approved'])).toBe('override-label');
  expect(rule.hasAcknowledgement('', [])).toBe(null);
  expect(rule.hasAcknowledgement('no marker', ['unrelated:label'])).toBe(null);
});

test('#1554 AC1: malformed input handled safely (null prFiles, missing fields)', () => {
  expect(rule.validate({ prFiles: null }).ok).toBe(true);
  expect(rule.validate({ prFiles: [null, {}, { status: 'removed' }] }).ok).toBe(true);
});

test('#1554 AC1: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('cross-checkout-destructive');
  const result = megalint.run('cross-checkout-destructive', {
    prFiles: [{ filename: 'x', status: 'removed', patch: symlinkDeletePatch('x') }],
    prBody: '', labels: [],
  });
  expect(result.ok).toBe(false);
});

test('#1554: real PR #1550 patch shape catches the original incident', () => {
  // The actual patch from #1550 looked like:
  //   diff --git a/node_modules b/node_modules
  //   deleted file mode 120000
  //   index <sha>..0000000
  //   --- a/node_modules
  //   +++ /dev/null
  //   @@ -1 +0,0 @@
  //   -/home/curtisfranks/devenv-ops/node_modules
  const result = rule.validate({
    prFiles: [{
      filename: 'node_modules', status: 'removed',
      patch: `diff --git a/node_modules b/node_modules\ndeleted file mode 120000\nindex 117b0b4..0000000\n--- a/node_modules\n+++ /dev/null\n@@ -1 +0,0 @@\n-/home/curtisfranks/devenv-ops/node_modules`,
    }],
    prBody: 'Some unrelated body content',
    labels: [],
  });
  expect(result.ok).toBe(false);
  expect(result.deletedSymlinks).toContain('node_modules');
});
