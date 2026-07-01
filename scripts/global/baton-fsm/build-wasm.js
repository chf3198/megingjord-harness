#!/usr/bin/env node
// build-wasm.js — Pure-JS WebAssembly binary encoder for the baton-FSM kernel.
// Zero external dependencies. Emits kernel.wasm. Refs #3287, Epic #3284.
//
// The generated WASM module exports decide(i32, i32, i32) -> i32 that reproduces
// kernel.js packed results EXACTLY. The transition table is serialized into the
// WASM data section as flat records [fromState, event, toState, requiredMask].
'use strict';

const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { TRANSITIONS } = require('./transitions');
const kernelJs = require('./kernel');

// ---- LEB128 encoding helpers ----

function encodeLEB128Unsigned(value) {
  const bytes = [];
  let val = value;
  do {
    let byteVal = val & 0x7F;
    val = val >>> 7;
    if (val !== 0) byteVal |= 0x80;
    bytes.push(byteVal);
  } while (val !== 0);
  return bytes;
}

function encodeLEB128Signed(value) {
  const bytes = [];
  let val = value;
  let more = true;
  while (more) {
    let byteVal = val & 0x7F;
    val = val >> 7;
    if ((val === 0 && (byteVal & 0x40) === 0) ||
        (val === -1 && (byteVal & 0x40) !== 0)) {
      more = false;
    } else {
      byteVal |= 0x80;
    }
    bytes.push(byteVal);
  }
  return bytes;
}

// ---- WASM section helpers ----

function makeSection(sectionId, content) {
  const sizeBytes = encodeLEB128Unsigned(content.length);
  return [sectionId, ...sizeBytes, ...content];
}

function encodeString(str) {
  const encoded = Buffer.from(str, 'utf8');
  return [...encodeLEB128Unsigned(encoded.length), ...encoded];
}

function encodeVector(items) {
  return [...encodeLEB128Unsigned(items.length), ...items.flat()];
}

// ---- WASM module constants ----
const DECISION_ALLOW = 1;
const DECISION_DENY = 2;
const REASON_ILLEGAL = 255;
const WASM_EVIDENCE_BIT_COUNT = 11;
// pack(DENY, ILLEGAL, 0) precomputed for terminal/illegal returns
const TERMINAL_PACKED = (DECISION_DENY & 0xF) | ((REASON_ILLEGAL & 0xFF) << 4);

// ---- Bytecode emitter: terminal state check ----

function emitTerminalCheck(bytecode) {
  bytecode.push(0x20, 0x00); // local.get 0 (state)
  bytecode.push(0x41, ...encodeLEB128Signed(7)); // i32.const 7
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x20, 0x00); // local.get 0
  bytecode.push(0x41, ...encodeLEB128Signed(8)); // i32.const 8
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x72); // i32.or
  bytecode.push(0x04, 0x40); // if (void)
  bytecode.push(0x41, ...encodeLEB128Signed(TERMINAL_PACKED));
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if
}

// ---- Bytecode emitter: search loop inner body ----

function emitSearchLoopBody(bytecode, tableCount) {
  // if loopIdx >= tableCount -> br 1 (exit block)
  bytecode.push(0x20, 0x03); // local.get 3 (loopIdx)
  bytecode.push(0x41, ...encodeLEB128Signed(tableCount));
  bytecode.push(0x4F); // i32.ge_u
  bytecode.push(0x0D, 0x01); // br_if 1 (exit $outer block)
  // memOffset = loopIdx * 16
  bytecode.push(0x20, 0x03);
  bytecode.push(0x41, ...encodeLEB128Signed(16));
  bytecode.push(0x6C); // i32.mul
  bytecode.push(0x21, 0x09); // local.set 9 (memOffset)
}

// ---- Bytecode emitter: match check inside loop ----

