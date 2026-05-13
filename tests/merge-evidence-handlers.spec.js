// Tests for dashboard/api/merge-evidence-handlers.js (Epic #1486 Phase-1d, #1508).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const handlers = require('../dashboard/api/merge-evidence-handlers');

test('#1508 AC3: readSnapshot reports absent when file missing', () => {
  const result = handlers.readSnapshot('/tmp/nonexistent-snapshot.json');
  expect(result.status).toBe('absent');
  expect(result.instruction).toContain('npm run merge-evidence:snapshot');
});

test('#1508 AC3: readSnapshot reports malformed when file is bad JSON', () => {
  const tmp = path.join(os.tmpdir(), `merge-evidence-malformed-${Date.now()}.json`);
  fs.writeFileSync(tmp, 'not-json{');
  const result = handlers.readSnapshot(tmp);
  expect(result.status).toBe('malformed');
  expect(result.error).toBeTruthy();
  fs.unlinkSync(tmp);
});

test('#1508 AC3: readSnapshot returns fresh when snapshot < 24h old', () => {
  const tmp = path.join(os.tmpdir(), `merge-evidence-fresh-${Date.now()}.json`);
  const recentSnap = {
    generated_at: new Date().toISOString(),
    window_days: 7, processed: 1, remaining: 0,
    counts: { violations: 1, skipped: 0, passed: 0 },
    by_team: { 'claude-code': 1 }, violations: [{ number: 99, title: 't', team: 'claude-code' }],
  };
  fs.writeFileSync(tmp, JSON.stringify(recentSnap));
  const result = handlers.readSnapshot(tmp);
  expect(result.status).toBe('fresh');
  expect(result.snapshot.by_team['claude-code']).toBe(1);
  expect(result.age_ms).toBeLessThan(handlers.STALE_AFTER_MS);
  fs.unlinkSync(tmp);
});

test('#1508 AC3: readSnapshot returns stale when snapshot > 24h old', () => {
  const tmp = path.join(os.tmpdir(), `merge-evidence-stale-${Date.now()}.json`);
  const oldSnap = {
    generated_at: new Date(Date.now() - 30 * 3600e3).toISOString(),
    window_days: 7, processed: 0, remaining: 0,
    counts: { violations: 0, skipped: 0, passed: 0 }, by_team: {}, violations: [],
  };
  fs.writeFileSync(tmp, JSON.stringify(oldSnap));
  const result = handlers.readSnapshot(tmp);
  expect(result.status).toBe('stale');
  expect(result.age_ms).toBeGreaterThan(handlers.STALE_AFTER_MS);
  fs.unlinkSync(tmp);
});

test('#1508 AC3: handleMergeEvidenceStats writes 200 + JSON via response object', () => {
  let writeHeadArgs, endArg;
  const mockRes = {
    writeHead(status, headers) { writeHeadArgs = [status, headers]; },
    end(body) { endArg = body; },
  };
  handlers.handleMergeEvidenceStats({}, mockRes);
  expect(writeHeadArgs[0]).toBe(200);
  expect(writeHeadArgs[1]['Content-Type']).toBe('application/json');
  expect(() => JSON.parse(endArg)).not.toThrow();
  const parsed = JSON.parse(endArg);
  expect(['fresh', 'stale', 'absent', 'malformed']).toContain(parsed.status);
});

test('#1508 AC3: handler exports route constant and snapshot path', () => {
  expect(handlers.route).toBe('/api/merge-evidence-stats');
  expect(handlers.SNAPSHOT_PATH).toContain('merge-evidence-snapshot.json');
  expect(handlers.STALE_AFTER_MS).toBe(24 * 60 * 60 * 1000);
});
