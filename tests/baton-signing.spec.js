// baton-signing.spec.js — HAMR Wave 1 sign/verify tests (#894)
// Playwright-test compatible; CJS require to match project test style.
const { test, expect } = require('@playwright/test');
const path = require('path');

const MOD_PATH = path.join(__dirname, '..', 'scripts', 'global', 'baton-signing.js');
const mod = require(MOD_PATH);

// 1. sign() returns all required fields
test('sign() returns artifact, signature, key_id, timestamp, tier', async () => {
  const r = await mod.sign('CONSULTANT_CLOSEOUT\ntest body');
  expect(r).toHaveProperty('artifact');
  expect(r).toHaveProperty('signature');
  expect(r).toHaveProperty('key_id');
  expect(r).toHaveProperty('timestamp');
  expect(r).toHaveProperty('tier');
  expect(['T3-env', 'T4']).toContain(r.tier);
});

// 2. sign() signature length is 86–88 chars (Ed25519 64 bytes base64 unpadded/padded)
test('sign() produces signature of length 86–88', async () => {
  const r = await mod.sign('MANAGER_HANDOFF\nsome content here');
  expect(r.signature.length).toBeGreaterThanOrEqual(86);
  expect(r.signature.length).toBeLessThanOrEqual(88);
});

// 3. verify() returns ok:true for matching pubkey
test('verify() returns ok:true for fresh sign with correct public key', async () => {
  const r = await mod.sign('ADMIN_HANDOFF\nall gates green');
  const keys = new Map([[r.key_id, r.publicKey]]);
  const v = await mod.verify(r, keys);
  expect(v.ok).toBe(true);
  expect(v.reason).toBeUndefined();
});

// 4. verify() returns ok:false with reason unknown_key_id when key not in map
test('verify() returns ok:false reason unknown_key_id for missing key', async () => {
  const r = await mod.sign('COLLABORATOR_HANDOFF\nwork done');
  const v = await mod.verify(r, new Map());
  expect(v.ok).toBe(false);
  expect(v.reason).toBe('unknown_key_id');
});

// 5. verify() returns ok:false with reason bad_signature when artifact is mutated
test('verify() returns ok:false reason bad_signature when artifact is mutated', async () => {
  const r = await mod.sign('CONSULTANT_CLOSEOUT\noriginal body');
  const keys = new Map([[r.key_id, r.publicKey]]);
  const tampered = { ...r, artifact: 'CONSULTANT_CLOSEOUT\ninjected body' };
  const v = await mod.verify(tampered, keys);
  expect(v.ok).toBe(false);
  expect(v.reason).toBe('bad_signature');
});

// 6. emitTrailer() returns body with signature: / key_id: / timestamp: in order
test('emitTrailer() appends signature, key_id, timestamp trailer in correct order', async () => {
  const body = 'CONSULTANT_CLOSEOUT\nclosed';
  const out = await mod.emitTrailer(body);
  expect(out).toContain(body);
  const trailerIdx = out.indexOf('\n\nsignature:');
  expect(trailerIdx).toBeGreaterThan(0);
  const trailer = out.slice(trailerIdx);
  const sigLine = trailer.indexOf('signature:');
  const keyLine = trailer.indexOf('key_id:');
  const tsLine = trailer.indexOf('timestamp:');
  expect(sigLine).toBeLessThan(keyLine);
  expect(keyLine).toBeLessThan(tsLine);
});

// 7. probeKeyTier() returns a valid tier without throwing
test('probeKeyTier() returns one of T1/T2/T3/T4 without exception', async () => {
  const result = await mod.probeKeyTier();
  expect(['T1', 'T2', 'T3', 'T4']).toContain(result.tier);
  expect(typeof result.source).toBe('string');
});

// 8. sign() result must not contain private key material (no privateKey/secretKey field; no 32-byte raw seed in non-publicKey fields)
test('sign() result contains no private key material', async () => {
  const r = await mod.sign('MANAGER_HANDOFF\nbaton start');
  expect(JSON.stringify(r)).not.toMatch(/privateKey|secretKey/i);
  for (const [k, v] of Object.entries(r)) {
    if (k === 'publicKey' || typeof v !== 'string') continue;
    expect(Buffer.from(v, 'base64').length).not.toBe(32);
  }
});

// 9. Canonicalization: padded artifact verifies same as trimmed text
test('sign() canonicalization: padded artifact verifies same as trimmed artifact', async () => {
  const r1 = await mod.sign('  text  \n\n');
  const r2 = await mod.sign('text');
  const keys = new Map([[r1.key_id, r1.publicKey]]);
  expect((await mod.verify(r1, keys)).ok).toBe(true);
  expect((await mod.verify(r2, keys)).ok).toBe(true);
  const cross = await mod.verify({ artifact: '  text  \n\n', signature: r2.signature, key_id: r2.key_id }, keys);
  expect(cross.ok).toBe(true);
});
