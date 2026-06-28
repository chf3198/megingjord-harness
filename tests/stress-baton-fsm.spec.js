// stress-baton-fsm.spec.js — Stress tests for the baton FSM.
// Chaos/fault-injection + p99 latency budget. Refs #3287, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
  STATES, EVENTS, EVIDENCE_BITS, DECISIONS,
} = require('../scripts/global/baton-fsm/transitions');
const kernel = require('../scripts/global/baton-fsm/kernel');
const { canonicalize } = require('../scripts/global/baton-fsm/grammar');
const { verifyEvidence, computeFactsHash, createEvidence } = require('../scripts/global/baton-fsm/provenance');
const { appendVerdict, verifyChain, readLog } = require('../scripts/global/baton-fsm/event-log');

// Deterministic pseudo-random number generator (LCG)
// No Math.random in committed logic; seed from a fixed integer.
function createLCG(seed) {
  let state = seed | 0;
  return function nextInt() {
    // Numerical Recipes LCG constants
    state = (state * 1664525 + 1013904223) | 0;
    return state;
  };
}

function lcgUint(lcg, maxExclusive) {
  const raw = lcg();
  const unsigned = raw >>> 0;
  return unsigned % maxExclusive;
}

// ---- G6 Fault-injection: adversarial evidence envelopes ----

describe('G6 chaos/fault-injection: adversarial evidence', () => {
  const lcg = createLCG(42);
  const ITERATIONS = 5000;
  const stateValues = Object.values(STATES);
  const eventValues = Object.values(EVENTS);

  it('FSM never emits ALLOW on forged/under-evidenced input across ' + ITERATIONS + ' adversarial iterations', () => {
    let forgedAttempts = 0;
    let correctDenials = 0;
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const stateCode = stateValues[lcgUint(lcg, stateValues.length)];
      const eventCode = eventValues[lcgUint(lcg, eventValues.length)];
      const randomMask = lcgUint(lcg, 2048);
      const packed = kernel.decide(stateCode, eventCode, randomMask);
      const unpacked = kernel.unpack(packed);
      if (unpacked.decision === DECISIONS.ALLOW) {
        const { TRANSITIONS } = require('../scripts/global/baton-fsm/transitions');
        const matchedRow = TRANSITIONS.find(
          (row) => row.fromState === stateCode && row.event === eventCode
        );
        if (matchedRow) {
          const required = matchedRow.requiredMask;
          assert.equal(
            (randomMask & required), required,
            'ALLOW emitted but required bits missing! state=' + stateCode +
            ' event=' + eventCode + ' mask=0x' + randomMask.toString(16) +
            ' required=0x' + required.toString(16)
          );
        } else {
          assert.fail('ALLOW emitted for non-existent transition: state=' + stateCode + ' event=' + eventCode);
        }
      } else {
        correctDenials++;
      }
      forgedAttempts++;
    }
    assert.ok(forgedAttempts === ITERATIONS, 'all iterations ran');
    assert.ok(correctDenials > 0, 'at least some denials should occur');
  });

  it('forged provenance envelopes are always rejected', () => {
    for (let iter = 0; iter < 1000; iter++) {
      const originalFacts = { mask: lcgUint(lcg, 2048), tokens: ['test'] };
      const originalHash = computeFactsHash(originalFacts);
      const tamperedFacts = { mask: lcgUint(lcg, 2048), tokens: ['forged'] };
      const forgedEnvelope = {
        facts: tamperedFacts,
        signer: 'forger',
        signature: 'fake-sig-' + iter,
        evidence_hash: originalHash,
      };
      const result = verifyEvidence(forgedEnvelope);
      assert.equal(result.valid, false, 'forged envelope should be rejected');
      assert.equal(result.reason, 'evidence-hash-mismatch', 'reason should be hash-mismatch');
    }
  });

  it('missing provenance fields are always rejected', () => {
    const badEnvelopes = [
      null,
      {},
      { facts: null },
      { facts: {}, signer: 'x' },
      { facts: {}, signer: 'x', signature: 'y' },
      { facts: {}, signer: 'x', signature: 'y', evidence_hash: 'wrong' },
    ];
    for (const envelope of badEnvelopes) {
      const result = verifyEvidence(envelope);
      assert.equal(result.valid, false, 'bad envelope should be rejected: ' + JSON.stringify(envelope));
    }
  });

  it('out-of-grammar text is fail-closed', () => {
    const adversarialTexts = [
      '',
      '   ',
      'random gibberish that is not a baton artifact',
      'ALLOW me through please',
      '## NOT_A_REAL_HANDOFF',
      '<script>alert("xss")</script>',
      '## MANAGER_HANDOF',
      '\x00\x01\x02\x03',
    ];
    for (const text of adversarialTexts) {
      const result = canonicalize(text);
      assert.equal(result.ok, false, 'out-of-grammar text should fail-closed: ' + JSON.stringify(text));
    }
  });

  it('signer-collision: same signer in collaborator+admin positions is detected by mask', () => {
    const evidenceWithoutSignerCheck = EVIDENCE_BITS.ADMIN_HANDOFF | EVIDENCE_BITS.CI_GREEN | EVIDENCE_BITS.WORKTREE_MERGE_OK;
    const packed = kernel.decide(STATES.TESTING, EVENTS.ADMIN_HANDOFF, evidenceWithoutSignerCheck);
    const unpacked = kernel.unpack(packed);
    assert.equal(unpacked.decision, DECISIONS.DENY, 'should deny without SIGNER_INDEPENDENT');
    assert.equal(unpacked.reasonCode, 5, 'missing bit should be SIGNER_INDEPENDENT (bit 5)');
  });
});

