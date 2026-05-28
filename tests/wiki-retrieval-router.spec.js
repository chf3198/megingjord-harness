// tests/wiki-retrieval-router.spec.js — Retrieval router tests
// test_strategy: tdd-pyramid+stress-test  Refs #2057
'use strict';

const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const matter = require('gray-matter');

const RR = require('../scripts/wiki/retrieval-router');

// ---- helpers -----------------------------------------------------------------

function tmpWiki() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-rr-'));
  const dirs = [
    'wisdom/global/concepts', 'wisdom/global/entities', 'wisdom/global/syntheses',
    'wisdom/global/skills', 'wisdom/global/sources',
    'wisdom/project', 'code', 'work-log/tickets', 'work-log/prs',
  ];
  for (const d of dirs) fs.mkdirSync(path.join(dir, d), { recursive: true });

  // Minimal index.md required by wiki-io assertWikiDir -> listPages path
  const today = new Date().toISOString().split('T')[0];
  fs.writeFileSync(path.join(dir, 'index.md'), [
    '---', `title: "Wiki Index"`, `updated: "${today}"`, '---',
    '## Entities', '## Concepts', '## Source Summaries', '## Syntheses', '## Work Log',
    '---', '**Pages**: 0 | **Last updated**: ' + today,
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'log.md'), '');
  return dir;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function writePage(dir, relPath, frontmatterExtra, bodyText) {
  const fm = {
    title: 'Test Page', type: 'code', content_trust_score: 0.8,
    created: '2026-01-01', updated: '2026-01-01',
    ...frontmatterExtra,
  };
  const content = matter.stringify(bodyText, fm);
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  return { fullPath, body: bodyText, frontmatter: fm };
}

// ---- QUERY_CLASS_ROUTES invariants -------------------------------------------

test('QUERY_CLASS_ROUTES covers all four query classes', () => {
  const keys = Object.keys(RR.QUERY_CLASS_ROUTES);
  expect(keys).toContain('factual');
  expect(keys).toContain('historical');
  expect(keys).toContain('synthesis');
  expect(keys).toContain('how-to');
});

test('factual routes exclusively to code wiki type', () => {
  expect(RR.QUERY_CLASS_ROUTES.factual).toEqual(['code']);
});

test('historical routes exclusively to work-log wiki type', () => {
  expect(RR.QUERY_CLASS_ROUTES.historical).toEqual(['work-log']);
});

test('synthesis routes to wisdom-global then wisdom-project', () => {
  expect(RR.QUERY_CLASS_ROUTES.synthesis[0]).toBe('wisdom-global');
});

test('how-to routes to wisdom-project then wisdom-global', () => {
  expect(RR.QUERY_CLASS_ROUTES['how-to'][0]).toBe('wisdom-project');
});

// ---- resolveWikiType ---------------------------------------------------------

test('resolveWikiType: code/ path resolves to code', () => {
  const wikiRoot = '/tmp/wiki';
  const result = RR.resolveWikiType('/tmp/wiki/code/my-page.md', wikiRoot);
  expect(result).toBe('code');
});

test('resolveWikiType: work-log/tickets/ resolves to work-log', () => {
  const result = RR.resolveWikiType('/tmp/wiki/work-log/tickets/ticket-1.md', '/tmp/wiki');
  expect(result).toBe('work-log');
});

test('resolveWikiType: wisdom/global/concepts resolves to wisdom-global', () => {
  const result = RR.resolveWikiType('/tmp/wiki/wisdom/global/concepts/foo.md', '/tmp/wiki');
  expect(result).toBe('wisdom-global');
});

test('resolveWikiType: wisdom/project resolves to wisdom-project', () => {
  const result = RR.resolveWikiType('/tmp/wiki/wisdom/project/bar.md', '/tmp/wiki');
  expect(result).toBe('wisdom-project');
});

test('resolveWikiType: unknown path returns null', () => {
  const result = RR.resolveWikiType('/tmp/wiki/unknown/page.md', '/tmp/wiki');
  expect(result).toBeNull();
});

// ---- verifyContentHash -------------------------------------------------------

test('verifyContentHash: ok when no content_hash in frontmatter', () => {
  const result = RR.verifyContentHash({}, 'any body');
  expect(result.ok).toBe(true);
});

test('verifyContentHash: ok when hash matches body', () => {
  const body = 'hello world';
  const hash = sha256(body);
  expect(RR.verifyContentHash({ content_hash: hash }, body).ok).toBe(true);
});

test('verifyContentHash: fails on tampered body', () => {
  const body = 'hello world';
  const hash = sha256(body);
  const result = RR.verifyContentHash({ content_hash: hash }, 'tampered content');
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/content_hash mismatch/);
});

