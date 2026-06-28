// conformance-runner.js — Runs corpus cases through JS and WASM kernels.
// Asserts byte-identical results between runtimes AND vs expected.
// Refs #3288, Epic #3284.
'use strict';

const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { decide, unpack, REASON_ILLEGAL_TRANSITION, REASON_NONE } = require('./kernel');
const { DECISIONS, EVIDENCE_BIT_NAMES } = require('./transitions');

const DEFAULT_CORPUS_DIR = join(
  __dirname, '..', '..', '..', 'tests', 'fixtures', 'baton-fsm-corpus'
);

/**
 * Load all corpus JSON files from a directory.
 * Returns a flat array of all test cases with their source category.
 */
function loadCorpus(corpusDir) {
  const files = readdirSync(corpusDir).filter(
    (fileName) => fileName.endsWith('.json')
  );
  const allCases = [];
  for (const fileName of files) {
    const category = fileName.replace('.json', '');
    const filePath = join(corpusDir, fileName);
    const cases = JSON.parse(readFileSync(filePath, 'utf8'));
    for (const testCase of cases) {
      allCases.push({ ...testCase, category });
    }
  }
  return allCases;
}

/**
 * Map an expected reason string to its numeric reasonCode.
 */
function reasonStringToCode(reasonStr) {
  if (reasonStr === 'none') return REASON_NONE;
  if (reasonStr === 'illegal-transition') return REASON_ILLEGAL_TRANSITION;
  // Look up by evidence bit name
  for (const [bitIdxStr, bitNameStr] of Object.entries(EVIDENCE_BIT_NAMES)) {
    if (bitNameStr === reasonStr) return parseInt(bitIdxStr, 10);
  }
  return -1;
}

/**
 * Check a single test case result against expected values.
 * Returns null on pass, or an error description string on mismatch.
 */
function checkExpected(testCase, unpacked) {
  const expected = testCase.expected;
  if (unpacked.decision !== expected.decision) {
    return 'decision: got ' + unpacked.decision + ' want ' + expected.decision;
  }
  if (expected.reason) {
    const expectedReasonCode = reasonStringToCode(expected.reason);
    if (unpacked.reasonCode !== expectedReasonCode) {
      return 'reason: got ' + unpacked.reasonName + '(' + unpacked.reasonCode +
        ') want ' + expected.reason + '(' + expectedReasonCode + ')';
    }
  }
  if (expected.required_next !== undefined) {
    if (unpacked.requiredNext !== expected.required_next) {
      return 'required_next: got ' + unpacked.requiredNext +
        ' want ' + expected.required_next;
    }
  }
  return null;
}

/**
 * Run conformance over a corpus directory using JS kernel only.
 * Returns {total, passed, failed, failures[]}.
 */
function runConformanceJsOnly(corpusDir) {
  const cases = loadCorpus(corpusDir || DEFAULT_CORPUS_DIR);
  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const testCase of cases) {
    const jsPacked = decide(testCase.state, testCase.event, testCase.evidence);
    const jsUnpacked = unpack(jsPacked);
    const errorMsg = checkExpected(testCase, jsUnpacked);
    if (errorMsg) {
      failed++;
      failures.push({ name: testCase.name, category: testCase.category, error: errorMsg });
    } else {
      passed++;
    }
  }

  return { total: cases.length, passed, failed, mismatches: 0, failures };
}

/**
 * Load the WASM kernel decide function from disk.
 */
async function loadWasmDecide() {
  const wasmPath = join(__dirname, 'kernel.wasm');
  const wasmBytes = readFileSync(wasmPath);
  const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
  return wasmModule.instance.exports.decide;
}

/**
 * Evaluate one corpus case against both JS and WASM kernels.
 * Returns null on pass, or a failure descriptor object.
 */
function evaluateCase(testCase, wasmDecide) {
  const jsPacked = decide(testCase.state, testCase.event, testCase.evidence);
  const wasmPacked = wasmDecide(testCase.state, testCase.event, testCase.evidence);
  if (jsPacked !== wasmPacked) {
    return { mismatch: true, error: 'JS/WASM mismatch: js=' + jsPacked + ' wasm=' + wasmPacked };
  }
  const errorMsg = checkExpected(testCase, unpack(jsPacked));
  if (errorMsg) return { mismatch: false, error: errorMsg };
  return null;
}

/**
 * Run full conformance: JS kernel + WASM kernel, check byte-identity and expected.
 * Returns {total, passed, failed, mismatches, failures[]}.
 */
async function runConformance(corpusDir) {
  const cases = loadCorpus(corpusDir || DEFAULT_CORPUS_DIR);
  const wasmDecide = await loadWasmDecide();
  let passed = 0, failed = 0, mismatches = 0;
  const failures = [];
  for (const testCase of cases) {
    const result = evaluateCase(testCase, wasmDecide);
    if (result) {
      failed++;
      if (result.mismatch) mismatches++;
      failures.push({ name: testCase.name, category: testCase.category, error: result.error });
    } else {
      passed++;
    }
  }
  return { total: cases.length, passed, failed, mismatches, failures };
}

/**
 * Build a WASM integrity result object.
 */
function integrityResult(pass, reason, committedSize, rebuiltSize) {
  return { pass, reason, committedSize, rebuiltSize };
}

/**
 * Find the offset of the first byte where two buffers differ.
 */
function findFirstDiffOffset(bufferA, bufferB) {
  for (let idx = 0; idx < bufferA.length; idx++) {
    if (bufferA[idx] !== bufferB[idx]) return idx;
  }
  return -1;
}

/**
 * Verify deployed WASM integrity: rebuild from transitions and compare byte-for-byte
 * against the committed kernel.wasm. AC3 deployed-WASM integrity check.
 */
async function deployedWasmIntegrity() {
  const { buildWasm } = require('./build-wasm');
  const committedPath = join(__dirname, 'kernel.wasm');
  const committedBytes = readFileSync(committedPath);
  const rebuiltBytes = buildWasm();
  const cSize = committedBytes.length;
  const rSize = rebuiltBytes.length;
  if (cSize !== rSize) {
    return integrityResult(false, 'size-mismatch: committed=' + cSize + ' rebuilt=' + rSize, cSize, rSize);
  }
  if (!committedBytes.equals(rebuiltBytes)) {
    const diffAt = findFirstDiffOffset(committedBytes, rebuiltBytes);
    return integrityResult(false, 'byte-mismatch at offset ' + diffAt, cSize, rSize);
  }
  return integrityResult(true, 'byte-identical', cSize, rSize);
}

if (require.main === module) {
  (async () => {
    const result = await runConformance();
    console.log(JSON.stringify(result, null, 2));
    if (result.failed !== 0) process.exit(1);
  })();
}

module.exports = { runConformance, runConformanceJsOnly, deployedWasmIntegrity, loadCorpus };