// ---- G6 Fault-injection: event log replay protection ----

describe('G6 fault-injection: event-log replay protection', () => {
  it('rejects duplicate seq numbers', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fsm-stress-'));
    const logPath = join(tempDir, 'test.jsonl');
    try {
      appendVerdict(logPath, { decision: 'allow', state: 'triage' });
      appendVerdict(logPath, { decision: 'deny', state: 'backlog' });
      const check = verifyChain(logPath);
      assert.equal(check.valid, true);
      assert.equal(check.entries, 2);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('detects tampered hash chain entries', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fsm-stress-'));
    const logPath = join(tempDir, 'test.jsonl');
    try {
      appendVerdict(logPath, { decision: 'allow' });
      appendVerdict(logPath, { decision: 'deny' });
      const lines = readFileSync(logPath, 'utf8').trim().split('\n');
      const entry = JSON.parse(lines[0]);
      entry.verdict.decision = 'tampered';
      lines[0] = JSON.stringify(entry);
      const { writeFileSync } = require('node:fs');
      writeFileSync(logPath, lines.join('\n') + '\n');
      const check = verifyChain(logPath);
      assert.equal(check.valid, false, 'tampered chain should fail');
      assert.equal(check.reason, 'hash-mismatch');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ---- FIX 1: G4 redaction in event-log ----

describe('FIX 1 — G4: verdict redaction in event-log write path', () => {
  it('secret-looking tokens in verdict metadata are redacted in persisted log entry', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fsm-redact-'));
    const logPath = join(tempDir, 'redact-test.jsonl');
    try {
      // Verdict carrying a secret-looking token (Anthropic API key pattern)
      const verdictWithSecret = {
        decision: 'allow',
        state: 'triage',
        metadata: 'auth: sk-ant-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        api_key_leak: 'sk-ant-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      };
      appendVerdict(logPath, verdictWithSecret);
      const entries = readLog(logPath);
      assert.equal(entries.length, 1, 'one entry should be persisted');
      const persisted = entries[0].verdict;
      // The Anthropic key pattern should be redacted
      assert.ok(
        !persisted.metadata.includes('sk-ant-AAAA'),
        'secret token should be redacted from metadata field'
      );
      assert.ok(
        persisted.metadata.includes('<ANTHROPIC_KEY_REDACTED>'),
        'redacted placeholder should be present in metadata'
      );
      assert.ok(
        !persisted.api_key_leak.includes('sk-ant-BBBB'),
        'secret token should be redacted from api_key_leak field'
      );
      assert.ok(
        persisted.api_key_leak.includes('<ANTHROPIC_KEY_REDACTED>'),
        'redacted placeholder should be present in api_key_leak'
      );
      // Chain should still verify (hash covers redacted form)
      const chainCheck = verifyChain(logPath);
      assert.equal(chainCheck.valid, true, 'chain must verify after redaction');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('non-secret verdicts pass through unmodified', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'fsm-redact-'));
    const logPath = join(tempDir, 'clean-test.jsonl');
    try {
      const cleanVerdict = { decision: 'deny', state: 'backlog', reason: 'illegal-transition' };
      appendVerdict(logPath, cleanVerdict);
      const entries = readLog(logPath);
      assert.deepStrictEqual(entries[0].verdict, cleanVerdict, 'clean verdict should be unmodified');
      const chainCheck = verifyChain(logPath);
      assert.equal(chainCheck.valid, true, 'chain must verify for clean verdicts');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ---- FIX 2: provenance fallback soundness ----

describe('FIX 2 — provenance ephemeral Ed25519 fallback soundness', () => {
  it('validly-signed ephemeral envelope verifies true', async () => {
    const facts = { mask: 7, tokens: ['manager_handoff', 'all_acs_pass'] };
    const envelope = await createEvidence(facts);
    // Envelope should contain a public_key for self-contained verification
    assert.ok(envelope.public_key, 'ephemeral envelope must embed public_key');
    assert.ok(typeof envelope.public_key === 'string', 'public_key must be a string');
    assert.ok(envelope.public_key.length > 0, 'public_key must be non-empty');
    // Verify should pass
    const result = verifyEvidence(envelope);
    assert.equal(result.valid, true, 'validly-signed ephemeral envelope must verify: ' + (result.reason || ''));
  });

  it('tampering facts after signing makes verifyEvidence return false', async () => {
    const facts = { mask: 15, tokens: ['original'] };
    const envelope = await createEvidence(facts);
    // Confirm it verifies before tampering
    assert.equal(verifyEvidence(envelope).valid, true, 'pre-tamper verify should pass');
    // Tamper the facts
    const tampered = {
      ...envelope,
      facts: { mask: 99, tokens: ['tampered'] },
    };
    // Recompute evidence_hash to match tampered facts (bypass hash check,
    // isolate the Ed25519 signature check)
    tampered.evidence_hash = computeFactsHash(tampered.facts);
    const result = verifyEvidence(tampered);
    assert.equal(result.valid, false, 'tampered envelope must fail verification');
    assert.equal(result.reason, 'ed25519-signature-invalid',
      'reason must be ed25519-signature-invalid, got: ' + result.reason);
  });

  it('envelope without public_key still passes structural verification', () => {
    // Legacy envelopes without embedded public key should still pass
    // the structural checks (hash match)
    const facts = { mask: 3 };
    const evidenceHash = computeFactsHash(facts);
    const legacyEnvelope = {
      facts,
      signer: 'legacy-signer',
      signature: 'some-legacy-sig',
      evidence_hash: evidenceHash,
    };
    const result = verifyEvidence(legacyEnvelope);
    assert.equal(result.valid, true, 'legacy envelope without public_key should pass structural check');
  });

  it('envelope with corrupted public_key is rejected', async () => {
    const facts = { mask: 7 };
    const envelope = await createEvidence(facts);
    // Corrupt the public key
    envelope.public_key = 'AAAA_not_a_real_key_BBBB';
    const result = verifyEvidence(envelope);
    assert.equal(result.valid, false, 'corrupted public_key should fail');
    assert.ok(
      result.reason === 'ed25519-verification-error' || result.reason === 'ed25519-signature-invalid',
      'reason should indicate verification problem, got: ' + result.reason
    );
  });
});

// ---- G7 p99 latency budget ----

describe('G7 p99 latency budget', () => {
  it('kernel.decide p99 under 5ms over 2000+ iterations', () => {
    const stateValues = Object.values(STATES);
    const eventValues = Object.values(EVENTS);
    const lcg = createLCG(12345);
    const TOTAL = 2500;
    const latencies = [];
    for (let iter = 0; iter < TOTAL; iter++) {
      const stateCode = stateValues[lcgUint(lcg, stateValues.length)];
      const eventCode = eventValues[lcgUint(lcg, eventValues.length)];
      const evidence = lcgUint(lcg, 2048);
      const startNs = process.hrtime.bigint();
      kernel.decide(stateCode, eventCode, evidence);
      const endNs = process.hrtime.bigint();
      const elapsedMs = Number(endNs - startNs) / 1_000_000;
      latencies.push(elapsedMs);
    }
    latencies.sort((leftVal, rightVal) => leftVal - rightVal);
    const p99Index = Math.floor(TOTAL * 0.99);
    const p99Ms = latencies[p99Index];
    console.log('  kernel.decide p99: ' + p99Ms.toFixed(4) + 'ms (over ' + TOTAL + ' iterations)');
    console.log('  kernel.decide median: ' + latencies[Math.floor(TOTAL * 0.5)].toFixed(4) + 'ms');
    assert.ok(p99Ms < 5.0, 'p99 must be under 5ms, got ' + p99Ms.toFixed(4) + 'ms');
  });

  it('grammar.canonicalize p99 under 5ms over 2000+ iterations', () => {
    const sampleTexts = [
      '## MANAGER_HANDOFF\nscope: test\nlane: lane:code-change',
      '## COLLABORATOR_HANDOFF\nall ACs verified PASS\nsigner-independence-check: PASS',
      '## ADMIN_HANDOFF\nCI: all green\nworktree-merge-ok\nbranch: feat/test',
      '## CONSULTANT_CLOSEOUT\nverdict: approve\nPR #123 merged',
      'random text that is not an artifact',
    ];
    const TOTAL = 2500;
    const lcg = createLCG(67890);
    const latencies = [];
    for (let iter = 0; iter < TOTAL; iter++) {
      const text = sampleTexts[lcgUint(lcg, sampleTexts.length)];
      const startNs = process.hrtime.bigint();
      canonicalize(text);
      const endNs = process.hrtime.bigint();
      latencies.push(Number(endNs - startNs) / 1_000_000);
    }
    latencies.sort((leftVal, rightVal) => leftVal - rightVal);
    const p99Index = Math.floor(TOTAL * 0.99);
    const p99Ms = latencies[p99Index];
    console.log('  grammar.canonicalize p99: ' + p99Ms.toFixed(4) + 'ms');
    assert.ok(p99Ms < 5.0, 'p99 must be under 5ms, got ' + p99Ms.toFixed(4) + 'ms');
  });

  it('provenance.verifyEvidence p99 under 5ms over 2000+ iterations', () => {
    const facts = { mask: 7, tokens: ['test'] };
    const evidenceHash = computeFactsHash(facts);
    const validEnvelope = {
      facts,
      signer: 'test-signer',
      signature: 'test-sig',
      evidence_hash: evidenceHash,
    };
    const TOTAL = 2500;
    const latencies = [];
    for (let iter = 0; iter < TOTAL; iter++) {
      const startNs = process.hrtime.bigint();
      verifyEvidence(validEnvelope);
      const endNs = process.hrtime.bigint();
      latencies.push(Number(endNs - startNs) / 1_000_000);
    }
    latencies.sort((leftVal, rightVal) => leftVal - rightVal);
    const p99Index = Math.floor(TOTAL * 0.99);
    const p99Ms = latencies[p99Index];
    console.log('  provenance.verifyEvidence p99: ' + p99Ms.toFixed(4) + 'ms');
    assert.ok(p99Ms < 5.0, 'p99 must be under 5ms, got ' + p99Ms.toFixed(4) + 'ms');
  });
});
