// constitution-compressor + rule-coverage-gate tests (#925).
const { test, expect } = require('@playwright/test');
const path = require('path');

const COMP = require(path.resolve(__dirname, '..', 'scripts', 'global', 'constitution-compressor.js'));
const GATE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'rule-coverage-gate.js'));

test('TIERS includes all four expected tiers', () => {
  for (const t of ['fim-5kb', 'routing-12kb', 'governance-30kb', 'architect-90kb']) {
    expect(COMP.TIERS).toHaveProperty(t);
    expect(typeof COMP.TIERS[t].target_chars).toBe('number');
  }
});

test('scoreLine boosts headings + bullets + keyword lines', () => {
  const kw = ['MANAGER_HANDOFF'];
  expect(COMP.scoreLine('# Heading', kw)).toBeGreaterThan(0);
  expect(COMP.scoreLine('- bullet', kw)).toBeGreaterThan(0);
  expect(COMP.scoreLine('the MANAGER_HANDOFF artifact', kw)).toBeGreaterThanOrEqual(10);
  expect(COMP.scoreLine('plain prose line', kw)).toBeLessThan(10);
});

test('compressFile keeps text under target budget', () => {
  const input = { rel: 'test.md', content: Array.from({ length: 100 }, (_, i) => `line ${i} MANAGER_HANDOFF`).join('\n') };
  const out = COMP.compressFile(input, ['MANAGER_HANDOFF'], 200);
  expect(out.content.length).toBeLessThanOrEqual(200);
  expect(out.rel).toBe('test.md');
});

test('compressFile preserves original line ordering', () => {
  const input = { rel: 'test.md', content: 'line A\nline B MANAGER_HANDOFF\nline C\nline D MANAGER_HANDOFF\nline E' };
  const out = COMP.compressFile(input, ['MANAGER_HANDOFF'], 60);
  const lines = out.content.split('\n');
  // Whatever survives must appear in the original order.
  let lastIdx = -1;
  for (const line of lines) {
    const idx = input.content.split('\n').indexOf(line);
    expect(idx).toBeGreaterThan(lastIdx);
    lastIdx = idx;
  }
});

test('buildTier produces deterministic SHA-256', () => {
  const t1 = COMP.buildTier('routing-12kb', COMP.TIERS['routing-12kb'], COMP.DEFAULT_KEYWORDS);
  const t2 = COMP.buildTier('routing-12kb', COMP.TIERS['routing-12kb'], COMP.DEFAULT_KEYWORDS);
  expect(t1.sha256).toBe(t2.sha256);
  expect(t1.sha256).toMatch(/^[a-f0-9]{64}$/);
});

test('buildTier compression ratio is reasonable', () => {
  const t = COMP.buildTier('governance-30kb', COMP.TIERS['governance-30kb'], COMP.DEFAULT_KEYWORDS);
  expect(t.raw_chars).toBeGreaterThan(0);
  expect(t.compressed_chars).toBeGreaterThan(0);
  expect(parseFloat(t.compression_ratio)).toBeLessThanOrEqual(1.0);
});

test('compressAllTiers produces all four tiers with stable SHAs', () => {
  const all = COMP.compressAllTiers();
  expect(Object.keys(all).sort()).toEqual(['architect-90kb', 'fim-5kb', 'governance-30kb', 'routing-12kb']);
  for (const tier of Object.values(all)) {
    expect(tier.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(tier.files).toBeGreaterThan(0);
  }
});

test('stage1 returns ok:true when keywords all present', () => {
  const fakeCompressed = { tier: 'test', compressed_files: [{ rel: 'x', content: 'role:manager MANAGER_HANDOFF Refs # role:collaborator' }] };
  const r = GATE.stage1(fakeCompressed, ['role:manager', 'MANAGER_HANDOFF']);
  expect(r.ok).toBe(true);
  expect(r.ratio).toBe(1);
  expect(r.missing).toEqual([]);
});

test('stage1 returns ok:false with missing keywords listed', () => {
  const fakeCompressed = { tier: 'test', compressed_files: [{ rel: 'x', content: 'only role:manager here' }] };
  const r = GATE.stage1(fakeCompressed, ['role:manager', 'MISSING_TERM_X', 'MISSING_TERM_Y']);
  expect(r.ok).toBe(false);
  expect(r.missing).toContain('MISSING_TERM_X');
  expect(r.missing).toContain('MISSING_TERM_Y');
});

test('stage2a skipped when judgeQuorum not provided', async () => {
  const fakeTier = { tier: 'test', compressed_files: [{ content: 'x' }] };
  const r = await GATE.stage2a(fakeTier, [{ q: 'q', type: 'direct' }], null);
  expect(r.ok).toBe(false);
  expect(r.judge_present).toBe(false);
});

test('runGate aggregates stages correctly', async () => {
  const tier = COMP.buildTier('routing-12kb', COMP.TIERS['routing-12kb'], COMP.DEFAULT_KEYWORDS);
  const r = await GATE.runGate(tier, []);
  expect(r.tier).toBe('routing-12kb');
  expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(r.stages).toMatchObject({ stage1: expect.any(Object), stage2a: expect.any(Object), stage2b: expect.any(Object) });
});

test('STAGE thresholds match v3.2.1 §R6', () => {
  expect([GATE.STAGE_1_THRESHOLD, GATE.STAGE_2A_THRESHOLD, GATE.STAGE_2B_THRESHOLD, GATE.STAGE_3_FLOOR]).toEqual([0.99, 0.80, 0.95, 0.50]);
});
