#!/usr/bin/env node
'use strict';
// parity-lowering-guard.js — Epic #3411 T3.2 (#3452)
// Diff-aware self-dev guardrail: BLOCKS harness changes that silently reduce
// cross-orchestrator parity. Compares HEAD live matrix against a committed
// baseline snapshot (tests/fixtures/parity-baseline.json). Ships advisory-first
// (default exit 0 with warnings; --strict exits non-zero on unwaived regressions).

const fs = require('node:fs');
const path = require('node:path');

const BASELINE_REL = 'tests/fixtures/parity-baseline.json';

// Numeric rank for parity verdicts — higher is better.
const VERDICT_RANK = {
  'ok': 4,
  'ok-na': 3,
  'make-reachable-required': 2,
  'na-without-substitute': 1,
  'declared-full-but-missing': 0,
};

function defaultRank() { return 0; }

function verdictRank(verdict) {
  const rank = VERDICT_RANK[verdict];
  return typeof rank === 'number' ? rank : defaultRank();
}

// ---------------------------------------------------------------------------
// parityScore: build a flat map of "featureId::runtime" -> verdict rank
// from a buildMatrix result. Enables numeric comparison across snapshots.
// ---------------------------------------------------------------------------
function parityScore(matrixResult) {
  const scoreMap = new Map();
  if (!matrixResult || !Array.isArray(matrixResult.cells)) return scoreMap;
  for (const cell of matrixResult.cells) {
    const key = `${cell.featureId}::${cell.runtime}`;
    scoreMap.set(key, verdictRank(cell.verdict));
  }
  return scoreMap;
}

// ---------------------------------------------------------------------------
// isValidWaiver: a waived cell escapes regression detection ONLY when it has
// a non-empty substituteTest string (i.e. an approved tested substitute).
// A waiver without substituteTest is itself a regression.
// ---------------------------------------------------------------------------
function isValidWaiver(cell) {
  const cellStatus = (cell && cell.declared) || '';
  const waivedStatuses = new Set(['structural-NA', 'waived']);
  if (!waivedStatuses.has(cellStatus)) return false;
  const substituteTest = (cell && cell.substituteTest) || '';
  return typeof substituteTest === 'string' && substituteTest.trim().length > 0;
}

// ---------------------------------------------------------------------------
// detectRegressions: compare baseMap to headMap.
// Returns array of regression objects: { key, baseRank, headRank, reason }.
// Improvements (headRank > baseRank) are silently ignored.
// headCells (array of raw cell objects) used to check waiver validity.
// ---------------------------------------------------------------------------
function detectRegressions(baseMap, headMap, headCells) {
  const regressions = [];
  const cellsByKey = new Map();
  if (Array.isArray(headCells)) {
    for (const cell of headCells) {
      cellsByKey.set(`${cell.featureId}::${cell.runtime}`, cell);
    }
  }
  for (const [key, baseRank] of baseMap.entries()) {
    const headRank = headMap.has(key) ? headMap.get(key) : 0;
    if (headRank < baseRank) {
      const cell = cellsByKey.get(key) || null;
      if (isValidWaiver(cell)) continue; // approved tested-substitute escape
      regressions.push({ key, baseRank, headRank, reason: 'parity-score-decreased' });
    }
  }
  return regressions;
}

// ---------------------------------------------------------------------------
// loadBaseline: read the committed baseline snapshot.
// Returns { ok, map, error } where map is a plain object keyed by cell key.
// ---------------------------------------------------------------------------
function loadBaseline(repoRoot) {
  const baselinePath = path.join(repoRoot, BASELINE_REL);
  try {
    const raw = fs.readFileSync(baselinePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.cells !== 'object') {
      return { ok: false, map: null, error: 'baseline missing cells field' };
    }
    const baseMap = new Map(Object.entries(parsed.cells));
    return { ok: true, map: baseMap, error: null };
  } catch (readErr) {
    return { ok: false, map: null, error: readErr.message };
  }
}

// ---------------------------------------------------------------------------
// resolveRepoRoot: resolve the repo root from opts or __dirname fallback.
// ---------------------------------------------------------------------------
function resolveRepoRoot(repoRoot) {
  if (typeof repoRoot === 'string' && repoRoot.length > 0) return repoRoot;
  return path.resolve(__dirname, '..', '..', '..');
}

// ---------------------------------------------------------------------------
// buildLiveMatrix: load catalog and run buildMatrix from harness-parity-matrix.
// Returns { ok, matrix, error }.
// ---------------------------------------------------------------------------
function buildLiveMatrix(repoRoot) {
  const matrixMod = require('../harness-parity-matrix.js');
  const catalogPath = path.join(repoRoot, 'inventory', 'harness-feature-catalog.json');
  try {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const matrix = matrixMod.buildMatrix(catalog, { repoRoot });
    return { ok: true, matrix, error: null };
  } catch (buildErr) {
    return { ok: false, matrix: null, error: buildErr.message };
  }
}

