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
