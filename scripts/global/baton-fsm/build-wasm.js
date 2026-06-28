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

// ---- Build the WASM binary ----

function buildWasm() {
  // WASM magic number and version
  const header = [0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];

  // Constants matching kernel.js
  const DECISION_ALLOW = 1;
  const DECISION_DENY = 2;
  const REASON_ILLEGAL = 255;
  const EVIDENCE_BIT_COUNT = 11;

  // Transition table data: flat array of [fromState, event, toState, requiredMask]
  const tableEntries = TRANSITIONS.map(
    (row) => [row.fromState, row.event, row.toState, row.requiredMask]
  );
  const tableCount = tableEntries.length;

  // Each record is 4 x i32 = 16 bytes. Table starts at memory offset 0.
  const tableDataFlat = [];
  for (const entry of tableEntries) {
    for (const val of entry) {
      // Little-endian i32
      tableDataFlat.push(
        val & 0xFF,
        (val >> 8) & 0xFF,
        (val >> 16) & 0xFF,
        (val >> 24) & 0xFF
      );
    }
  }

  // Section 1: Type section
  // Type 0: (i32, i32, i32) -> i32
  const funcType = [0x60, 3, 0x7F, 0x7F, 0x7F, 1, 0x7F];
  const typeSection = makeSection(1, encodeVector([funcType]));

  // Section 3: Function section (1 function, type index 0)
  const funcSection = makeSection(3, encodeVector([[0]]));

  // Section 5: Memory section (define memory internally, 1 page min)
  const memorySection = makeSection(5, encodeVector([[0x00, 0x01]]));

  // Section 7: Export section
  // Export "decide" as function index 0, and "memory" as memory index 0
  const decideExport = [
    ...encodeString('decide'),
    0x00, // export kind: function
    ...encodeLEB128Unsigned(0), // function index
  ];
  const memoryExport = [
    ...encodeString('memory'),
    0x02, // export kind: memory
    ...encodeLEB128Unsigned(0), // memory index
  ];
  const exportSection = makeSection(7, encodeVector([decideExport, memoryExport]));

  // Section 10: Code section
  const funcBody = buildDecideFuncBody(
    tableCount, DECISION_ALLOW, DECISION_DENY, REASON_ILLEGAL, EVIDENCE_BIT_COUNT
  );
  const funcBodyWithSize = [
    ...encodeLEB128Unsigned(funcBody.length),
    ...funcBody,
  ];
  const codeSection = makeSection(10, encodeVector([funcBodyWithSize]));

  // Section 11: Data section (transition table in linear memory at offset 0)
  const dataSegment = [
    0x00, // active segment, memory 0
    0x41, ...encodeLEB128Signed(0), 0x0B, // i32.const 0; end
    ...encodeLEB128Unsigned(tableDataFlat.length),
    ...tableDataFlat,
  ];
  const dataSection = makeSection(11, encodeVector([dataSegment]));

  return Buffer.from([
    ...header,
    ...typeSection,
    ...funcSection,
    ...memorySection,
    ...exportSection,
    ...codeSection,
    ...dataSection,
  ]);
}

/**
 * Build the WASM function body for decide(state, event, evidence) -> i32.
 *
 * Algorithm (matches kernel.js exactly):
 *   1. Check terminal states (done=7, cancelled=8): return pack(DENY, ILLEGAL, 0)
 *   2. Loop over transition table in memory to find matching (fromState, event) row
 *   3. If no match: return pack(DENY, ILLEGAL, 0)
 *   4. If (evidence & required) === required: return pack(ALLOW, NONE, toState)
 *   5. Else: find first missing bit index, return pack(DENY, bitIdx, toState)
 *
 * Locals: param0=state, param1=event, param2=evidence
 *   local3=loopIdx, local4=matchedToState, local5=matchedReqMask,
 *   local6=found, local7=missing, local8=bitIdx, local9=memOffset
 */
