// log-rotate tests (#941).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const ROT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'log-rotate.js'));

function tmpFile() { return path.join(os.tmpdir(), `log-rotate-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`); }

test('countLines counts JSONL lines correctly', () => {
  const f = tmpFile();
  fs.writeFileSync(f, '{"a":1}\n{"a":2}\n{"a":3}\n');
  expect(ROT.countLines(f)).toBe(3);
  fs.unlinkSync(f);
});

test('countLines returns 0 on missing or empty file', () => {
  expect(ROT.countLines('/nonexistent/path/log.jsonl')).toBe(0);
  const f = tmpFile();
  fs.writeFileSync(f, '');
  expect(ROT.countLines(f)).toBe(0);
  fs.unlinkSync(f);
});

test('rotate skips when under maxLines', () => {
  const f = tmpFile();
  fs.writeFileSync(f, '{"a":1}\n{"a":2}\n');
  const r = ROT.rotate(f, { maxLines: 100 });
  expect(r.rotated).toBe(false);
  expect(r.lines).toBe(2);
  fs.unlinkSync(f);
});

test('rotate archives + truncates when over maxLines', () => {
  const f = tmpFile();
  let content = '';
  for (let i = 0; i < 50; i += 1) content += JSON.stringify({ i }) + '\n';
  fs.writeFileSync(f, content);
  const r = ROT.rotate(f, { maxLines: 10 });
  expect(r.rotated).toBe(true);
  expect(r.lines).toBe(50);
  expect(fs.existsSync(r.archive)).toBe(true);
  expect(fs.readFileSync(f, 'utf8')).toBe('');
  const restored = zlib.gunzipSync(fs.readFileSync(r.archive)).toString();
  expect(restored.split('\n').filter(Boolean)).toHaveLength(50);
  fs.unlinkSync(f);
  fs.unlinkSync(r.archive);
});
