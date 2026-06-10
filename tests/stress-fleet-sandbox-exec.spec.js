// Stress tests for #2844 sandbox test-exec — adversarial path corpus (chaos/fault-injection, G6) +
// a p99 latency budget on the pure validation path (G7). Process/network-free: the runner is injected.
// Goal alignment: G1 fail-closed governance, G2 quality, G6 resilience, G7 throughput.
const { test, expect } = require('@playwright/test');
const { validateProposedChange, partitionChanges, MAX_PAYLOAD_BYTES }
  = require('../scripts/global/fleet-sandbox-exec.js');
const { clampOutput, MAX_OUTPUT_BYTES } = require('../scripts/global/fleet-sandbox-runner.js');

const ROOT = '/repo';
const okRunner = () => ({ exitCode: 0, stdout: 'PASS', stderr: '' });

// Adversarial paths a hostile fleet payload might propose — every one MUST be rejected (never written).
const HOSTILE_PATHS = [
  '../etc/passwd', '../../root/.ssh/authorized_keys', '/etc/shadow', 'a/../../b',
  'scripts/../../escape', './../x', 'nested/ok/../../../../evil', '/abs', '..',
];

test('#2844 CHAOS: every hostile path is rejected and short-circuits to untrusted', () => {
  for (const hostile of HOSTILE_PATHS) {
    const { safe, rejected } = partitionChanges([{ path: hostile, content: 'pwn' }], ROOT);
    expect(safe).toEqual([]);
    expect(rejected.length).toBe(1);
    let runnerCalls = 0;
    const out = validateProposedChange({
      changes: [{ path: hostile, content: 'pwn' }], testCommand: ['true'], root: ROOT,
      runner: () => { runnerCalls += 1; return okRunner(); },
    });
    expect(out.trusted).toBe(false);
    expect(runnerCalls).toBe(0); // fail-closed: no sandbox created for a hostile payload
  }
});

test('#2844 CHAOS: a mixed batch (one safe + many hostile) is rejected wholesale', () => {
  const changes = [{ path: 'scripts/ok.js', content: 'ok' },
    ...HOSTILE_PATHS.map((hostile) => ({ path: hostile, content: 'pwn' }))];
  const out = validateProposedChange({ changes, testCommand: ['true'], root: ROOT, runner: okRunner });
  expect(out.trusted).toBe(false);
  expect(out.reason).toMatch(/unsafe change paths/);
});

test('#2844 CHAOS: a runner that throws/timeouts never yields trusted', () => {
  const throwing = validateProposedChange({ changes: [], testCommand: ['x'], root: ROOT,
    runner: () => { throw new Error('spawn ENOENT'); } });
  expect(throwing.trusted).toBe(false);
  const timing = validateProposedChange({ changes: [], testCommand: ['x'], root: ROOT,
    runner: () => ({ timedOut: true, exitCode: null, stdout: '', stderr: '' }) });
  expect(timing.trusted).toBe(false);
});

test('#2844 CHAOS: clampOutput bounds a runaway log to the byte budget', () => {
  const huge = 'x'.repeat(MAX_OUTPUT_BYTES * 2);
  const clamped = clampOutput(huge);
  expect(clamped.length).toBeLessThanOrEqual(MAX_OUTPUT_BYTES + 16);
  expect(clamped).toMatch(/clipped/);
});

test('#2844 CHAOS: an oversize payload is rejected before any sandbox is created (DoS guard)', () => {
  let runnerCalls = 0;
  const huge = 'x'.repeat(MAX_PAYLOAD_BYTES + 1);
  const out = validateProposedChange({
    changes: [{ path: 'big.bin', content: huge }], testCommand: ['true'], root: ROOT,
    runner: () => { runnerCalls += 1; return okRunner(); },
  });
  expect(out.trusted).toBe(false);
  expect(out.reason).toMatch(/exceeds 10MB/);
  expect(runnerCalls).toBe(0); // fail-closed: nothing written, no sandbox spun up
});

test('#2844 PERF: validateProposedChange p99 < 5ms on the pure (injected-runner) path', () => {
  const changes = Array.from({ length: 10 }, (_unused, idx) => ({ path: `s/f${idx}.js`, content: 'x' }));
  const samples = [];
  for (let iter = 0; iter < 2000; iter += 1) {
    const start = process.hrtime.bigint();
    validateProposedChange({ changes, testCommand: ['true'], root: ROOT, runner: okRunner });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99).toBeLessThan(5);
});
