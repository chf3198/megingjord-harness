// fsm-wasm-check.spec.js — Golden byte-identity test for the build-wasm --check mode.
// Verifies: committed kernel.wasm is byte-identical to a fresh pure-JS rebuild AND
// that the --check CLI path exits correctly on match / mismatch. Refs #3457, Epic #3411.
//
// Strategy: golden-file (the committed kernel.wasm is the golden artifact).
// No external toolchain required — builder is pure JS (no wat2wasm/emscripten).
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const FSM_DIR = resolve(__dirname, '..', 'scripts', 'global', 'baton-fsm');
const BUILD_WASM_SCRIPT = join(FSM_DIR, 'build-wasm.js');
const COMMITTED_WASM_PATH = join(FSM_DIR, 'kernel.wasm');

// Invoke build-wasm.js --check as a child process and return its result.
function runCheckMode() {
  return spawnSync(process.execPath, [BUILD_WASM_SCRIPT, '--check'], {
    encoding: 'utf8',
    timeout: 15000,
  });
}

// Save and restore the committed WASM around a mutation test.
function withMutatedWasm(mutate, testFn) {
  const originalBytes = readFileSync(COMMITTED_WASM_PATH);
  const mutatedBytes = Buffer.from(originalBytes);
  mutate(mutatedBytes);
  writeFileSync(COMMITTED_WASM_PATH, mutatedBytes);
  try {
    return testFn();
  } finally {
    writeFileSync(COMMITTED_WASM_PATH, originalBytes);
  }
}

describe('fsm-wasm --check mode (golden byte-identity gate)', function () {

  it('committed kernel.wasm exists and is non-empty', function () {
    assert.ok(existsSync(COMMITTED_WASM_PATH),
      'kernel.wasm not found at ' + COMMITTED_WASM_PATH);
    const bytes = readFileSync(COMMITTED_WASM_PATH);
    assert.ok(bytes.length > 20,
      'kernel.wasm is suspiciously small: ' + bytes.length + ' bytes');
    // Verify WASM magic header: \0asm
    assert.equal(bytes[0], 0x00);
    assert.equal(bytes[1], 0x61); // 'a'
    assert.equal(bytes[2], 0x73); // 's'
    assert.equal(bytes[3], 0x6D); // 'm'
  });

  it('--check exits 0 when committed wasm matches fresh rebuild', function () {
    const result = runCheckMode();
    assert.equal(result.status, 0,
      '--check should exit 0 on byte-identical wasm.\n' +
      'stdout: ' + result.stdout + '\nstderr: ' + result.stderr);
    assert.ok(
      result.stdout.includes('PASS'),
      '--check stdout should contain PASS, got: ' + result.stdout
    );
  });

  it('--check exits 1 when committed wasm has a mutated byte', function () {
    const result = withMutatedWasm(
      (mutatedBytes) => {
        // Flip a byte near the end of the data section (avoids WASM header)
        const flipOffset = mutatedBytes.length - 10;
        mutatedBytes[flipOffset] = mutatedBytes[flipOffset] ^ 0xFF;
      },
      () => runCheckMode()
    );
    assert.equal(result.status, 1,
      '--check should exit 1 on byte-mismatch.\n' +
      'stdout: ' + result.stdout + '\nstderr: ' + result.stderr);
    assert.ok(
      result.stderr.includes('FAIL'),
      '--check stderr should contain FAIL on mismatch, got: ' + result.stderr
    );
  });

  it('--check stderr names a remediation command on mismatch', function () {
    const result = withMutatedWasm(
      (mutatedBytes) => {
        const flipOffset = mutatedBytes.length - 5;
        mutatedBytes[flipOffset] = mutatedBytes[flipOffset] ^ 0x01;
      },
      () => runCheckMode()
    );
    assert.equal(result.status, 1,
      'Expected exit 1 on mismatch');
    assert.ok(
      result.stderr.includes('fsm:wasm:build'),
      '--check stderr should suggest fsm:wasm:build, got: ' + result.stderr
    );
  });

  it('pure-JS rebuild produces byte-identical output to the committed golden', function () {
    // Direct library call — golden-file comparison without going through child process.
    const { buildWasm } = require('../scripts/global/baton-fsm/build-wasm');
    const committedBytes = readFileSync(COMMITTED_WASM_PATH);
    const rebuiltBytes = buildWasm();
    assert.equal(committedBytes.length, rebuiltBytes.length,
      'Size mismatch: committed=' + committedBytes.length +
      ' rebuilt=' + rebuiltBytes.length);
    assert.ok(committedBytes.equals(rebuiltBytes),
      'Committed kernel.wasm differs from pure-JS rebuild. ' +
      'Run `npm run fsm:wasm:build` and commit the result.');
  });

  it('committed kernel.wasm matches the golden sha256 fixture', function () {
    const crypto = require('crypto');
    const goldenLine = readFileSync(join(__dirname, 'fixtures', 'fsm-wasm-kernel.golden.sha256'), 'utf8').trim();
    const goldenHash = goldenLine.split(/\s+/)[0];
    const committedBytes = readFileSync(COMMITTED_WASM_PATH);
    const actualHash = crypto.createHash('sha256').update(committedBytes).digest('hex');
    assert.equal(actualHash, goldenHash,
      'kernel.wasm sha256 drifted from tests/fixtures/fsm-wasm-kernel.golden.sha256');
  });

});