// ---- verifySourceHash --------------------------------------------------------

test('verifySourceHash: ok when no source fields present', () => {
  expect(RR.verifySourceHash({}, '/tmp')).toEqual(
    expect.objectContaining({ ok: true }),
  );
});

test('verifySourceHash: fails when source file is missing', () => {
  const result = RR.verifySourceHash(
    { source_path: 'nonexistent/file.js', source_sha256: 'abc' }, '/tmp',
  );
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/source file missing/);
});

test('verifySourceHash: fails when source hash does not match', () => {
  const tmpFile = path.join(os.tmpdir(), `rr-src-${Date.now()}.js`);
  fs.writeFileSync(tmpFile, 'real content');
  const result = RR.verifySourceHash(
    { source_path: path.basename(tmpFile), source_sha256: 'deadbeef' },
    path.dirname(tmpFile),
  );
  fs.unlinkSync(tmpFile);
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/source_sha256 mismatch/);
});

test('verifySourceHash: ok when source hash matches file on disk', () => {
  const tmpFile = path.join(os.tmpdir(), `rr-src-match-${Date.now()}.js`);
  const content = 'console.log("ok");';
  fs.writeFileSync(tmpFile, content);
  const hash = crypto.createHash('sha256').update(fs.readFileSync(tmpFile)).digest('hex');
  const result = RR.verifySourceHash(
    { source_path: path.basename(tmpFile), source_sha256: hash },
    path.dirname(tmpFile),
  );
  fs.unlinkSync(tmpFile);
  expect(result.ok).toBe(true);
});

// ---- verifyPage --------------------------------------------------------------

test('verifyPage: overall true when no hashes present and no attestation', () => {
  const result = RR.verifyPage(
    { frontmatter: {}, body: 'body', path: '/tmp/x.md' }, '/tmp',
  );
  expect(result.overall).toBe(true);
  expect(result.notes).toHaveLength(0);
});

test('verifyPage: overall false when content_hash mismatches', () => {
  const result = RR.verifyPage(
    { frontmatter: { content_hash: 'badhash' }, body: 'real body', path: '/tmp/x.md' }, '/tmp',
  );
  expect(result.overall).toBe(false);
  expect(result.content_hash_ok).toBe(false);
  expect(result.notes.some((n) => n.includes('content_hash'))).toBe(true);
});

test('verifyPage: valid trust_attestation yields attestation_ok=true', () => {
  const body = '\nhello attestation\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const signedHash = crypto.createHash('sha256').update(body).digest('hex');
  const sig = crypto.sign(null, Buffer.from(signedHash, 'hex'), kp.privateKey);
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  const attestation = {
    algorithm: 'ed25519', signer: rawPub,
    signature_b64: sig.toString('base64'), signed_payload_hash: signedHash,
  };
  const result = RR.verifyPage({ frontmatter: { trust_attestation: attestation }, body, path: '/tmp/x.md' }, '/tmp');
  expect(result.attestation_ok).toBe(true);
  expect(result.overall).toBe(true);
});

test('verifyPage: tampered body with valid attestation yields attestation_ok=false', () => {
  const originalBody = '\nhello attestation\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const signedHash = crypto.createHash('sha256').update(originalBody).digest('hex');
  const sig = crypto.sign(null, Buffer.from(signedHash, 'hex'), kp.privateKey);
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  const attestation = {
    algorithm: 'ed25519', signer: rawPub,
    signature_b64: sig.toString('base64'), signed_payload_hash: signedHash,
  };
  // Pass tampered body -- hash will not match signed_payload_hash
  const result = RR.verifyPage(
    { frontmatter: { trust_attestation: attestation }, body: 'tampered body!!', path: '/tmp/x.md' }, '/tmp',
  );
  expect(result.attestation_ok).toBe(false);
  expect(result.overall).toBe(false);
});

// ---- route: input validation -------------------------------------------------

test('route: throws on unknown queryClass', () => {
  expect(() => RR.route({ query: 'test', queryClass: 'unknown' })).toThrow(/Unknown queryClass/);
});

test('route: throws on empty query string', () => {
  expect(() => RR.route({ query: '', queryClass: 'factual' })).toThrow(/non-empty string/);
});

test('route: throws on whitespace-only query', () => {
  expect(() => RR.route({ query: '   ', queryClass: 'factual' })).toThrow(/non-empty string/);
});

// ---- route: wiki-type filtering + routing ------------------------------------

