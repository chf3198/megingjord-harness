// baton-outage-replica.spec.js - TDD-pyramid tests for the read-only outage replica.
// AC1: verify-only works from signed checkpoints.
// AC2: authorizeMerge/authorizeClose ALWAYS refuse (terminals fail-closed).
// Refs #3294, Epic #3284.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign: cryptoSign } = require('node:crypto');

const { createStore, cacheCheckpoint, loadCheckpoints, getLatestCheckpoint, isStale } =
  require('../scripts/global/baton-outage-replica/checkpoint-store');
const { createReplica, verifyVerdict, verifyChainHead, authorizeMerge, authorizeClose, reconcileHeads, TERMINAL_DENY } =
  require('../scripts/global/baton-outage-replica/readonly-replica');
const { isOutage } =
  require('../scripts/global/baton-outage-replica/outage-detector');

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
    _keyPair: keyPair,
    _payload: payload,
  };
}

// --- checkpoint-store tests ---
describe('checkpoint-store', () => {
  it('creates an empty store with default freshness', () => {
    const store = createStore();
    assert.equal(store.checkpoints.size, 0);
    assert.equal(store.freshnessBoundMs, 300000);
  });

  it('creates a store with custom freshness', () => {
    const store = createStore({ freshnessBoundMs: 60000 });
    assert.equal(store.freshnessBoundMs, 60000);
  });

  it('caches a valid checkpoint', () => {
    const store = createStore();
    const cp = makeCheckpoint('abc123', new Date().toISOString(), 5);
    const result = cacheCheckpoint(store, cp);
    assert.equal(result.cached, true);
    assert.equal(store.checkpoints.size, 1);
    assert.ok(store.checkpoints.has('abc123'));
  });

  it('rejects a checkpoint missing chainHeadHash', () => {
    const store = createStore();
    const result = cacheCheckpoint(store, { signature: 'x', publicKey: 'y', timestamp: 'z', chainLength: 0 });
    assert.equal(result.cached, false);
    assert.equal(result.reason, 'missing-chain-head-hash');
  });

  it('rejects a checkpoint with non-object input', () => {
    const store = createStore();
    assert.equal(cacheCheckpoint(store, null).cached, false);
    assert.equal(cacheCheckpoint(store, 'string').cached, false);
  });

  it('rejects a checkpoint with invalid chainLength', () => {
    const store = createStore();
    const result = cacheCheckpoint(store, {
      chainHeadHash: 'h', signature: 's', publicKey: 'p', timestamp: 't', chainLength: -1,
    });
    assert.equal(result.cached, false);
    assert.equal(result.reason, 'invalid-chain-length');
  });

  it('loadCheckpoints returns newest first', () => {
    const store = createStore();
    cacheCheckpoint(store, makeCheckpoint('old', '2020-01-01T00:00:00Z', 1));
    cacheCheckpoint(store, makeCheckpoint('new', '2025-01-01T00:00:00Z', 2));
    const loaded = loadCheckpoints(store);
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].chainHeadHash, 'new');
    assert.equal(loaded[1].chainHeadHash, 'old');
  });

  it('getLatestCheckpoint returns null for empty store', () => {
    const store = createStore();
    assert.equal(getLatestCheckpoint(store), null);
  });

  it('getLatestCheckpoint returns the newest checkpoint', () => {
    const store = createStore();
    cacheCheckpoint(store, makeCheckpoint('old', '2020-01-01T00:00:00Z', 1));
    cacheCheckpoint(store, makeCheckpoint('new', '2025-01-01T00:00:00Z', 2));
    const latest = getLatestCheckpoint(store);
    assert.equal(latest.chainHeadHash, 'new');
  });

  it('isStale detects stale checkpoints', () => {
    const checkpoint = { timestamp: '2020-01-01T00:00:00Z' };
    assert.equal(isStale(checkpoint, 300000, Date.now()), true);
  });

  it('isStale detects fresh checkpoints', () => {
    const checkpoint = { timestamp: new Date().toISOString() };
    assert.equal(isStale(checkpoint, 300000, Date.now()), false);
  });
});

