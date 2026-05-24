// changelog-aggregate — tests (#1132 + #2126 T1-T8 mitigations).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'changelog-aggregate.js'));
const V = require(path.resolve(__dirname, '..', 'scripts', 'global', 'changelog-fragment-validator.js'));

function mk() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'changelog-agg-'));
  const fragDir = path.join(dir, 'fragments');
  const changelog = path.join(dir, 'CHANGELOG.md');
  fs.mkdirSync(fragDir);
  fs.writeFileSync(changelog, '# Changelog\n\n## [Unreleased]\n\n## [1.0.0]\n- prior\n');
  return { dir, fragDir, changelog, cleanup: () => fs.rmSync(dir, { recursive: true }) };
}
const w = (p, c) => fs.writeFileSync(p, c);

test('listFragments: sorts by ticket number, skips non-md, handles empty (T1)', () => {
  const { dir, fragDir, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n- x'); w(path.join(fragDir, '1115.md'), '### Added\n- y');
  w(path.join(fragDir, '1500.md'), '### Added\n- z'); w(path.join(fragDir, 'README'), 'ignored');
  expect(A.listFragments(fragDir).map(f => f.name)).toEqual(['1115.md', '1132.md', '1500.md']);
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));
  expect(A.listFragments(empty)).toEqual([]);
  fs.rmSync(empty, { recursive: true }); cleanup();
});

test('aggregate: empty fragments → no changes (T7 empty-array safety)', () => {
  const { fragDir, changelog, cleanup } = mk();
  const before = fs.readFileSync(changelog, 'utf-8');
  expect(A.aggregate({ dir: fragDir, changelog }).count).toBe(0);
  expect(fs.readFileSync(changelog, 'utf-8')).toBe(before);
  cleanup();
});

test('aggregate: H3-only fragments splice under [Unreleased]; fragment deleted (T8 idempotency)', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n- aggregator script');
  expect(A.aggregate({ dir: fragDir, changelog }).count).toBe(1);
  const c = fs.readFileSync(changelog, 'utf-8');
  expect(c).toContain('## [Unreleased]\n\n### Added\n- aggregator script');
  expect(c).toContain('## [1.0.0]');
  expect(fs.existsSync(path.join(fragDir, '1132.md'))).toBe(false);
  // Idempotency: re-run is no-op
  expect(A.aggregate({ dir: fragDir, changelog }).skipped).toBe('empty');
  cleanup();
});

test('aggregate: dry-run preserves CHANGELOG and fragments', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n- test');
  const before = fs.readFileSync(changelog, 'utf-8');
  const r = A.aggregate({ dir: fragDir, changelog, dryRun: true });
  expect(r.dryRun).toBe(true); expect(r.count).toBe(1);
  expect(r.preview).toContain('### Added');
  expect(fs.readFileSync(changelog, 'utf-8')).toBe(before);
  expect(fs.existsSync(path.join(fragDir, '1132.md'))).toBe(true);
  cleanup();
});

test('aggregate: archive-to moves fragments; multi-fragment order is by ticket (T1)', () => {
  const { dir, fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n- entry1132');
  w(path.join(fragDir, '1115.md'), '### Added\n- entry1115');
  const archive = path.join(dir, 'archive');
  A.aggregate({ dir: fragDir, changelog, archiveTo: archive });
  expect(fs.existsSync(path.join(archive, '1132.md'))).toBe(true);
  expect(fs.existsSync(path.join(archive, '1115.md'))).toBe(true);
  const c = fs.readFileSync(changelog, 'utf-8');
  expect(c.indexOf('entry1115')).toBeLessThan(c.indexOf('entry1132'));
  cleanup();
});

test('spliceIntoChangelog: throws when file lacks canonical header', () => {
  expect(() => A.spliceIntoChangelog('content', '/nonexistent/x')).not.toThrow();
  const { changelog, cleanup } = mk();
  w(changelog, 'not the right header');
  expect(() => A.spliceIntoChangelog('content', changelog)).toThrow(/CHANGELOG\.md missing header/);
  cleanup();
});

test('T3: fragment containing H1 is rejected with clear error', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '# bad H1 in fragment\n\n### Added\n- x');
  expect(() => A.aggregate({ dir: fragDir, changelog })).toThrow(/T3-h1-in-fragment/);
  expect(fs.existsSync(path.join(fragDir, '1132.md'))).toBe(true);
  cleanup();
});

test('T3: fragment containing H2 is rejected (release-headers are aggregator-managed)', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '## [1.2.3]\n\n### Added\n- x');
  expect(() => A.aggregate({ dir: fragDir, changelog })).toThrow(/T3-h2-in-fragment/);
  cleanup();
});

test('T4: fragment with bad top-level (H4) is rejected', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '#### Wrong\n- entry');
  expect(() => A.aggregate({ dir: fragDir, changelog })).toThrow(/T4-bad-top-level/);
  cleanup();
});

test('T4: fragment with heading-increment skip (H3 → H5) is rejected', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n##### too deep\n- entry');
  expect(() => A.aggregate({ dir: fragDir, changelog })).toThrow(/T4-heading-increment-skip/);
  cleanup();
});

test('validateOnly mode reports counts without mutating state', () => {
  const { fragDir, changelog, cleanup } = mk();
  w(path.join(fragDir, '1132.md'), '### Added\n- ok');
  const before = fs.readFileSync(changelog, 'utf-8');
  const r = A.aggregate({ dir: fragDir, changelog, validateOnly: true });
  expect(r.validateOnly).toBe(true); expect(r.count).toBe(1);
  expect(fs.readFileSync(changelog, 'utf-8')).toBe(before);
  expect(fs.existsSync(path.join(fragDir, '1132.md'))).toBe(true);
  cleanup();
});

test('validator.validateText: standalone H3 fragment passes (positive case)', () => {
  const r = V.validateText('### Added\n- item');
  expect(r.ok).toBe(true);
  expect(r.violations).toEqual([]);
});

test('validator.parseHeadings: ignores headings inside code blocks', () => {
  const text = '### Real\n\n```\n# fake H1\n## fake H2\n```\n\n### Also real';
  const headings = V.parseHeadings(text);
  expect(headings.map(h => h.text)).toEqual(['Real', 'Also real']);
});
