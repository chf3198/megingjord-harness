// stress-baton-outage-replica.spec.js - Stress tests for the read-only outage replica.
// AC3 fault-injection: stale-digest, partial-proof, reconnect-conflict each handled safely.
// G6 resilience: no false authorize across randomized runs.
// G7 throughput: p99 latency budget on verifyVerdict.
// Refs #3294, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign: cryptoSign, createHash } = require('node:crypto');

const { createStore, cacheCheckpoint } =
  require('../scripts/global/baton-outage-replica/checkpoint-store');
const { createReplica, verifyVerdict, verifyChainHead, authorizeMerge, authorizeClose, reconcileHeads } =
  require('../scripts/global/baton-outage-replica/readonly-replica');

// Simple LCG PRNG for deterministic randomized tests (seed-based)
function lcg(seed) {
  let state = seed;
  return function next() {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state;
  };
}

// Helper: generate a deterministic hex hash from seed
function seedHash(seed) {
  return createHash('sha256').update(String(seed)).digest('hex');
}

// Helper: create a valid signed checkpoint
function makeCheckpoint(headHash, timestampIso, chainLen) {
  const keyPair = generateKeyPairSync('ed25519');
  const pubDer = keyPair.publicKey.export({ type: 'spki', format: 'der' });
  const payload = JSON.stringify({ chainHeadHash: headHash, chainLength: chainLen });
  const sig = cryptoSign(null, Buffer.from(payload, 'utf8'), keyPair.privateKey);
  return {
    chainHeadHash: headHash,
    signature: sig.toString('base64'),
    publicKey: pubDer.toString('base64'),
    timestamp: timestampIso,
    chainLength: chainLen,
    _payload: payload,
  };
}

describe('stress: fault-injection over failure modes (AC3, G6)', () => {

  it('stale-digest: randomized stale checkpoints never produce a false authorize', () => {
    const rng = lcg(42);
    const iterCount = 500;
    let staleCount = 0;
    for (let idx = 0; idx < iterCount; idx++) {
      const freshnessBound = 1000 + (rng() % 5000);
      const store = createStore({ freshnessBoundMs: freshnessBound });
      const headHash = seedHash(rng());
      // Create checkpoint with timestamp far in the past (always stale)
      const pastMs = Date.now() - freshnessBound - 1 - (rng() % 100000);
      const cp = makeCheckpoint(headHash, new Date(pastMs).toISOString(), rng() % 100);
      cacheCheckpoint(store, cp);
      const replica = createReplica(store);

      const verdict = { chainHeadHash: headHash };
      const result = verifyVerdict(replica, verdict);
      assert.equal(result.valid, false, 'stale checkpoint must not verify as valid');
      assert.equal(result.reason, 'stale-digest');
      staleCount++;

      // Terminal stubs must also refuse regardless of state
      assert.equal(authorizeMerge().authorized, false);
      assert.equal(authorizeClose().authorized, false);
    }
    assert.equal(staleCount, iterCount);
  });

  it('partial-proof: unknown chain heads never produce a false authorize', () => {
    const rng = lcg(99);
    const iterCount = 500;
    let partialCount = 0;
    for (let idx = 0; idx < iterCount; idx++) {
      const store = createStore({ freshnessBoundMs: 600000 });
      // Cache a checkpoint with one hash
      const knownHash = seedHash(rng());
      cacheCheckpoint(store, makeCheckpoint(knownHash, new Date().toISOString(), rng() % 50));
      const replica = createReplica(store);

      // Query with a different hash (partial proof)
      const unknownHash = seedHash(rng());
      const result = verifyVerdict(replica, { chainHeadHash: unknownHash });
      assert.equal(result.valid, false, 'unknown chain head must not verify as valid');
      assert.equal(result.reason, 'partial-proof');
      partialCount++;

      assert.equal(authorizeMerge().authorized, false);
      assert.equal(authorizeClose().authorized, false);
    }
    assert.equal(partialCount, iterCount);
  });

  it('reconnect-conflict: divergent heads always defer-to-truth, never authorize', () => {
    const rng = lcg(137);
    const iterCount = 500;
    let conflictCount = 0;
    for (let idx = 0; idx < iterCount; idx++) {
      const store = createStore();
      const replica = createReplica(store);
      const cachedHead = seedHash(rng());
      const observedHead = seedHash(rng());

      // Ensure they differ (rehash if collision, astronomically unlikely)
      if (cachedHead === observedHead) continue;

      const result = reconcileHeads(replica, cachedHead, observedHead);
      assert.equal(result.action, 'defer-to-truth', 'divergent heads must defer');
      assert.ok(result.reason.includes('reconnect-conflict'));
      conflictCount++;

      assert.equal(authorizeMerge().authorized, false);
      assert.equal(authorizeClose().authorized, false);
    }
    // At least 490 out of 500 should have run (collision probability is negligible)
    assert.ok(conflictCount >= 490, 'expected at least 490 conflict iterations, got ' + conflictCount);
  });

  it('mixed fault injection: random mode selection across all three failure paths', () => {
    const rng = lcg(256);
    const iterCount = 600;
    const modeCounts = { stale: 0, partial: 0, conflict: 0 };

    for (let idx = 0; idx < iterCount; idx++) {
      const mode = rng() % 3;
      const store = createStore({ freshnessBoundMs: 2000 });
      const headHash = seedHash(rng());

      if (mode === 0) {
        // stale-digest path
        const pastMs = Date.now() - 3000 - (rng() % 10000);
        cacheCheckpoint(store, makeCheckpoint(headHash, new Date(pastMs).toISOString(), 1));
        const replica = createReplica(store);
        const result = verifyVerdict(replica, { chainHeadHash: headHash });
        assert.equal(result.valid, false);
        assert.equal(result.reason, 'stale-digest');
        modeCounts.stale++;
      } else if (mode === 1) {
        // partial-proof path
        cacheCheckpoint(store, makeCheckpoint(seedHash(rng()), new Date().toISOString(), 1));
        const replica = createReplica(store);
        const result = verifyVerdict(replica, { chainHeadHash: headHash });
        assert.equal(result.valid, false);
        assert.equal(result.reason, 'partial-proof');
        modeCounts.partial++;
      } else {
        // reconnect-conflict path
        const replica = createReplica(store);
        const observedHead = seedHash(rng());
        if (headHash !== observedHead) {
          const result = reconcileHeads(replica, headHash, observedHead);
          assert.equal(result.action, 'defer-to-truth');
          modeCounts.conflict++;
        }
      }

      // Invariant: terminals always refuse regardless of fault mode
      assert.equal(authorizeMerge().authorized, false);
      assert.equal(authorizeClose().authorized, false);
    }

    // Each mode should have been exercised
    assert.ok(modeCounts.stale > 0, 'stale mode must be exercised');
    assert.ok(modeCounts.partial > 0, 'partial mode must be exercised');
    assert.ok(modeCounts.conflict > 0, 'conflict mode must be exercised');
  });
});