// --- readonly-replica tests ---
describe('readonly-replica', () => {
  it('AC1: verifyVerdict succeeds with valid signed verdict + fresh checkpoint', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    const headHash = 'abcdef1234567890';
    const cp = makeCheckpoint(headHash, new Date().toISOString(), 3);
    cacheCheckpoint(store, cp);
    const replica = createReplica(store);

    const verdict = {
      chainHeadHash: headHash,
      payload: cp._payload,
      signature: cp.signature,
      publicKey: cp.publicKey,
    };
    const result = verifyVerdict(replica, verdict);
    assert.equal(result.valid, true);
  });

  it('AC1: verifyVerdict succeeds without signature fields (chain-membership only)', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    const headHash = 'chainonly123';
    cacheCheckpoint(store, makeCheckpoint(headHash, new Date().toISOString(), 1));
    const replica = createReplica(store);

    const result = verifyVerdict(replica, { chainHeadHash: headHash });
    assert.equal(result.valid, true);
  });

  it('verifyVerdict rejects bad Ed25519 signature', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    const headHash = 'badsig123';
    const cp = makeCheckpoint(headHash, new Date().toISOString(), 1);
    cacheCheckpoint(store, cp);
    const replica = createReplica(store);

    const verdict = {
      chainHeadHash: headHash,
      payload: cp._payload,
      signature: 'AAAA', // invalid signature
      publicKey: cp.publicKey,
    };
    const result = verifyVerdict(replica, verdict);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'bad-signature');
  });

  it('verifyVerdict rejects unknown chain head (partial-proof)', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    cacheCheckpoint(store, makeCheckpoint('known', new Date().toISOString(), 1));
    const replica = createReplica(store);

    const result = verifyVerdict(replica, { chainHeadHash: 'unknown-head' });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'partial-proof');
  });

  it('verifyVerdict rejects stale checkpoint (stale-digest)', () => {
    const store = createStore({ freshnessBoundMs: 1000 }); // 1 second freshness
    cacheCheckpoint(store, makeCheckpoint('stale', '2020-01-01T00:00:00Z', 1));
    const replica = createReplica(store);

    const result = verifyVerdict(replica, { chainHeadHash: 'stale' });
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'stale-digest');
  });

  it('verifyVerdict rejects null verdict', () => {
    const store = createStore();
    const replica = createReplica(store);
    const result = verifyVerdict(replica, null);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'verdict-not-an-object');
  });

  it('verifyChainHead matches a known fresh head', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    const headHash = 'headmatch123';
    cacheCheckpoint(store, makeCheckpoint(headHash, new Date().toISOString(), 5));
    const replica = createReplica(store);

    const result = verifyChainHead(replica, headHash);
    assert.equal(result.valid, true);
  });

  it('verifyChainHead rejects unknown head', () => {
    const store = createStore({ freshnessBoundMs: 600000 });
    const replica = createReplica(store);
    const result = verifyChainHead(replica, 'nonexistent');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'unknown-chain-head');
  });

  it('verifyChainHead rejects stale head', () => {
    const store = createStore({ freshnessBoundMs: 100 });
    cacheCheckpoint(store, makeCheckpoint('old', '2020-01-01T00:00:00Z', 1));
    const replica = createReplica(store);
    const result = verifyChainHead(replica, 'old');
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'stale-digest');
  });

  it('verifyChainHead rejects invalid input', () => {
    const store = createStore();
    const replica = createReplica(store);
    assert.equal(verifyChainHead(replica, '').valid, false);
    assert.equal(verifyChainHead(replica, null).valid, false);
  });

  // AC2: terminal stubs ALWAYS refuse
  it('AC2: authorizeMerge ALWAYS returns authorized:false', () => {
    const result = authorizeMerge();
    assert.equal(result.authorized, false);
    assert.equal(result.reason, 'replica-is-read-only-terminals-fail-closed');
    assert.deepStrictEqual(result, TERMINAL_DENY);
  });

  it('AC2: authorizeClose ALWAYS returns authorized:false', () => {
    const result = authorizeClose();
    assert.equal(result.authorized, false);
    assert.equal(result.reason, 'replica-is-read-only-terminals-fail-closed');
    assert.deepStrictEqual(result, TERMINAL_DENY);
  });

  it('AC2: authorizeMerge ignores arguments', () => {
    const result = authorizeMerge('please', { force: true }, 42);
    assert.equal(result.authorized, false);
  });

  it('AC2: authorizeClose ignores arguments', () => {
    const result = authorizeClose('override', true);
    assert.equal(result.authorized, false);
  });

  it('reconcileHeads returns consistent when heads match', () => {
    const store = createStore();
    const replica = createReplica(store);
    const result = reconcileHeads(replica, 'abc', 'abc');
    assert.equal(result.action, 'consistent');
  });

  it('reconcileHeads returns defer-to-truth on divergence (reconnect-conflict)', () => {
    const store = createStore();
    const replica = createReplica(store);
    const result = reconcileHeads(replica, 'cached-abc', 'observed-xyz');
    assert.equal(result.action, 'defer-to-truth');
    assert.ok(result.reason.includes('reconnect-conflict'));
  });

  it('reconcileHeads returns defer-to-truth on missing values', () => {
    const store = createStore();
    const replica = createReplica(store);
    assert.equal(reconcileHeads(replica, null, 'obs').action, 'defer-to-truth');
    assert.equal(reconcileHeads(replica, 'cached', null).action, 'defer-to-truth');
    assert.equal(reconcileHeads(replica, '', 'obs').action, 'defer-to-truth');
  });
});

// --- outage-detector tests ---
describe('outage-detector', () => {
  it('detects no outage when probe returns reachable', async () => {
    const probe = async () => ({ reachable: true });
    const result = await isOutage(probe);
    assert.equal(result.outage, false);
    assert.equal(result.reason, 'probe-reachable');
  });

  it('detects outage when probe returns unreachable', async () => {
    const probe = async () => ({ reachable: false });
    const result = await isOutage(probe);
    assert.equal(result.outage, true);
    assert.equal(result.reason, 'probe-unreachable');
  });

  it('detects outage when probe throws', async () => {
    const probe = async () => { throw new Error('network-down'); };
    const result = await isOutage(probe);
    assert.equal(result.outage, true);
    assert.ok(result.reason.includes('probe-error'));
  });

  it('detects outage when probe is not a function', async () => {
    const result = await isOutage('not-a-function');
    assert.equal(result.outage, true);
    assert.equal(result.reason, 'probe-not-a-function');
  });

  it('detects outage on probe timeout', async () => {
    const probe = () => new Promise(() => {}); // never resolves
    const result = await isOutage(probe, { timeoutMs: 50 });
    assert.equal(result.outage, true);
    assert.equal(result.reason, 'probe-timeout');
  });
});
