// baton-fsm-wasm-integrity.spec.js — Deployed WASM integrity tests.
// Asserts committed kernel.wasm matches a fresh rebuild (positive)
// and detects byte-level mutation (negative). Refs #3288, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { deployedWasmIntegrity } = require(
  '../scripts/global/baton-fsm/conformance-runner'
);

describe('baton-fsm WASM integrity', function () {

  it('deployedWasmIntegrity passes for committed kernel.wasm', async function () {
    const result = await deployedWasmIntegrity();
    assert.equal(result.pass, true,
      'WASM integrity check failed: ' + result.reason);
    assert.equal(result.reason, 'byte-identical');
    assert.ok(result.committedSize > 0, 'Committed WASM must be non-empty');
    assert.equal(result.committedSize, result.rebuiltSize,
      'Size mismatch: committed=' + result.committedSize +
      ' rebuilt=' + result.rebuiltSize);
  });

  it('detects mutation when a byte is flipped (negative test)', async function () {
    // Read the committed WASM, flip one byte, write to a temp path,
    // then call the integrity check with a patched reader.
    const wasmPath = join(__dirname, '..', 'scripts', 'global', 'baton-fsm', 'kernel.wasm');
    const originalBytes = readFileSync(wasmPath);
    assert.ok(originalBytes.length > 20,
      'WASM file too small to be valid: ' + originalBytes.length + ' bytes');

    // Create a mutated copy by flipping a byte in the data section
    // (toward the end of the file to avoid corrupting the WASM header)
    const mutatedBytes = Buffer.from(originalBytes);
    const flipOffset = mutatedBytes.length - 10;
    mutatedBytes[flipOffset] = mutatedBytes[flipOffset] ^ 0xFF;

    // Verify the mutated buffer differs from original
    assert.ok(!originalBytes.equals(mutatedBytes),
      'Mutation must produce a different buffer');

    // Temporarily replace the committed file, check integrity, restore
    const { writeFileSync } = require('node:fs');
    writeFileSync(wasmPath, mutatedBytes);
    try {
      const result = await deployedWasmIntegrity();
      assert.equal(result.pass, false,
        'Integrity check should FAIL on mutated WASM');
      assert.ok(
        result.reason.includes('byte-mismatch') || result.reason.includes('size-mismatch'),
        'Reason should indicate mismatch, got: ' + result.reason
      );
    } finally {
      // Restore the original WASM file
      writeFileSync(wasmPath, originalBytes);
    }
  });
});
