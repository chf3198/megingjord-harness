// Refs #2802 P1-0 — fleet context-bundle assembler (D12/D15). Pure-path tests (no network).
const { test, expect } = require('@playwright/test');
const path = require('path');
const {
  assembleContextBundle, ticketContext, repoMap, wikiContext, buildManifest,
} = require('../scripts/global/fleet-context-bundle.js');

const ROOT = path.join(__dirname, '..');
const SELF = 'scripts/global/fleet-context-bundle.js';

test('#2802 repoMap extracts signatures from a real file', () => {
  const [entry] = repoMap([SELF], ROOT);
  expect(entry.available).toBe(true);
  expect(entry.symbols.some((sig) => sig.includes('function assembleContextBundle'))).toBe(true);
});

test('#2802 repoMap degrades gracefully on a missing file (G6)', () => {
  expect(repoMap(['does/not/exist.js'], ROOT)[0]).toEqual({ path: 'does/not/exist.js', available: false });
});

test('#2802 buildManifest lists only available parts', () => {
  const manifest = buildManifest({ ticket: { available: true }, wiki: [], repoMap: [{ available: true }] });
  expect(manifest.included).toContain('ticket');
  expect(manifest.included).toContain('repoMap');
  expect(manifest.included).not.toContain('wiki'); // empty array = not included
  expect(manifest.schema).toBe('fleet-context-bundle/v1');
});

test('#2802 ticketContext(null) returns null (no network)', () => {
  expect(ticketContext(null)).toBeNull();
});

test('#2802 wikiContext with no query returns [] (no network)', () => {
  expect(wikiContext('')).toEqual([]);
});

test('#2802 assembleContextBundle includes repo-map + manifest (D12)', () => {
  const bundle = assembleContextBundle({ paths: [SELF] }); // no ticket/wikiQuery => no network
  expect(bundle.repoMap[0].available).toBe(true);
  expect(bundle.manifest.included).toContain('repoMap');
});

test('#2802 D15: alreadyBundled parts are dropped from the bundle', () => {
  const bundle = assembleContextBundle({ paths: [SELF], alreadyBundled: ['ticket', 'wiki'] });
  expect(bundle.ticket).toBeUndefined();
  expect(bundle.wiki).toBeUndefined();
  expect(bundle.repoMap).toBeDefined();
  expect(bundle.manifest.included).toEqual(['repoMap']);
});

// #2819 security hardening
test('#2819 ticketContext rejects non-integer id (no shell injection)', () => {
  expect(ticketContext('2802; rm -rf /')).toEqual({ number: '2802; rm -rf /', available: false });
  expect(ticketContext(-5)).toEqual({ number: -5, available: false });
  expect(ticketContext(1.5)).toEqual({ number: 1.5, available: false });
  expect(ticketContext(null)).toBeNull();
});

test('#2819 repoMap refuses paths escaping root (path traversal)', () => {
  expect(repoMap(['../../etc/passwd'], ROOT)[0]).toEqual({ path: '../../etc/passwd', available: false });
  expect(repoMap([SELF], ROOT)[0].available).toBe(true); // legit path still works
});

// #2802 robustness (gemini-2.5-pro OOM/binary finding): skip oversize + binary files, not crash.
test('#2802 repoMap skips an oversize file (OOM guard) but reads its own text source', () => {
  const fs = require('fs');
  const os = require('os');
  const big = path.join(os.tmpdir(), `fleet-ctx-big-${process.pid}.txt`);
  fs.writeFileSync(big, 'x'.repeat(300 * 1024)); // 300KB > MAX_FILE_BYTES (256KB)
  try {
    // oversize file lives outside ROOT, so pass its own dir as root to isolate the size check
    expect(repoMap([path.basename(big)], os.tmpdir())[0].available).toBe(false);
  } finally { fs.unlinkSync(big); }
  expect(repoMap([SELF], ROOT)[0].available).toBe(true); // text source is NOT misflagged as binary
});

test('#2802 repoMap flags a NUL-bearing (binary) file as unavailable', () => {
  const fs = require('fs');
  const os = require('os');
  const bin = path.join(os.tmpdir(), `fleet-ctx-bin-${process.pid}.dat`);
  fs.writeFileSync(bin, Buffer.from([0x41, 0x00, 0x42])); // 'A', NUL, 'B'
  try {
    expect(repoMap([path.basename(bin)], os.tmpdir())[0].available).toBe(false);
  } finally { fs.unlinkSync(bin); }
});

// #2802 G8 (gemini-2.5-pro observability finding): silent by default, diagnosable under opt-in flag.
test('#2802 ticketContext failure is silent by default, logs to stderr under debug flag', () => {
  const { spawnSync } = require('child_process');
  // issue 999999999 does not exist → `gh issue view` fails → runQuiet catch path exercised.
  const script = "const{ticketContext}=require('./scripts/global/fleet-context-bundle.js');"
    + 'console.log(JSON.stringify(ticketContext(999999999)));';
  const opts = { cwd: path.join(__dirname, '..'), encoding: 'utf8' };
  const quiet = spawnSync('node', ['-e', script], { ...opts, env: { ...process.env } });
  const debug = spawnSync('node', ['-e', script], { ...opts, env: { ...process.env, MEGINGJORD_FLEET_CTX_DEBUG: '1' } });
  expect(quiet.status).toBe(0); // graceful: never throws
  expect(quiet.stderr).not.toContain('[fleet-context]'); // silent by default
  expect(debug.stderr).toContain('[fleet-context] source unavailable'); // diagnosable on opt-in
});