function emitMatchCheck(bytecode) {
  // if (memory[offset+0] == state)
  bytecode.push(0x20, 0x09); // local.get 9
  bytecode.push(0x28, 0x02, 0x00); // i32.load align=4 offset=0
  bytecode.push(0x20, 0x00); // local.get 0 (state)
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if $if1
  //   if (memory[offset+4] == event)
  bytecode.push(0x20, 0x09);
  bytecode.push(0x28, 0x02, 0x04); // i32.load align=4 offset=4
  bytecode.push(0x20, 0x01); // local.get 1 (event)
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if $if2
  //     matchedToState = memory[offset+8]
  bytecode.push(0x20, 0x09);
  bytecode.push(0x28, 0x02, 0x08);
  bytecode.push(0x21, 0x04); // local.set 4
  //     matchedReqMask = memory[offset+12]
  bytecode.push(0x20, 0x09);
  bytecode.push(0x28, 0x02, 0x0C);
  bytecode.push(0x21, 0x05); // local.set 5
  //     found = 1
  bytecode.push(0x41, 0x01);
  bytecode.push(0x21, 0x06);
  //     br 3 -> exit $outer block
  bytecode.push(0x0C, 0x03);
  bytecode.push(0x0B); // end $if2
  bytecode.push(0x0B); // end $if1
}

// ---- Bytecode emitter: full search loop ----

function emitSearchLoop(bytecode, tableCount) {
  // Initialize: loopIdx=0, found=0
  bytecode.push(0x41, 0x00);
  bytecode.push(0x21, 0x03); // local.set 3 (loopIdx)
  bytecode.push(0x41, 0x00);
  bytecode.push(0x21, 0x06); // local.set 6 (found)
  // block $outer { loop $inner { ... } }
  bytecode.push(0x02, 0x40); // block $outer
  bytecode.push(0x03, 0x40); // loop $inner
  emitSearchLoopBody(bytecode, tableCount);
  emitMatchCheck(bytecode);
  // loopIdx++
  bytecode.push(0x20, 0x03);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x6A); // i32.add
  bytecode.push(0x21, 0x03);
  // br 0 -> continue loop
  bytecode.push(0x0C, 0x00);
  bytecode.push(0x0B); // end loop $inner
  bytecode.push(0x0B); // end block $outer
}

// ---- Bytecode emitter: evidence mask check ----

function emitEvidenceCheck(bytecode) {
  // if ((evidence & reqMask) == reqMask) -> return pack(ALLOW, 0, toState)
  bytecode.push(0x20, 0x02); // local.get 2 (evidence)
  bytecode.push(0x20, 0x05); // local.get 5 (reqMask)
  bytecode.push(0x71); // i32.and
  bytecode.push(0x20, 0x05);
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if void
  // pack(ALLOW, 0, toState) = 1 | (toState << 12)
  bytecode.push(0x41, ...encodeLEB128Signed(DECISION_ALLOW));
  bytecode.push(0x20, 0x04); // local.get 4 (toState)
  bytecode.push(0x41, ...encodeLEB128Signed(12));
  bytecode.push(0x74); // i32.shl
  bytecode.push(0x72); // i32.or
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if
}

// ---- Bytecode emitter: compute missing evidence mask ----

function emitComputeMissingMask(bytecode) {
  // missing = reqMask & ~evidence; bitIdx = 0
  bytecode.push(0x20, 0x05);
  bytecode.push(0x20, 0x02);
  bytecode.push(0x41, ...encodeLEB128Signed(-1));
  bytecode.push(0x73); // i32.xor (~evidence)
  bytecode.push(0x71); // i32.and
  bytecode.push(0x21, 0x07); // local.set 7 (missing)
  bytecode.push(0x41, 0x00);
  bytecode.push(0x21, 0x08); // local.set 8 (bitIdx = 0)
}

// ---- Bytecode emitter: find first missing bit ----

function emitMissingBitScan(bytecode) {
  emitComputeMissingMask(bytecode);
  // bit-scan loop
  bytecode.push(0x02, 0x40); // block
  bytecode.push(0x03, 0x40); // loop
  bytecode.push(0x20, 0x08);
  bytecode.push(0x41, ...encodeLEB128Signed(WASM_EVIDENCE_BIT_COUNT));
  bytecode.push(0x4F); // i32.ge_u
  bytecode.push(0x0D, 0x01); // br_if 1
  bytecode.push(0x20, 0x07);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x20, 0x08);
  bytecode.push(0x74); // i32.shl
  bytecode.push(0x71); // i32.and
  bytecode.push(0x0D, 0x01); // br_if 1 (exit block)
  bytecode.push(0x20, 0x08);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x6A);
  bytecode.push(0x21, 0x08);
  bytecode.push(0x0C, 0x00); // br 0 (continue loop)
  bytecode.push(0x0B); // end loop
  bytecode.push(0x0B); // end block
}

