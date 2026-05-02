// Tests for #784 RAG search MVP
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAG = '../scripts/global/rag-search';

let originalCwd;
let tmpDir;

test.beforeEach(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
  fs.mkdirSync(path.join(tmpDir, '.dashboard'), { recursive: true });
  process.chdir(tmpDir);
  delete require.cache[require.resolve(RAG)];
  delete process.env.MCP_RAG_URL;
});

test.afterEach(() => {
  process.chdir(originalCwd);
});

test('_ragUrl returns null without manifest', () => {
  const r = require(RAG);
  expect(r._ragUrl()).toBeNull();
});

test('_ragUrl returns null when mcp.rag_server unreachable', () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    mcp: { rag_server: { reachable: false } },
  }));
  const r = require(RAG);
  expect(r._ragUrl()).toBeNull();
});

test('_ragUrl returns URL from manifest when reachable', () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    mcp: { rag_server: { reachable: true, url: 'http://example.com:11435' } },
  }));
  const r = require(RAG);
  expect(r._ragUrl()).toBe('http://example.com:11435');
});

test('_ragUrl env var overrides manifest URL', () => {
  fs.writeFileSync(path.join(tmpDir, '.dashboard', 'capabilities.json'), JSON.stringify({
    mcp: { rag_server: { reachable: true, url: 'http://manifest:11435' } },
  }));
  process.env.MCP_RAG_URL = 'http://env-override:11435';
  const r = require(RAG);
  expect(r._ragUrl()).toBe('http://env-override:11435');
});

test('search returns invalid-query for empty input', async () => {
  const { search } = require(RAG);
  const r = await search('');
  expect(r.source).toBe('invalid-query');
  expect(r.results).toEqual([]);
});

test('search falls back to ripgrep when no manifest', async () => {
  fs.writeFileSync(path.join(tmpDir, 'sample.js'), 'function foo() { return 42; }\n');
  const { search } = require(RAG);
  const r = await search('foo');
  expect(r.source).toBe('ripgrep-fallback');
  expect(Array.isArray(r.results)).toBe(true);
});
