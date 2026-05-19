'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { Worker } = require('node:worker_threads'); const { spawnSync } = require('node:child_process');
const W = require('../scripts/wiki-metrics.js');

function tmpFile() {
  return path.join(os.tmpdir(), `wm-stress-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('stress: 10 parallel writers preserve all updates (AC1)', async () => {
  const file = tmpFile(); const mod = path.join(__dirname, '..', 'scripts', 'wiki-metrics.js');
  const code = "const { parentPort, workerData } = require('node:worker_threads');const W = require(workerData.mod);for (let i = 0; i < workerData.count; i++) W.recordAccess('concepts', 'race', { file: workerData.file });parentPort.postMessage('done');";
  const runWorker = () => new Promise((resolve, reject) => {
    const worker = new Worker(code, { eval: true, workerData: { mod, file, count: 25 } });
    worker.once('message', resolve); worker.once('error', reject);
    worker.once('exit', code => code && reject(new Error(String(code))));
  });
  await Promise.all(Array.from({ length: 10 }, runWorker));
  const result = W.loadMetrics(file);
  assert.equal(result.totalAccess, 250); assert.equal(result.pages.race, 250);
  fs.rmSync(file, { force: true });
});

test('stress: SIGKILL after tmp write recovers on next write (AC2)', () => {
  const file = tmpFile(); const mod = path.join(__dirname, '..', 'scripts', 'wiki-metrics.js');
  const code = `const W=require(${JSON.stringify(mod)});W.recordAccess('concepts','crash',{file:${JSON.stringify(file)}});`;
  const result = spawnSync(process.execPath, ['-e', code], {
    env: { ...process.env, WIKI_METRICS_EXIT_AFTER_TMP: file }, encoding: 'utf8',
  });
  assert.equal(result.signal, 'SIGKILL');
  W.recordAccess('concepts', 'recover', { file });
  const tmps = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(path.basename(file) + '.tmp'));
  assert.equal(tmps.length, 0); assert.equal(W.loadMetrics(file).pages.recover, 1);
  fs.rmSync(file, { force: true });
});

test('stress: recordAccess p99 stays under 5ms without contention (AC3)', () => {
  const file = tmpFile(); const samples = [];
  for (let i = 0; i < 40; i++) {
    const start = process.hrtime.bigint(); W.recordAccess('concepts', `page-${i}`, { file });
    if (i > 4) samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.max(0, Math.ceil(samples.length * 0.99) - 1)];
  assert.ok(p99 < 5, `expected p99 < 5ms, saw ${p99.toFixed(2)}ms`);
  fs.rmSync(file, { force: true });
});