// ---- Bytecode emitter: return packed deny result ----

function emitDenyReturn(bytecode) {
  // return pack(DENY, bitIdx, toState) = 2 | (bitIdx << 4) | (toState << 12)
  bytecode.push(0x41, ...encodeLEB128Signed(DECISION_DENY));
  bytecode.push(0x20, 0x08); // bitIdx
  bytecode.push(0x41, ...encodeLEB128Signed(4));
  bytecode.push(0x74); // shl
  bytecode.push(0x72); // or
  bytecode.push(0x20, 0x04); // toState
  bytecode.push(0x41, ...encodeLEB128Signed(12));
  bytecode.push(0x74); // shl
  bytecode.push(0x72); // or
  bytecode.push(0x0B); // end function
}

// ---- Build the decide function body ----

function buildDecideFuncBody(tableCount) {
  const bytecode = [];
  // Declare 7 local i32 variables (params are 0,1,2; locals start at 3)
  bytecode.push(1); // 1 local declaration group
  bytecode.push(7); // 7 locals
  bytecode.push(0x7F); // type i32
  emitTerminalCheck(bytecode);
  emitSearchLoop(bytecode, tableCount);
  // After loop: if !found -> return illegal
  bytecode.push(0x20, 0x06); // local.get 6 (found)
  bytecode.push(0x45); // i32.eqz
  bytecode.push(0x04, 0x40); // if void
  bytecode.push(0x41, ...encodeLEB128Signed(TERMINAL_PACKED));
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if
  emitEvidenceCheck(bytecode);
  emitMissingBitScan(bytecode);
  emitDenyReturn(bytecode);
  return bytecode;
}

// ---- Build transition table data segment ----

function buildTableData(tableEntries) {
  const tableDataFlat = [];
  for (const entry of tableEntries) {
    for (const val of entry) {
      // Little-endian i32
      tableDataFlat.push(val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF);
    }
  }
  return tableDataFlat;
}

// ---- Build WASM sections ----

function buildWasmSections(tableCount) {
  // Type section: (i32, i32, i32) -> i32
  const funcType = [0x60, 3, 0x7F, 0x7F, 0x7F, 1, 0x7F];
  const typeSection = makeSection(1, encodeVector([funcType]));
  // Function section (1 function, type index 0)
  const funcSection = makeSection(3, encodeVector([[0]]));
  // Memory section (1 page min)
  const memorySection = makeSection(5, encodeVector([[0x00, 0x01]]));
  // Export section: decide + memory
  const decideExport = [...encodeString('decide'), 0x00, ...encodeLEB128Unsigned(0)];
  const memoryExport = [...encodeString('memory'), 0x02, ...encodeLEB128Unsigned(0)];
  const exportSection = makeSection(7, encodeVector([decideExport, memoryExport]));
  // Code section
  const funcBody = buildDecideFuncBody(tableCount);
  const funcBodyWithSize = [...encodeLEB128Unsigned(funcBody.length), ...funcBody];
  const codeSection = makeSection(10, encodeVector([funcBodyWithSize]));
  return { typeSection, funcSection, memorySection, exportSection, codeSection };
}

// ---- Build the complete WASM binary ----

function buildWasm() {
  const header = [0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];
  const tableEntries = TRANSITIONS.map(
    (row) => [row.fromState, row.event, row.toState, row.requiredMask]
  );
  const tableDataFlat = buildTableData(tableEntries);
  const sections = buildWasmSections(tableEntries.length);
  // Data section (transition table in linear memory at offset 0)
  const dataSegment = [
    0x00, 0x41, ...encodeLEB128Signed(0), 0x0B,
    ...encodeLEB128Unsigned(tableDataFlat.length), ...tableDataFlat,
  ];
  const dataSection = makeSection(11, encodeVector([dataSegment]));
  return Buffer.from([
    ...header, ...sections.typeSection, ...sections.funcSection,
    ...sections.memorySection, ...sections.exportSection,
    ...sections.codeSection, ...dataSection,
  ]);
}

