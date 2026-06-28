// proof-report.js — Emits a machine-readable proof report (JSON).
// Writes to generated/baton-fsm-proof-report.json for CI artifact upload.
// Refs #3289, Epic #3284.
'use strict';

const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { checkInvariants } = require('./model-checker');

const REPORT_DIR = join(__dirname, '..', '..', '..', '..', 'generated');
const REPORT_FILENAME = 'baton-fsm-proof-report.json';

module.exports = { generateReport, writeReport };

/**
 * Generate the proof report object (no IO).
 * @returns {object} The structured proof report.
 */
function generateReport() {
  const result = checkInvariants();
  const invariantSummary = {};
  for (const [key, value] of Object.entries(result.invariants)) {
    invariantSummary[key] = {
      proven: value.proven,
      counterexample: value.counterexample || null,
    };
  }
  return {
    schema: 'baton-fsm-proof-v1',
    timestamp: new Date().toISOString(),
    allProven: result.allProven,
    invariants: invariantSummary,
    stats: result.stats,
  };
}

/**
 * Write the proof report to the generated/ directory.
 * @param {string} [outputDir] Override output directory.
 * @returns {string} Path to the written report.
 */
function writeReport(outputDir) {
  const targetDir = outputDir || REPORT_DIR;
  mkdirSync(targetDir, { recursive: true });
  const reportPath = join(targetDir, REPORT_FILENAME);
  const report = generateReport();
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return reportPath;
}

// CLI entry point: node proof-report.js [--dir=<path>]
if (require.main === module) {
  const dirArg = process.argv.find(
    arg => arg.startsWith('--dir=')
  );
  const customDir = dirArg ? dirArg.split('=')[1] : undefined;
  const outputPath = writeReport(customDir);
  const report = JSON.parse(
    require('node:fs').readFileSync(outputPath, 'utf8')
  );
  const status = report.allProven ? 'ALL PROVEN' : 'VIOLATION DETECTED';
  process.stdout.write(
    'Proof report: ' + status + ' -> ' + outputPath + '\n'
  );
  if (!report.allProven) process.exit(1);
}