function buildDecideFuncBody(tableCount, ALLOW, DENY, REASON_ILLEGAL, BIT_COUNT) {
  const bytecode = [];

  // Declare 7 local i32 variables (params are 0,1,2; locals start at 3)
  bytecode.push(1); // 1 local declaration group
  bytecode.push(7); // 7 locals
  bytecode.push(0x7F); // type i32

  // pack(DENY, ILLEGAL, 0) = (2 & 0xF) | ((255 & 0xFF) << 4) = 2 | 4080 = 4082
  const terminalPacked = (DENY & 0xF) | ((REASON_ILLEGAL & 0xFF) << 4);

  // --- Terminal state check: if (state == 7 || state == 8) return 4082 ---
  bytecode.push(0x20, 0x00); // local.get 0 (state)
  bytecode.push(0x41, ...encodeLEB128Signed(7)); // i32.const 7
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x20, 0x00); // local.get 0
  bytecode.push(0x41, ...encodeLEB128Signed(8)); // i32.const 8
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x72); // i32.or
  bytecode.push(0x04, 0x40); // if (void)
  bytecode.push(0x41, ...encodeLEB128Signed(terminalPacked)); // i32.const 4082
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if

  // --- Initialize: loopIdx=0, found=0 ---
  bytecode.push(0x41, 0x00); // i32.const 0
  bytecode.push(0x21, 0x03); // local.set 3 (loopIdx)
  bytecode.push(0x41, 0x00); // i32.const 0
  bytecode.push(0x21, 0x06); // local.set 6 (found)

  // --- Search loop ---
  // Structure: block $outer { loop $inner { ... } }
  // br 0 inside loop = continue (jump to loop top)
  // br 1 inside loop = break (jump past outer block)
  // From inside if/if: br depth must account for the if blocks too
  bytecode.push(0x02, 0x40); // block $outer (label depth=1 from loop, 3 from inner if)
  bytecode.push(0x03, 0x40); // loop $inner (label depth=0 from loop body, 2 from inner if)

  // if loopIdx >= tableCount -> br 1 (exit block)
  bytecode.push(0x20, 0x03); // local.get 3 (loopIdx)
  bytecode.push(0x41, ...encodeLEB128Signed(tableCount)); // i32.const N
  bytecode.push(0x4F); // i32.ge_u
  bytecode.push(0x0D, 0x01); // br_if 1 (exit $outer block)

  // memOffset = loopIdx * 16
  bytecode.push(0x20, 0x03); // local.get 3
  bytecode.push(0x41, ...encodeLEB128Signed(16)); // i32.const 16
  bytecode.push(0x6C); // i32.mul
  bytecode.push(0x21, 0x09); // local.set 9 (memOffset)

  // if (memory[offset+0] == state)
  bytecode.push(0x20, 0x09); // local.get 9
  bytecode.push(0x28, 0x02, 0x00); // i32.load align=4 offset=0
  bytecode.push(0x20, 0x00); // local.get 0 (state)
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if $if1 (label depth from here: 0=if1, 1=loop, 2=block)

  //   if (memory[offset+4] == event)
  bytecode.push(0x20, 0x09); // local.get 9
  bytecode.push(0x28, 0x02, 0x04); // i32.load align=4 offset=4
  bytecode.push(0x20, 0x01); // local.get 1 (event)
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if $if2 (depth: 0=if2, 1=if1, 2=loop, 3=block)

  //     matchedToState = memory[offset+8]
  bytecode.push(0x20, 0x09);
  bytecode.push(0x28, 0x02, 0x08); // i32.load align=4 offset=8
  bytecode.push(0x21, 0x04); // local.set 4

  //     matchedReqMask = memory[offset+12]
  bytecode.push(0x20, 0x09);
  bytecode.push(0x28, 0x02, 0x0C); // i32.load align=4 offset=12
  bytecode.push(0x21, 0x05); // local.set 5

  //     found = 1
  bytecode.push(0x41, 0x01);
  bytecode.push(0x21, 0x06);

  //     br 3 -> exit $outer block (past loop, past block)
  bytecode.push(0x0C, 0x03);

  bytecode.push(0x0B); // end $if2
  bytecode.push(0x0B); // end $if1

  // loopIdx = loopIdx + 1
  bytecode.push(0x20, 0x03);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x6A); // i32.add
  bytecode.push(0x21, 0x03);

  // br 0 -> continue loop (jump to $inner top)
  bytecode.push(0x0C, 0x00);

  bytecode.push(0x0B); // end loop $inner
  bytecode.push(0x0B); // end block $outer

  // --- After loop: if !found -> return illegal ---
  bytecode.push(0x20, 0x06); // local.get 6 (found)
  bytecode.push(0x45); // i32.eqz
  bytecode.push(0x04, 0x40); // if void
  bytecode.push(0x41, ...encodeLEB128Signed(terminalPacked));
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if

  // --- Evidence mask check ---
  // if ((evidence & reqMask) == reqMask) -> return pack(ALLOW, 0, toState)
  bytecode.push(0x20, 0x02); // local.get 2 (evidence)
  bytecode.push(0x20, 0x05); // local.get 5 (reqMask)
  bytecode.push(0x71); // i32.and
  bytecode.push(0x20, 0x05); // local.get 5
  bytecode.push(0x46); // i32.eq
  bytecode.push(0x04, 0x40); // if void
  // pack(ALLOW, 0, toState) = 1 | (toState << 12)
  bytecode.push(0x41, ...encodeLEB128Signed(ALLOW)); // i32.const 1
  bytecode.push(0x20, 0x04); // local.get 4 (toState)
  bytecode.push(0x41, ...encodeLEB128Signed(12)); // i32.const 12
  bytecode.push(0x74); // i32.shl
  bytecode.push(0x72); // i32.or
  bytecode.push(0x0F); // return
  bytecode.push(0x0B); // end if

  // --- Find first missing bit ---
  // missing = reqMask & ~evidence
  bytecode.push(0x20, 0x05); // local.get 5
  bytecode.push(0x20, 0x02); // local.get 2
  bytecode.push(0x41, ...encodeLEB128Signed(-1)); // i32.const -1
  bytecode.push(0x73); // i32.xor (~evidence)
  bytecode.push(0x71); // i32.and
  bytecode.push(0x21, 0x07); // local.set 7 (missing)

  // bitIdx = 0
  bytecode.push(0x41, 0x00);
  bytecode.push(0x21, 0x08);

  // bit-scan loop
  bytecode.push(0x02, 0x40); // block
  bytecode.push(0x03, 0x40); // loop

  // if bitIdx >= BIT_COUNT -> break
  bytecode.push(0x20, 0x08);
  bytecode.push(0x41, ...encodeLEB128Signed(BIT_COUNT));
  bytecode.push(0x4F); // i32.ge_u
  bytecode.push(0x0D, 0x01); // br_if 1

  // if (missing & (1 << bitIdx)) != 0 -> break (found it)
  bytecode.push(0x20, 0x07);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x20, 0x08);
  bytecode.push(0x74); // i32.shl
  bytecode.push(0x71); // i32.and
  bytecode.push(0x0D, 0x01); // br_if 1 (exit block)

  // bitIdx++
  bytecode.push(0x20, 0x08);
  bytecode.push(0x41, 0x01);
  bytecode.push(0x6A);
  bytecode.push(0x21, 0x08);

  bytecode.push(0x0C, 0x00); // br 0 (continue loop)
  bytecode.push(0x0B); // end loop
  bytecode.push(0x0B); // end block

  // return pack(DENY, bitIdx, toState) = 2 | (bitIdx << 4) | (toState << 12)
  bytecode.push(0x41, ...encodeLEB128Signed(DENY));
  bytecode.push(0x20, 0x08); // bitIdx
  bytecode.push(0x41, ...encodeLEB128Signed(4));
  bytecode.push(0x74); // shl
  bytecode.push(0x72); // or
  bytecode.push(0x20, 0x04); // toState
  bytecode.push(0x41, ...encodeLEB128Signed(12));
  bytecode.push(0x74); // shl
  bytecode.push(0x72); // or

  bytecode.push(0x0B); // end function

  return bytecode;
}