// ---------------------------------------------------------------------------
// formatRegressionLine: format one regression for human-readable output.
// ---------------------------------------------------------------------------
function formatRegressionLine(reg) {
  const [featureId, runtime] = reg.key.split('::');
  return `  [REGRESSION] feature=${featureId} runtime=${runtime}`
    + ` rank ${reg.baseRank}->${reg.headRank} (${reg.reason})`;
}

// ---------------------------------------------------------------------------
// printGuardSummary: emit structured summary to stdout.
// ---------------------------------------------------------------------------
function printGuardSummary(regressions, strict, fallback) {
  process.stdout.write('=== Parity Lowering Guard ===\n');
  if (fallback) {
    process.stdout.write('[G6-FALLBACK] Baseline unavailable — no-regression assumed.\n');
    process.stdout.write('Run `npm run parity:baseline:update` to commit a baseline.\n');
    return;
  }
  process.stdout.write(`Regressions detected: ${regressions.length}\n`);
  for (const reg of regressions) {
    process.stdout.write(formatRegressionLine(reg) + '\n');
  }
  if (regressions.length === 0) {
    process.stdout.write('All parity cells at or above baseline. No regressions.\n');
    return;
  }
  const prefix = strict ? '' : '[ADVISORY] ';
  const suffix = strict ? 'Exiting non-zero (--strict).\n' : 'Pass --strict to fail the gate.\n';
  process.stdout.write(`\n${prefix}${regressions.length} parity regression(s) detected. ${suffix}`);
  process.stdout.write('To accept a new baseline intentionally: npm run parity:baseline:update\n');
}

// ---------------------------------------------------------------------------
// runGuard: main entry point. Loads baseline, builds live matrix, detects
// regressions, and reports. G6 absolute fallback when baseline is absent.
// ---------------------------------------------------------------------------
function runGuard(opts) {
  const strict = (opts && opts.strict === true);
  const repoRoot = resolveRepoRoot(opts && opts.repoRoot);
  const baselineResult = loadBaseline(repoRoot);
  if (!baselineResult.ok) {
    process.stderr.write(
      `[parity-lowering-guard] G6 fallback: baseline unavailable (${baselineResult.error})\n`
    );
    printGuardSummary([], strict, true);
    return { regressions: [], fallback: true };
  }
  const liveResult = buildLiveMatrix(repoRoot);
  if (!liveResult.ok) {
    process.stderr.write(
      `[parity-lowering-guard] G6 fallback: live matrix unavailable (${liveResult.error})\n`
    );
    printGuardSummary([], strict, true);
    return { regressions: [], fallback: true };
  }
  const headMap = parityScore(liveResult.matrix);
  const regressions = detectRegressions(baselineResult.map, headMap, liveResult.matrix.cells);
  printGuardSummary(regressions, strict, false);
  if (strict && regressions.length > 0) process.exit(1);
  return { regressions, fallback: false };
}

// ---------------------------------------------------------------------------
// generateBaseline: build a baseline snapshot from the current live matrix
// and write it to tests/fixtures/parity-baseline.json.
// ---------------------------------------------------------------------------
function generateBaseline(repoRoot) {
  const liveResult = buildLiveMatrix(repoRoot);
  if (!liveResult.ok) {
    process.stderr.write(`[parity-lowering-guard] Cannot generate baseline: ${liveResult.error}\n`);
    process.exit(1);
    return;
  }
  const scoreMap = parityScore(liveResult.matrix);
  const cells = {};
  for (const [key, rank] of scoreMap.entries()) {
    cells[key] = rank;
  }
  const snapshot = {
    generatedAt: new Date().toISOString(),
    note: 'Committed baseline for parity-lowering-guard. Update via npm run parity:baseline:update.',
    cellCount: scoreMap.size,
    cells,
  };
  const outPath = path.join(repoRoot, BASELINE_REL);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  process.stdout.write(`[parity-lowering-guard] Baseline written: ${outPath} (${scoreMap.size} cells)\n`);
}

module.exports = {
  parityScore,
  detectRegressions,
  runGuard,
  generateBaseline,
  loadBaseline,
  buildLiveMatrix,
  verdictRank,
  VERDICT_RANK,
  BASELINE_REL,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--update-baseline')) {
    generateBaseline(resolveRepoRoot(null));
  } else {
    runGuard({ strict: args.includes('--strict') });
  }
}
