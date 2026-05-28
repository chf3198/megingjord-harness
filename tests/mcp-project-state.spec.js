'use strict';
// mcp-project-state.spec.js — tdd-pyramid+contract-test (#2056)
const { test, expect } = require('@playwright/test');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const mod = require('../scripts/global/mcp-project-state.js');

function buildWiki(base) {
  [path.join(base,'code','symbols'), path.join(base,'work-log','tickets'),
   path.join(base,'wisdom','global','concepts'), path.join(base,'wisdom','project','research')]
    .forEach((d) => fs.mkdirSync(d, { recursive: true }));
  fs.writeFileSync(path.join(base,'code','symbols','handler.md'), '# handler\nMCP code');
  fs.writeFileSync(path.join(base,'work-log','tickets','t1.md'), '# ticket\nbaton workflow');
  fs.writeFileSync(path.join(base,'wisdom','global','concepts','signing.md'), '# signing\ned25519');
  fs.writeFileSync(path.join(base,'wisdom','project','research','r1.md'), '# research\npagination');
  return base;
}

let tmpWiki;
test.beforeAll(() => { tmpWiki = buildWiki(fs.mkdtempSync(path.join(os.tmpdir(), 'wiki2056-'))); });
test.afterAll(() => { fs.rmSync(tmpWiki, { recursive: true, force: true }); });

const W = () => ({ wikiRoot: tmpWiki });

test('1: ok:true with items for all query_type', async () => {
  const r = await mod.handle({ query_type: 'all' }, W());
  expect(r.ok).toBe(true);
  expect(Array.isArray(r.items)).toBe(true);
  expect(r.audit_id).toMatch(/^pstate-/);
});

test('2: ok:false when wiki root not found', async () => {
  const r = await mod.handle({}, { wikiRoot: '/no/such/wiki' });
  expect(r.ok).toBe(false);
  expect(r.error).toBe('wiki_root_not_found');
});

test('3: query_type=code returns only code-subtree items', async () => {
  const r = await mod.handle({ query_type: 'code' }, W());
  expect(r.ok).toBe(true);
  expect(r.items.every((i) => i.path.startsWith('code'))).toBe(true);
});

test('4: filter returns scored items matching keyword', async () => {
  const r = await mod.handle({ filter: 'signing' }, W());
  expect(r.ok).toBe(true);
  expect(r.items.length).toBeGreaterThanOrEqual(1);
  expect(r.items[0].score).toBeGreaterThan(0);
});

test('5: page_size=1 yields one item and a next_page_token', async () => {
  const r = await mod.handle({ page_size: 1 }, W());
  expect(r.items.length).toBe(1);
  expect(r.next_page_token).not.toBeNull();
});

test('6: second page via next_page_token returns different item', async () => {
  const first = await mod.handle({ page_size: 1 }, W());
  const second = await mod.handle({ page_size: 1, page_token: first.next_page_token }, W());
  expect(second.items[0].path).not.toBe(first.items[0].path);
});

test('7: requesting all items yields null next_page_token', async () => {
  const r = await mod.handle({ page_size: 50 }, W());
  expect(r.next_page_token).toBeNull();
});

test('8: audit_id is unique across concurrent calls', async () => {
  const [a, b] = await Promise.all([mod.handle({}, W()), mod.handle({}, W())]);
  expect(a.audit_id).not.toBe(b.audit_id);
});

test('9: sig_block is null when no mutation provided', async () => {
  const r = await mod.handle({}, W());
  expect(r.sig_block).toBeNull();
});

test('10: sig_block has all Ed25519 fields when mutation provided', async () => {
  const r = await mod.handle({ mutation: { action: 'update', target: 'code/x.md' } }, W());
  expect(r.ok).toBe(true);
  expect(r.sig_block).not.toBeNull();
  expect(typeof r.sig_block.signature).toBe('string');
  expect(r.sig_block.signature.length).toBeGreaterThan(80);
  expect(['T3-env', 'T4']).toContain(r.sig_block.tier);
});

test('11: decodeToken/encodeToken roundtrip', () => {
  expect(mod.decodeToken(mod.encodeToken(42))).toBe(42);
  expect(mod.decodeToken(null)).toBe(0);
});

test('12: SUBTREES export contains required keys', () => {
  expect(Object.keys(mod.SUBTREES)).toEqual(
    expect.arrayContaining(['code', 'work-log', 'wisdom', 'all']));
});
