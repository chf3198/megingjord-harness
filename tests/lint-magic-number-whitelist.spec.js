// Magic-number lint whitelist for #NNN issue refs (#991).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CORE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'lint-readability-core.js'));

function tmpFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-mn-'));
  const file = path.join(dir, 'test.js');
  fs.writeFileSync(file, content);
  return { file, dir };
}

test('issue refs (#NNN) inside string literals are NOT flagged', () => {
  const { file, dir } = tmpFile("const x = 'see #944 for details';\nconst y = 'fix per #1234';\n");
  const warnings = CORE.checkFile(file);
  const magicWarns = warnings.filter((w) => w.rule === 'magic-number');
  expect(magicWarns).toHaveLength(0);
  fs.rmSync(dir, { recursive: true });
});

test('real magic numbers in code paths ARE still flagged', () => {
  const { file, dir } = tmpFile("function foo() { setTimeout(fn, 12345); }\n");
  const warnings = CORE.checkFile(file);
  const magicWarns = warnings.filter((w) => w.rule === 'magic-number');
  expect(magicWarns.length).toBeGreaterThan(0);
  expect(magicWarns[0].msg).toContain('12345');
  fs.rmSync(dir, { recursive: true });
});

test('mixed line: string-issue-ref OK + code-magic-number flagged', () => {
  const { file, dir } = tmpFile("const x = 'see #999 then '; setTimeout(fn, 99999);\n");
  const warnings = CORE.checkFile(file);
  const magicWarns = warnings.filter((w) => w.rule === 'magic-number');
  // The 99999 is outside any string; #999 is inside; only 99999 should be flagged.
  expect(magicWarns.some((w) => w.msg.includes('99999'))).toBe(true);
  fs.rmSync(dir, { recursive: true });
});

test('multi-quote variants: backticks, double, single all stripped', () => {
  const { file, dir } = tmpFile([
    "const a = 'single #111';",
    'const b = "double #222";',
    'const c = `template #333`;',
  ].join('\n') + '\n');
  const warnings = CORE.checkFile(file);
  const magicWarns = warnings.filter((w) => w.rule === 'magic-number');
  expect(magicWarns).toHaveLength(0);
  fs.rmSync(dir, { recursive: true });
});