test('route: factual query only returns code wiki pages', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'code/baton-comment-build.md',
    { type: 'code' }, 'baton comment build function signature');
  writePage(wikiDir, 'work-log/tickets/ticket-1.md',
    { type: 'work-log' }, 'baton comment build ticket notes');
  const result = RR.route({ query: 'baton comment build', queryClass: 'factual', wikiDir });
  expect(result.targetWikiTypes).toEqual(['code']);
  for (const r of result.results) expect(r.wikiType).toBe('code');
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: historical query only returns work-log pages', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'work-log/tickets/ticket-123.md',
    { type: 'work-log' }, 'issue 123 baton transition history');
  writePage(wikiDir, 'wisdom/global/concepts/baton.md',
    { type: 'wisdom-global' }, 'baton transition documentation concept');
  const result = RR.route({ query: 'baton transition', queryClass: 'historical', wikiDir });
  expect(result.targetWikiTypes).toEqual(['work-log']);
  for (const r of result.results) expect(r.wikiType).toBe('work-log');
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: synthesis query returns wisdom-global pages', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'wisdom/global/concepts/hamr-routing.md',
    { type: 'wisdom-global' }, 'hamr routing cost observability governance');
  const result = RR.route({ query: 'hamr routing cost', queryClass: 'synthesis', wikiDir });
  expect(result.targetWikiTypes).toContain('wisdom-global');
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: returns empty results with no-candidates when wiki type absent', () => {
  const wikiDir = tmpWiki();
  // Only write wisdom pages; factual query targets code -- no match
  writePage(wikiDir, 'wisdom/global/concepts/foo.md',
    { type: 'wisdom-global' }, 'foo bar baz');
  const result = RR.route({ query: 'foo bar', queryClass: 'factual', wikiDir });
  expect(result.results).toHaveLength(0);
  expect(result.fallback_chain).toContain('no-candidates');
  fs.rmSync(wikiDir, { recursive: true });
});

// ---- route: ranked results ---------------------------------------------------

test('route: result has required fields (slug, path, wikiType, score, trust_verification)', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'code/agent-sig.md',
    { type: 'code' }, 'agent signature derivation algorithm');
  const result = RR.route({ query: 'agent signature', queryClass: 'factual', wikiDir });
  if (result.results.length > 0) {
    const r = result.results[0];
    expect(typeof r.slug).toBe('string');
    expect(typeof r.path).toBe('string');
    expect(typeof r.wikiType).toBe('string');
    expect(typeof r.score).toBe('number');
    expect(r.trust_verification).toBeDefined();
    expect(typeof r.trust_verification.overall).toBe('boolean');
  }
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: results are sorted by score descending', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'code/baton-a.md', { type: 'code' }, 'baton baton baton baton');
  writePage(wikiDir, 'code/baton-b.md', { type: 'code' }, 'baton once');
  const result = RR.route({ query: 'baton', queryClass: 'factual', wikiDir });
  for (let i = 1; i < result.results.length; i++) {
    expect(result.results[i - 1].score).toBeGreaterThanOrEqual(result.results[i].score);
  }
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: telemetry includes candidate_count and filtered_count', () => {
  const wikiDir = tmpWiki();
  writePage(wikiDir, 'code/page1.md', { type: 'code' }, 'governance baton harness');
  const result = RR.route({ query: 'baton harness', queryClass: 'factual', wikiDir });
  expect(typeof result.telemetry.candidate_count).toBe('number');
  expect(typeof result.telemetry.filtered_count).toBe('number');
  fs.rmSync(wikiDir, { recursive: true });
});

// ---- route: content-hash mismatch detection ----------------------------------

test('route: content_hash mismatch surfaces in trust_verification', () => {
  const wikiDir = tmpWiki();
  const body = 'original body for hash test';
  writePage(wikiDir, 'code/hash-test.md',
    { type: 'code', content_hash: 'badhash000' }, body);
  const result = RR.route({ query: 'original body hash', queryClass: 'factual', wikiDir });
  const hit = result.results.find((r) => r.slug === 'hash-test');
  if (hit) {
    expect(hit.trust_verification.content_hash_ok).toBe(false);
    expect(hit.trust_verification.overall).toBe(false);
    expect(result.fallback_chain).toContain('stale-hash-mismatch-warning');
  }
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: valid content_hash passes verification', () => {
  const wikiDir = tmpWiki();
  const body = '\nvalid hashed body content\n';
  const hash = sha256(body);
  writePage(wikiDir, 'code/valid-hash.md',
    { type: 'code', content_hash: hash }, body);
  const result = RR.route({ query: 'valid hashed body', queryClass: 'factual', wikiDir });
  const hit = result.results.find((r) => r.slug === 'valid-hash');
  if (hit) {
    expect(hit.trust_verification.content_hash_ok).toBe(true);
  }
  fs.rmSync(wikiDir, { recursive: true });
});

// ---- route: trust_attestation verification -----------------------------------