// ---- Main: build, validate, smoke-test ----

function main() {
  const wasmBuffer = buildWasm();
  const outPath = join(__dirname, 'kernel.wasm');
  writeFileSync(outPath, wasmBuffer);
  console.log('WASM written to ' + outPath + ' (' + wasmBuffer.length + ' bytes)');

  // Validate
  if (!WebAssembly.validate(wasmBuffer)) {
    console.error('WASM validation FAILED');
    process.exit(1);
  }
  console.log('WASM validation passed');

  // Instantiate and smoke-test
  WebAssembly.instantiate(wasmBuffer, {}).then((result) => {
    const wasmDecide = result.instance.exports.decide;
    // Smoke: triage + manager_handoff + evidence=MANAGER_HANDOFF(1)
    // Expected: ALLOW, toState=ready(3) -> pack(1,0,3) = 1 | (3<<12) = 12289
    const jsResult = kernelJs.decide(2, 1, 1);
    const wasmResult = wasmDecide(2, 1, 1);
    if (jsResult === wasmResult) {
      console.log('Smoke test PASSED: JS=' + jsResult + ' WASM=' + wasmResult);
    } else {
      console.error('Smoke test FAILED: JS=' + jsResult + ' WASM=' + wasmResult);
      process.exit(1);
    }
    // Additional: terminal state
    const jsTerm = kernelJs.decide(7, 0, 0);
    const wasmTerm = wasmDecide(7, 0, 0);
    if (jsTerm === wasmTerm) {
      console.log('Terminal test PASSED: ' + jsTerm);
    } else {
      console.error('Terminal test FAILED: JS=' + jsTerm + ' WASM=' + wasmTerm);
      process.exit(1);
    }
    // No-evidence deny
    const jsDeny = kernelJs.decide(2, 1, 0);
    const wasmDeny = wasmDecide(2, 1, 0);
    if (jsDeny === wasmDeny) {
      console.log('Deny test PASSED: ' + jsDeny);
    } else {
      console.error('Deny test FAILED: JS=' + jsDeny + ' WASM=' + wasmDeny);
      process.exit(1);
    }
    console.log('wasm OK');
  }).catch((err) => {
    console.error('WASM instantiation FAILED:', err.message);
    process.exit(1);
  });
}

main();