describe('stress: p99 latency budget (G7)', () => {
  it('verifyVerdict p99 is at most 5ms over 2000 iterations', () => {
    // Pre-warm: create a store with a valid checkpoint
    const store = createStore({ freshnessBoundMs: 600000 });
    const headHash = 'perf-test-head-' + seedHash(777);
    cacheCheckpoint(store, makeCheckpoint(headHash, new Date().toISOString(), 10));
    const replica = createReplica(store);
    const verdict = { chainHeadHash: headHash };

    const iterCount = 2000;
    const latencies = new Array(iterCount);

    for (let idx = 0; idx < iterCount; idx++) {
      const startNs = process.hrtime.bigint();
      verifyVerdict(replica, verdict);
      const endNs = process.hrtime.bigint();
      latencies[idx] = Number(endNs - startNs) / 1e6; // convert to ms
    }

    latencies.sort((valA, valB) => valA - valB);
    const p99Index = Math.floor(iterCount * 0.99);
    const p99Ms = latencies[p99Index];

    // p99 must be at most 5ms
    assert.ok(p99Ms <= 5, 'p99 latency ' + p99Ms.toFixed(3) + 'ms exceeds 5ms budget');
  });

  it('authorizeMerge and authorizeClose are sub-microsecond (trivial cost)', () => {
    const iterCount = 2000;
    const mergeLatencies = new Array(iterCount);
    const closeLatencies = new Array(iterCount);

    for (let idx = 0; idx < iterCount; idx++) {
      let startNs = process.hrtime.bigint();
      authorizeMerge();
      mergeLatencies[idx] = Number(process.hrtime.bigint() - startNs) / 1e6;

      startNs = process.hrtime.bigint();
      authorizeClose();
      closeLatencies[idx] = Number(process.hrtime.bigint() - startNs) / 1e6;
    }

    mergeLatencies.sort((valA, valB) => valA - valB);
    closeLatencies.sort((valA, valB) => valA - valB);
    const mergeP99 = mergeLatencies[Math.floor(iterCount * 0.99)];
    const closeP99 = closeLatencies[Math.floor(iterCount * 0.99)];

    // Terminal stubs should be trivially fast (well under 1ms)
    assert.ok(mergeP99 <= 1, 'authorizeMerge p99 ' + mergeP99.toFixed(4) + 'ms exceeds 1ms');
    assert.ok(closeP99 <= 1, 'authorizeClose p99 ' + closeP99.toFixed(4) + 'ms exceeds 1ms');
  });
});
