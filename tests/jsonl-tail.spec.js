// jsonl-tail — tdd-pyramid tests (#1354, Epic #1339 C3).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const T = require(path.resolve(__dirname, '..', 'scripts', 'global', 'jsonl-tail.js'));

const settle = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));

function makeFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonl-tail-'));
  return { dir, file: path.join(dir, 'sample.jsonl') };
}

test('tail: emits onLine for each appended event', async () => {
  const { dir, file } = makeFile();
  fs.writeFileSync(file, '');
  const lines = [];
  const handle = T.tail(file, (event) => lines.push(event));
  await settle();
  fs.appendFileSync(file, JSON.stringify({ event: 'a' }) + '\n' + JSON.stringify({ event: 'b' }) + '\n');
  await settle(300);
  handle.close();
  expect(lines.map(l => l.event)).toContain('a');
  expect(lines.map(l => l.event)).toContain('b');
  fs.rmSync(dir, { recursive: true });
});

test('tail: tracks offset; only new lines after open are emitted', async () => {
  const { dir, file } = makeFile();
  fs.writeFileSync(file, JSON.stringify({ event: 'before' }) + '\n');
  const lines = [];
  const handle = T.tail(file, (event) => lines.push(event));
  await settle();
  fs.appendFileSync(file, JSON.stringify({ event: 'after' }) + '\n');
  await settle(300);
  handle.close();
  expect(lines.map(l => l.event)).not.toContain('before');
  expect(lines.map(l => l.event)).toContain('after');
  fs.rmSync(dir, { recursive: true });
});

test('readFromOffset: shrunken file resets offset', () => {
  const { dir, file } = makeFile();
  fs.writeFileSync(file, 'AAAAA\n');
  const r1 = T.readFromOffset(file, 0);
  expect(r1.content).toBe('AAAAA\n');
  // Truncate to smaller
  fs.writeFileSync(file, 'BB\n');
  // Saved offset was 6 from r1; new file size is 3 → should reset to 0
  const r2 = T.readFromOffset(file, 6);
  expect(r2.newOffset).toBe(3);
  expect(r2.content).toBe('BB\n');
  fs.rmSync(dir, { recursive: true });
});

test('parseLines: valid events emit; malformed JSON triggers onError', () => {
  const events = [];
  const errors = [];
  T.parseLines(
    JSON.stringify({ a: 1 }) + '\nnot-json\n' + JSON.stringify({ b: 2 }) + '\n',
    (event) => events.push(event),
    (err) => errors.push(err),
  );
  expect(events).toHaveLength(2);
  expect(errors).toHaveLength(1);
  expect(errors[0].kind).toBe('parse');
});

test('tail: close() stops emitting events', async () => {
  const { dir, file } = makeFile();
  fs.writeFileSync(file, '');
  const lines = [];
  const handle = T.tail(file, (event) => lines.push(event));
  await settle();
  handle.close();
  fs.appendFileSync(file, JSON.stringify({ event: 'post-close' }) + '\n');
  await settle(300);
  expect(lines.length).toBe(0);
  fs.rmSync(dir, { recursive: true });
});

test('tail: getOffset / getDropped / getBufferDepth exposed', () => {
  const { dir, file } = makeFile();
  fs.writeFileSync(file, JSON.stringify({ event: 'a' }) + '\n');
  const handle = T.tail(file, () => {});
  expect(typeof handle.getOffset()).toBe('number');
  expect(handle.getDropped()).toBe(0);
  expect(handle.getBufferDepth()).toBe(0);
  handle.close();
  fs.rmSync(dir, { recursive: true });
});
