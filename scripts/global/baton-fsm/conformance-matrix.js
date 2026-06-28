#!/usr/bin/env node
// conformance-matrix.js — Agent x runtime conformance matrix producer.
// Executes JS and WASM locally; records python/go/rust as pending-toolchain.
// Refs #3288, Epic #3284.
'use strict';

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { runConformance } = require('./conformance-runner');

const AGENTS = Object.freeze([
  'claude-code', 'copilot', 'codex', 'antigravity', 'cursor',
]);

const EXECUTED_RUNTIMES = Object.freeze(['js', 'wasm']);

const PENDING_RUNTIMES = Object.freeze([
  { name: 'python', note: 'Python kernel port not yet implemented; toolchain pending.' },
  { name: 'go', note: 'Go kernel port not yet implemented; toolchain pending.' },
  { name: 'rust', note: 'Rust kernel port not yet implemented; toolchain pending.' },
]);

const MATRIX_OUTPUT_DIR = join(__dirname, '..', '..', '..', 'generated');
const MATRIX_FILENAME = 'baton-fsm-conformance-matrix.json';

/**
 * Build a single agent's executed-runtime cell from the conformance result.
 */
function buildExecutedCell(agent, runtime, conformanceResult) {
  return {
    agent,
    runtime,
    status: 'executed',
    total: conformanceResult.total,
    passed: conformanceResult.passed,
    failed: conformanceResult.failed,
    mismatches: conformanceResult.mismatches,
    verdict: conformanceResult.failed === 0 ? 'pass' : 'fail',
    note: 'All agents consume the same shared baton-fsm core; '
      + 'JS and WASM verdicts are byte-identical by construction.',
  };
}

/**
 * Build a single agent's pending-runtime cell.
 */
function buildPendingCell(agent, pendingRuntime) {
  return {
    agent,
    runtime: pendingRuntime.name,
    status: 'pending-toolchain',
    total: 0,
    passed: 0,
    failed: 0,
    mismatches: 0,
    verdict: 'not-executed',
    note: pendingRuntime.note,
  };
}

/**
 * Build all matrix cells for every agent across executed and pending runtimes.
 */
function buildAllCells(conformanceResult) {
  const cells = [];
  for (const agent of AGENTS) {
    for (const runtime of EXECUTED_RUNTIMES) {
      cells.push(buildExecutedCell(agent, runtime, conformanceResult));
    }
    for (const pendingRuntime of PENDING_RUNTIMES) {
      cells.push(buildPendingCell(agent, pendingRuntime));
    }
  }
  return cells;
}

/**
 * Build the matrix summary and metadata envelope.
 */
function buildMatrixEnvelope(conformanceResult, cells) {
  return {
    generated_at: new Date().toISOString(),
    schema_version: '1.0.0',
    conformance_summary: {
      total_cases: conformanceResult.total,
      js_wasm_byte_identical: conformanceResult.mismatches === 0,
      all_passed: conformanceResult.failed === 0,
    },
    agents: AGENTS,
    runtimes_executed: EXECUTED_RUNTIMES,
    runtimes_pending: PENDING_RUNTIMES.map(function (entry) { return entry.name; }),
    cells,
  };
}

/**
 * Produce the full agent x runtime conformance matrix.
 * Returns the matrix object and writes it to a JSON file.
 */
async function produceMatrix(corpusDir) {
  const conformanceResult = await runConformance(corpusDir);
  const cells = buildAllCells(conformanceResult);
  const matrix = buildMatrixEnvelope(conformanceResult, cells);
  mkdirSync(MATRIX_OUTPUT_DIR, { recursive: true });
  const outputPath = join(MATRIX_OUTPUT_DIR, MATRIX_FILENAME);
  writeFileSync(outputPath, JSON.stringify(matrix, null, 2) + '\n');
  return { matrix, outputPath };
}

if (require.main === module) {
  produceMatrix().then(function (result) {
    console.log('Matrix written to: ' + result.outputPath);
    console.log(JSON.stringify(result.matrix.conformance_summary, null, 2));
    const executedCount = result.matrix.cells.filter(
      function (cell) { return cell.status === 'executed'; }
    ).length;
    const pendingCount = result.matrix.cells.filter(
      function (cell) { return cell.status === 'pending-toolchain'; }
    ).length;
    console.log('Executed cells: ' + executedCount +
      ', Pending-toolchain cells: ' + pendingCount);
  }).catch(function (err) {
    console.error('Matrix generation failed:', err.message);
    process.exit(1);
  });
}

module.exports = { produceMatrix, AGENTS, EXECUTED_RUNTIMES, PENDING_RUNTIMES };