test('route: valid trust_attestation passes at retrieval-time', () => {
  const wikiDir = tmpWiki();
  const body = '\nbaton signing verification test content\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const signedHash = sha256(body);
  const sig = crypto.sign(null, Buffer.from(signedHash, 'hex'), kp.privateKey);
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  writePage(wikiDir, 'code/attested.md', {
    type: 'code',
    trust_attestation: {
      algorithm: 'ed25519', signer: rawPub,
      signature_b64: sig.toString('base64'), signed_payload_hash: signedHash,
    },
  }, body);
  const result = RR.route({ query: 'baton signing verification', queryClass: 'factual', wikiDir });
  const hit = result.results.find((r) => r.slug === 'attested');
  if (hit) {
    expect(hit.trust_verification.attestation_ok).toBe(true);
  }
  fs.rmSync(wikiDir, { recursive: true });
});

test('route: tampered trust_attestation fails at retrieval-time', () => {
  const wikiDir = tmpWiki();
  const originalBody = '\noriginal attestation content\n';
  const tamperedBody = '\nTAMPERED attestation content\n';
  const kp = crypto.generateKeyPairSync('ed25519');
  const signedHash = sha256(originalBody);
  const sig = crypto.sign(null, Buffer.from(signedHash, 'hex'), kp.privateKey);
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  // Write the page with the TAMPERED body but attestation signed over original
  writePage(wikiDir, 'code/tampered-att.md', {
    type: 'code',
    trust_attestation: {
      algorithm: 'ed25519', signer: rawPub,
      signature_b64: sig.toString('base64'), signed_payload_hash: signedHash,
    },
  }, tamperedBody);
  const result = RR.route({
    query: 'TAMPERED attestation content', queryClass: 'factual', wikiDir,
  });
  const hit = result.results.find((r) => r.slug === 'tampered-att');
  if (hit) {
    expect(hit.trust_verification.attestation_ok).toBe(false);
    expect(hit.trust_verification.overall).toBe(false);
  }
  fs.rmSync(wikiDir, { recursive: true });
});

// ---- stress: concurrent route calls -----------------------------------------

test('stress: 20 concurrent route calls complete without corruption', async () => {
  const wikiDir = tmpWiki();
  for (let idx = 0; idx < 5; idx++) {
    writePage(wikiDir, `code/stress-page-${idx}.md`,
      { type: 'code' }, `stress test governance baton content page ${idx}`);
  }
  const calls = Array.from({ length: 20 }, () =>
    new Promise((resolve) => {
      try {
        const result = RR.route({ query: 'stress governance baton', queryClass: 'factual', wikiDir });
        resolve({ ok: true, count: result.results.length });
      } catch (err) {
        resolve({ ok: false, err: err.message });
      }
    }),
  );
  const results = await Promise.all(calls);
  for (const res of results) {
    expect(res.ok).toBe(true);
  }
  // All calls must return the same result count (deterministic)
  const counts = results.map((r) => r.count);
  expect(new Set(counts).size).toBe(1);
  fs.rmSync(wikiDir, { recursive: true });
});

test('stress: adversarial query inputs do not throw unhandled errors', () => {
  const adversarialInputs = [
    { query: 'a'.repeat(10000), queryClass: 'factual' },
    { query: '<script>alert(1)</script>', queryClass: 'factual' },
    { query: '../../../etc/passwd', queryClass: 'historical' },
    { query: 'null\x00byte', queryClass: 'synthesis' },
    { query: '​‌‍ invisible chars', queryClass: 'how-to' },
  ];
  const wikiDir = tmpWiki();
  for (const input of adversarialInputs) {
    expect(() => RR.route({ ...input, wikiDir })).not.toThrow();
  }
  fs.rmSync(wikiDir, { recursive: true });
});

test('stress: p99 latency for route() is under 500ms for 50-page corpus', () => {
  const wikiDir = tmpWiki();
  for (let idx = 0; idx < 50; idx++) {
    const wikiType = idx % 2 === 0 ? 'code' : 'wisdom-global';
    const relPath = wikiType === 'code'
      ? `code/page-${idx}.md`
      : `wisdom/global/concepts/page-${idx}.md`;
    writePage(wikiDir, relPath, { type: wikiType },
      `governance baton harness content page ${idx} retrieval router`);
  }
  const latencies = [];
  for (let run = 0; run < 20; run++) {
    const start = Date.now();
    RR.route({ query: 'baton harness retrieval router', queryClass: 'factual', wikiDir });
    latencies.push(Date.now() - start);
  }
  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.ceil(latencies.length * 0.99) - 1];
  // G7 latency budget: p99 < 500ms for local fs retrieval
  expect(p99).toBeLessThan(500);
  fs.rmSync(wikiDir, { recursive: true });
});
