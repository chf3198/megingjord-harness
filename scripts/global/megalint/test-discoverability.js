'use strict';
// test-discoverability — Epic #1510 Phase-1g. Flags `tests/*.spec.js`
// files that don't import `@playwright/test`, so they sit in the test
// directory but are NOT picked up by `npm test` (which runs
// `npx playwright test`). Resolves #1489.
//
// Pattern surfaced in 2026-05-13 audit: 18 of 120 spec files used bare
// `require('assert')` and self-executed via IIFEs — not collected by
// Playwright's runner. Authors and reviewers see them in the test dir
// and assume coverage that doesn't exist.
//
// Pure function: caller supplies file path + content. Skip allowlist for
// known-intentional script-style test files (per-path opt-out via
// magic comment // @megalint:test-discoverability:opt-out).

const PLAYWRIGHT_IMPORT_RE = /require\(\s*['"]@playwright\/test['"]\s*\)|from\s+['"]@playwright\/test['"]/;
const OPT_OUT_RE = /@megalint:test-discoverability:opt-out/;
const SPEC_PATH_RE = /(?:^|\/)tests\/[^/]*\.spec\.(?:js|ts)$/;

function shouldEvaluate(filePath) {
  return SPEC_PATH_RE.test(filePath || '');
}

function validateFile(filePath, content) {
  if (!shouldEvaluate(filePath)) {
    return { ok: true, skipped: 'not-a-spec-file' };
  }
  const text = content || '';
  if (OPT_OUT_RE.test(text)) {
    return { ok: true, skipped: 'opt-out-comment-present' };
  }
  if (PLAYWRIGHT_IMPORT_RE.test(text)) {
    return { ok: true };
  }
  return {
    ok: false,
    violations: [{
      rule: 'test-not-playwright-discoverable',
      detail: `Spec file '${filePath}' does not import '@playwright/test'. `
        + `Playwright runner will not register tests from it; npm test will not `
        + `execute its assertions. Convert to Playwright OR add '// @megalint:`
        + `test-discoverability:opt-out' if this is intentionally a CLI script.`,
      filePath,
    }],
  };
}

function validate(input) {
  const files = input.testFiles || [];
  const violations = [];
  for (const file of files) {
    const result = validateFile(file.path, file.content);
    if (!result.ok) violations.push(...result.violations);
  }
  return { ok: violations.length === 0, violations, scanned: files.length };
}

module.exports = {
  validate, validateFile, shouldEvaluate,
  PLAYWRIGHT_IMPORT_RE, OPT_OUT_RE, SPEC_PATH_RE,
};
