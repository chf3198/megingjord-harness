// #2645: unit tests for the repo-root .env hydration shim (load-local-env.js).
// Goal coverage: G2 precedence (AC2), G4 secret-handling (AC3), G5/G6 graceful (AC4), G8 audit (AC5).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { loadLocalEnv, parseEnv, hydrate } =
  require(path.join(ROOT, 'scripts', 'global', 'load-local-env.js'));

function writeTempEnv(contents) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'env2645-')), '.env');
  fs.writeFileSync(file, contents);
  return file;
}

test('parseEnv strips export/quotes and skips comments, blanks, and malformed lines', () => {
  const pairs = parseEnv('# c\n\nexport A=1\nB="two"\nC=\'three\'\n=bad\nnot-an-ident=x\nD=4');
  expect(Object.fromEntries(pairs)).toEqual({ A: '1', B: 'two', C: 'three', D: '4' });
});

test('AC2 precedence: hydrate fills absent keys only and never overrides a set value', () => {
  const target = { PRESET: 'keep' };
  const filled = hydrate(target, [['PRESET', 'fromfile'], ['NEWKEY', 'v']]);
  expect(target.PRESET).toBe('keep');
  expect(target.NEWKEY).toBe('v');
  expect(filled).toEqual(['NEWKEY']);
});

test('AC2 precedence via loadLocalEnv: pre-set process-style value survives', () => {
  const file = writeTempEnv('SECRETX=sk-LIVE-should-not-win\nFRESHKEY=ok');
  const env = { SECRETX: 'preset-wins' };
  const res = loadLocalEnv({ env, path: file, quiet: true });
  expect(env.SECRETX).toBe('preset-wins');
  expect(res.filled).toEqual(['FRESHKEY']);
});

test('AC3 disable flag fully suppresses loading', () => {
  const file = writeTempEnv('K=v');
  const res = loadLocalEnv({ env: { MEGINGJORD_NO_DOTENV: '1' }, path: file });
  expect(res.skipped).toBe('disabled');
  expect(res.filled).toEqual([]);
});

test('AC3 secret-handling: audit line emits NAMES only, never the secret value', () => {
  const file = writeTempEnv('TAVILY_API_KEY=tvly-SUPERSECRET-VALUE');
  const lines = [];
  const original = process.stderr.write;
  process.stderr.write = (chunk) => { lines.push(String(chunk)); return true; };
  try { loadLocalEnv({ env: {}, path: file }); } finally { process.stderr.write = original; }
  const joined = lines.join('');
  expect(joined).toContain('TAVILY_API_KEY');
  expect(joined).not.toContain('SUPERSECRET-VALUE');
  expect(lines.filter((l) => l.includes('env-hydrate:')).length).toBe(1); // AC5: exactly one line
});

test('AC4 graceful: missing .env is a no-op pass-through, never a throw', () => {
  const res = loadLocalEnv({ env: {}, path: path.join(os.tmpdir(), 'no-such-2645', '.env') });
  expect(res.skipped).toBe('missing');
  expect(res.filled).toEqual([]);
});