// ---- Smoke tests for WASM parity ----

function runSmokeTests(wasmDecide) {
  const tests = [
    { label: 'Smoke', args: [2, 1, 1] },
    { label: 'Terminal', args: [7, 0, 0] },
    { label: 'Deny', args: [2, 1, 0] },
  ];
  for (const test of tests) {
    const jsResult = kernelJs.decide(...test.args);
    const wasmResult = wasmDecide(...test.args);
    if (jsResult !== wasmResult) {
      console.error(test.label + ' test FAILED: JS=' + jsResult + ' WASM=' + wasmResult);
      process.exit(1);
    }
    console.log(test.label + ' test PASSED: ' + jsResult);
  }
}

// ---- Main: build, validate, smoke-test ----

function main() {
  const wasmBuffer = buildWasm();
  const outPath = join(__dirname, 'kernel.wasm');
  writeFileSync(outPath, wasmBuffer);
  console.log('WASM written to ' + outPath + ' (' + wasmBuffer.length + ' bytes)');
  if (!WebAssembly.validate(wasmBuffer)) {
    console.error('WASM validation FAILED');
    process.exit(1);
  }
  console.log('WASM validation passed');
  WebAssembly.instantiate(wasmBuffer, {}).then((result) => {
    runSmokeTests(result.instance.exports.decide);
    console.log('wasm OK');
  }).catch((err) => {
    console.error('WASM instantiation FAILED:', err.message);
    process.exit(1);
  });
}

// ---- Check mode: byte-identity check without overwriting committed wasm ----
// Rebuilds from source into memory, compares byte-for-byte against committed
// kernel.wasm. Exits 0 on identical; exits 1 on mismatch.
// No external toolchain required — builder is pure JS. Refs #3457, Epic #3411.
// Avoids requiring conformance-runner to prevent circular dependency
// (conformance-runner -> build-wasm -> conformance-runner).

function checkWasmIdentity() {
  const committedPath = join(__dirname, 'kernel.wasm');
  const { existsSync, readFileSync } = require('node:fs');

  if (!existsSync(committedPath)) {
    console.log('SKIP: committed kernel.wasm not found at ' + committedPath);
    console.log('Run `npm run fsm:wasm:build` to generate it first.');
    return { skip: true };
  }

  const committedBytes = readFileSync(committedPath);
  const rebuiltBytes = buildWasm();
  const committedSize = committedBytes.length;
  const rebuiltSize = rebuiltBytes.length;

  if (committedSize !== rebuiltSize) {
    return { pass: false, reason: 'size-mismatch', committedSize, rebuiltSize };
  }
  if (!committedBytes.equals(rebuiltBytes)) {
    let diffAt = -1;
    for (let idx = 0; idx < committedBytes.length; idx++) {
      if (committedBytes[idx] !== rebuiltBytes[idx]) { diffAt = idx; break; }
    }
    return { pass: false, reason: 'byte-mismatch at offset ' + diffAt, committedSize, rebuiltSize };
  }
  return { pass: true, reason: 'byte-identical', committedSize, rebuiltSize };
}

function mainCheck() {
  const result = checkWasmIdentity();
  if (result.skip) { process.exit(0); }

  if (result.pass) {
    console.log('PASS: kernel.wasm is byte-identical to a fresh rebuild');
    console.log('  committed=' + result.committedSize + ' bytes  rebuilt=' + result.rebuiltSize + ' bytes');
    process.exit(0);
  }

  console.error('FAIL: kernel.wasm does not match a fresh rebuild');
  console.error('  reason: ' + result.reason);
  console.error('  committed=' + result.committedSize + ' bytes  rebuilt=' + result.rebuiltSize + ' bytes');
  console.error('Run `npm run fsm:wasm:build` to regenerate, then commit the updated kernel.wasm.');
  process.exit(1);
}

if (require.main === module) {
  const checkFlag = process.argv.includes('--check');
  if (checkFlag) {
    mainCheck();
  } else {
    main();
  }
}

module.exports = { buildWasm };
