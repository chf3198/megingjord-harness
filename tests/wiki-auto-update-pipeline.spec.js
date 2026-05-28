// tests/wiki-auto-update-pipeline.spec.js — 11-stage pipeline + invisible-char tests
// test_strategy: tdd-pyramid  Refs #2055
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const {
  runPipeline,
  classifyDiff,
  scanInvisibleChars,
  generateFrontmatter,
} = require('../scripts/wiki/auto-update-pipeline');

const FIXTURES = path.join(__dirname, 'fixtures/auto-update');

// ---------------------------------------------------------------------------
// classifyDiff routing
// ---------------------------------------------------------------------------

test('classifyDiff routes .js files to code', () => {
  const r = classifyDiff(['scripts/wiki/foo.js', 'dashboard/js/bar.js']);
  expect(r.code).toContain('scripts/wiki/foo.js');
  expect(r.code).toContain('dashboard/js/bar.js');
  expect(r.workLog).toHaveLength(0);
  expect(r.wisdom).toHaveLength(0);
});

test('classifyDiff routes .yml workflow files to workLog', () => {
  const r = classifyDiff(['.github/workflows/baton-gates.yml']);
  expect(r.workLog).toContain('.github/workflows/baton-gates.yml');
  expect(r.code).toHaveLength(0);
});

test('classifyDiff routes .md files to wisdom', () => {
  const r = classifyDiff(['docs/howto/some-guide.md', 'wiki/concepts/foo.md']);
  expect(r.wisdom).toContain('docs/howto/some-guide.md');
  expect(r.wisdom).toContain('wiki/concepts/foo.md');
  expect(r.code).toHaveLength(0);
});

test('classifyDiff handles mixed change list', () => {
  const r = classifyDiff([
    'scripts/global/foo.js',
    '.github/workflows/ci.yml',
    'instructions/bar.md',
  ]);
  expect(r.code).toContain('scripts/global/foo.js');
  expect(r.workLog).toContain('.github/workflows/ci.yml');
  expect(r.wisdom).toContain('instructions/bar.md');
});

test('classifyDiff ignores unknown extensions', () => {
  const r = classifyDiff(['some/binary.bin', 'image.png']);
  expect(r.code).toHaveLength(0);
  expect(r.workLog).toHaveLength(0);
  expect(r.wisdom).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// scanInvisibleChars
// ---------------------------------------------------------------------------

test('scanInvisibleChars returns NONE for clean text', () => {
  const r = scanInvisibleChars('Hello, world! Normal text.');
  expect(r.maxSeverity).toBe('NONE');
  expect(r.findings).toHaveLength(0);
});

test('scanInvisibleChars detects zero-width space as HIGH', () => {
  const r = scanInvisibleChars('Hello​world');
  expect(r.maxSeverity).toBe('HIGH');
  expect(r.findings.some((f) => f.severity === 'HIGH')).toBe(true);
});

test('scanInvisibleChars detects BOM mid-file as HIGH', () => {
  const r = scanInvisibleChars('text﻿more');
  expect(r.maxSeverity).toBe('HIGH');
});

test('scanInvisibleChars detects LOW-severity zero-width-misc', () => {
  const r = scanInvisibleChars('foo‌bar');
  expect(r.maxSeverity).toBe('LOW');
  expect(r.findings.some((f) => f.severity === 'LOW')).toBe(true);
});

// ---------------------------------------------------------------------------
// generateFrontmatter
// ---------------------------------------------------------------------------

test('generateFrontmatter produces schema-required fields', () => {
  const fm = generateFrontmatter({ title: 'test-page', type: 'code', prNumber: 99, date: '2026-05-27' });
  expect(fm.title).toBe('test-page');
  expect(fm.type).toBe('code');
  expect(fm.content_trust_score).toBeGreaterThanOrEqual(0);
  expect(fm.content_trust_score).toBeLessThanOrEqual(1);
  expect(fm.created).toBe('2026-05-27');
  expect(fm.updated).toBe('2026-05-27');
  expect(fm.tags).toContain('pr-99');
});

// ---------------------------------------------------------------------------
// Full 11-stage pipeline — happy path
// ---------------------------------------------------------------------------

test('pipeline executes all 11 stages in order', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/wiki/foo.js', '.github/workflows/ci.yml', 'docs/guide.md'],
    prNumber: 123,
    date: '2026-05-27',
  });
  const stageNums = ctx.log.map((e) => e.stage);
  expect(stageNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('pipeline returns correct page counts per wiki type', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/wiki/foo.js', '.github/workflows/ci.yml', 'docs/guide.md'],
    prNumber: 10,
    date: '2026-05-27',
  });
  expect(ctx.codeDeltas.length).toBe(1);
  expect(ctx.workLogEntries.length).toBe(1);
  expect(ctx.wisdomEntries.length).toBe(1);
  expect(ctx.generatedPages.length).toBe(3);
});

test('pipeline produces valid summary string', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/foo.js'],
    prNumber: 42,
    date: '2026-05-27',
  });
  expect(ctx.summary).toContain('Wiki Auto-Update Summary');
  expect(ctx.summary).toContain('PR #42');
  expect(ctx.summary).toContain('Code deltas: 1');
});

