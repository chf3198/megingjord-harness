// baton-fsm-wasm-parity.spec.js — WASM/JS byte-identical parity tests.
// Sweeps ALL (state x event x representative evidence masks). Refs #3287, Epic #3284.
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { STATES, EVENTS, EVIDENCE_BITS } = require('../scripts/global/baton-fsm/transitions');
const kernelJs = require('../scripts/global/baton-fsm/kernel');

// Representative evidence masks to test:
// - 0 (no evidence)
// - each single bit
// - all bits set
// - common required combinations from the transition table
const singleBits = Object.values(EVIDENCE_BITS);
const allBitsMask = singleBits.reduce((acc, bit) => acc | bit, 0);
const representativeMasks = [
  0,
  ...singleBits,
  allBitsMask,
  // Collaborator handoff combo
  EVIDENCE_BITS.COLLABORATOR_HANDOFF | EVIDENCE_BITS.ALL_ACS_PASS,
  // Admin handoff combo (#3051)
  EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.SIGNER_INDEPENDENT | EVIDENCE_BITS.CI_GREEN | EVIDENCE_BITS.WORKTREE_MERGE_OK,
  // Consultant closeout combo
  EVIDENCE_BITS.CONSULTANT_CLOSEOUT | EVIDENCE_BITS.PR_MERGED,
  // Merge combo
  EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.CI_GREEN | EVIDENCE_BITS.WORKTREE_MERGE_OK | EVIDENCE_BITS.SIGNER_INDEPENDENT,
  // Partial combos (missing one bit)
  EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.CI_GREEN | EVIDENCE_BITS.WORKTREE_MERGE_OK,
  EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.SIGNER_INDEPENDENT | EVIDENCE_BITS.CI_GREEN,
  EVIDENCE_BITS.CONSULTANT_CLOSEOUT,
  EVIDENCE_BITS.BATON_BACK_REASON,
  EVIDENCE_BITS.DISPOSITION_RECORDED,
];

// Deduplicate
const uniqueMasks = [...new Set(representativeMasks)];

const stateValues = Object.values(STATES);
const eventValues = Object.values(EVENTS);

let wasmDecide = null;

describe('WASM/JS byte-identical parity', () => {
  before(async () => {
    const wasmPath = join(__dirname, '..', 'scripts', 'global', 'baton-fsm', 'kernel.wasm');
    const wasmBytes = readFileSync(wasmPath);
    assert.ok(WebAssembly.validate(wasmBytes), 'kernel.wasm must validate');
    const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
    wasmDecide = wasmModule.instance.exports.decide;
  });

  it('WASM kernel.wasm loads and exports decide', () => {
    assert.ok(typeof wasmDecide === 'function', 'decide must be a function');
  });

  // Generate test for every (state, event, mask) combination
  for (const stateCode of stateValues) {
    for (const eventCode of eventValues) {
      for (const mask of uniqueMasks) {
        const testLabel = 'state=' + stateCode + ' event=' + eventCode + ' mask=0x' + mask.toString(16);
        it(testLabel, () => {
          const jsResult = kernelJs.decide(stateCode, eventCode, mask);
          const wasmResult = wasmDecide(stateCode, eventCode, mask);
          assert.equal(wasmResult, jsResult,
            testLabel + ': WASM=' + wasmResult + ' JS=' + jsResult +
            ' (JS unpacked: ' + JSON.stringify(kernelJs.unpack(jsResult)) + ')');
        });
      }
    }
  }

  it('total sweep count covers all state x event x mask combinations', () => {
    const expectedCount = stateValues.length * eventValues.length * uniqueMasks.length;
    assert.ok(expectedCount > 1000, 'sweep should cover at least 1000 combinations, got ' + expectedCount);
  });
});
