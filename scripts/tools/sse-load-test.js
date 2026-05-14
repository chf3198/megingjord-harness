#!/usr/bin/env node
'use strict';
// sse-load-test — Epic #1339 follow-up (#1374). Measures the SSE pipeline's
// core append→tail latency. Usage: node scripts/tools/sse-load-test.js
// [--rate=1000] [--duration=5] [--max-buffer=1000] [--report-file=...]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { tail } = require('../global/jsonl-tail.js');

const ARGV = process.argv.slice(2);
const SETTLE_MS = 200;
const FINAL_DRAIN_MS = 1000;
const TARGET_P95_MS = 500;

function arg(flag, def) {
  const m = ARGV.find((a) => a.startsWith(`--${flag}=`));
  return m ? m.slice(flag.length + 3) : def;
}
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function setupTail(file, opts) {
  const sentAt = new Map();
  const latencies = [];
  const stats = { received: 0, dropped: 0 };
  const handle = tail(file, (event) => {
    const t0 = sentAt.get(event.id);
    if (t0 !== undefined) {
      latencies.push(Date.now() - t0);
      stats.received++;
    }
  }, { maxBuffer: opts.maxBuffer, onDrop: (n) => { stats.dropped = n; } });
  return { handle, sentAt, latencies, stats };
}

async function emitEvents(file, sentAt, total, intervalMs) {
  for (let i = 0; i < total; i++) {
    const id = `evt-${i}`;
    sentAt.set(id, Date.now());
    fs.appendFileSync(file, JSON.stringify({ id, ts: new Date().toISOString() }) + '\n');
    if (intervalMs >= 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function buildReport(rate, duration, total, sentAt, latencies, stats, handle) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    rate, duration_seconds: duration, target_total: total,
    sent: sentAt.size, received: stats.received, dropped: stats.dropped,
    final_buffer_depth: handle.getBufferDepth(),
    latency_ms: {
      p50: percentile(sorted, 50), p95: percentile(sorted, 95),
      p99: percentile(sorted, 99), max: sorted[sorted.length - 1] || 0,
      mean: sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1),
    },
    target_p95_ms: TARGET_P95_MS,
    target_met: percentile(sorted, 95) < TARGET_P95_MS,
  };
}

async function runLoadTest(opts = {}) {
  const rate = Number(opts.rate || 1000);
  const duration = Number(opts.duration || 5);
  const maxBuffer = Number(opts.maxBuffer || 1000);
  const total = rate * duration;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-load-'));
  const file = path.join(tmpDir, 'incidents.jsonl');
  fs.writeFileSync(file, '');
  const { handle, sentAt, latencies, stats } = setupTail(file, { maxBuffer });
  await new Promise((r) => setTimeout(r, SETTLE_MS));
  await emitEvents(file, sentAt, total, 1000 / rate);
  await new Promise((r) => setTimeout(r, FINAL_DRAIN_MS));
  await handle.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return buildReport(rate, duration, total, sentAt, latencies, stats, handle);
}

async function main() {
  const opts = {
    rate: arg('rate', '1000'),
    duration: arg('duration', '5'),
    maxBuffer: arg('max-buffer', '1000'),
  };
  const report = await runLoadTest(opts);
  console.log(JSON.stringify(report, null, 2));
  const reportFile = arg('report-file', '');
  if (reportFile) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  process.exit(report.target_met ? 0 : 1);
}

if (require.main === module) main().catch((err) => { console.error(err); process.exit(2); });
module.exports = { runLoadTest, percentile };