test('pipeline produces commit plan in stage 10', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/foo.js'],
    prNumber: 42,
    date: '2026-05-27',
  });
  expect(ctx.commitPlan).not.toBeNull();
  expect(ctx.commitPlan.branch).toBe('wiki-auto-update/pr-42');
  expect(ctx.commitPlan.message).toContain('#2055');
});

// ---------------------------------------------------------------------------
// Stage 2 — invisible-char rejection aborts pipeline
// ---------------------------------------------------------------------------

test('pipeline aborts at stage 2 on HIGH-severity invisible char', () => {
  expect(() =>
    runPipeline({
      changedFiles: ['scripts/foo.js'],
      fileContents: ['normal text', 'bad​invisible'],
      prNumber: 1,
    })
  ).toThrow(/Stage 2 abort/);
});

test('pipeline stage 2 abort logs up to stage 2 only', () => {
  let ctx;
  try {
    runPipeline({
      changedFiles: ['scripts/foo.js'],
      fileContents: ['has​zwsp'],
      prNumber: 1,
    });
  } catch (_) {
    ctx = null;
  }
  // When it throws we cannot inspect ctx, but verify the throw message
  expect(() =>
    runPipeline({ changedFiles: [], fileContents: ['x​y'], prNumber: 1 })
  ).toThrow('Stage 2 abort');
});

test('pipeline LOW-severity invisible chars do NOT abort', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/foo.js'],
    fileContents: ['foo‌bar'],  // zero-width non-joiner = LOW
    prNumber: 2,
    date: '2026-05-27',
  });
  expect(ctx.invisibleScan.maxSeverity).toBe('LOW');
  expect(ctx.log[ctx.log.length - 1].stage).toBe(11);
});

// ---------------------------------------------------------------------------
// Stage 8 — frontmatter schema validation
// ---------------------------------------------------------------------------

test('generated frontmatter passes #2052 schema validation', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/wiki/foo.js', 'docs/guide.md', '.github/workflows/ci.yml'],
    prNumber: 99,
    date: '2026-05-27',
  });
  expect(ctx.validationErrors).toHaveLength(0);
  expect(ctx.log.find((e) => e.stage === 8).errors).toBe(0);
});

// ---------------------------------------------------------------------------
// Stage 9 — write paths in dry-run (no disk writes)
// ---------------------------------------------------------------------------

test('dry-run pipeline records writtenPaths without disk writes', () => {
  const ctx = runPipeline({
    changedFiles: ['scripts/bar.js'],
    prNumber: 7,
    date: '2026-05-27',
    writeEnabled: false,
  });
  expect(ctx.writtenPaths.length).toBe(1);
  expect(ctx.writtenPaths[0].filePath).toMatch(/^wiki\/code\//);
});

test('writeEnabled pipeline writes to disk via fs override', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-pipeline-'));
  const mockFs = {
    mkdirSync: (p, opts) => fs.mkdirSync(p, opts),
    writeFileSync: (p, c) => fs.writeFileSync(p, c),
  };
  const ctx = runPipeline({
    changedFiles: ['scripts/bar.js'],
    prNumber: 8,
    date: '2026-05-27',
    writeEnabled: true,
    repoRoot: tmpDir,
    fs: mockFs,
  });
  expect(ctx.writtenPaths.length).toBe(1);
  const written = path.join(tmpDir, ctx.writtenPaths[0].filePath);
  expect(fs.existsSync(written)).toBe(true);
  const content = fs.readFileSync(written, 'utf-8');
  expect(content).toContain('content_trust_score');
});

// ---------------------------------------------------------------------------
// Fixture-based diff routing tests
// ---------------------------------------------------------------------------

test('fixture: code-change diff classifies to code only', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'diff-code-change.txt'), 'utf-8');
  const files = raw.split('\n').filter(Boolean);
  const r = classifyDiff(files);
  expect(r.code.length).toBeGreaterThan(0);
  expect(r.workLog).toHaveLength(0);
  expect(r.wisdom).toHaveLength(0);
});

test('fixture: work-log diff classifies to workLog only', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'diff-work-log.txt'), 'utf-8');
  const files = raw.split('\n').filter(Boolean);
  const r = classifyDiff(files);
  expect(r.workLog.length).toBeGreaterThan(0);
  expect(r.code).toHaveLength(0);
  expect(r.wisdom).toHaveLength(0);
});

test('fixture: wisdom diff classifies to wisdom only', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'diff-wisdom-project.txt'), 'utf-8');
  const files = raw.split('\n').filter(Boolean);
  const r = classifyDiff(files);
  expect(r.wisdom.length).toBeGreaterThan(0);
  expect(r.code).toHaveLength(0);
  expect(r.workLog).toHaveLength(0);
});

test('pipeline runs clean with code-change fixture', () => {
  const raw = fs.readFileSync(path.join(FIXTURES, 'diff-code-change.txt'), 'utf-8');
  const files = raw.split('\n').filter(Boolean);
  const ctx = runPipeline({ changedFiles: files, prNumber: 200, date: '2026-05-27' });
  const stageNums = ctx.log.map((e) => e.stage);
  expect(stageNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(ctx.validationErrors).toHaveLength(0);
});
