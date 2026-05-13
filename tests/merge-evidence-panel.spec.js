// Tests for dashboard/js/merge-evidence-panel.js (Epic #1486 Phase-1d, #1508).
// Visual-regression-flavored: exercises the panel render function with
// representative payloads and checks the emitted HTML contains the right
// signals. Avoids a live browser to stay within playwright-low-resource.
const { test, expect } = require('@playwright/test');
const path = require('path');
const vm = require('vm');
const fs = require('fs');

function loadPanel() {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'dashboard', 'js', 'merge-evidence-panel.js'), 'utf8');
  const sandbox = { window: {}, fetch: async () => ({ ok: true, json: () => ({}) }) };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

const panel = loadPanel();

test('#1508 AC4: renderMergeEvidencePanel handles absent snapshot with refresh hint', () => {
  const html = panel.renderMergeEvidencePanel({ status: 'absent', snapshot_path: '/x', instruction: 'Run npm run merge-evidence:snapshot' });
  expect(html).toContain('merge-evidence-panel');
  expect(html).toContain('Snapshot absent');
  expect(html).toContain('npm run merge-evidence:snapshot');
});

test('#1508 AC4: renderMergeEvidencePanel shows stale banner when age > 24h', () => {
  const html = panel.renderMergeEvidencePanel({
    status: 'stale', age_ms: 30 * 3600e3,
    snapshot: { window_days: 7, by_team: { copilot: 2 }, counts: { violations: 2, passed: 0, skipped: 1 } },
  });
  expect(html).toContain('30h old');
  expect(html).toContain('me-warn');
});

test('#1508 AC4: renderMergeEvidencePanel renders fresh snapshot with team rows', () => {
  const html = panel.renderMergeEvidencePanel({
    status: 'fresh', age_ms: 1000,
    snapshot: {
      window_days: 7,
      by_team: { 'claude-code': 1, copilot: 3, codex: 2 },
      counts: { violations: 6, passed: 4, skipped: 2 },
    },
  });
  expect(html).toContain('claude-code');
  expect(html).toContain('copilot');
  expect(html).toContain('codex');
  expect(html).toContain('Total: 6 violations');
  expect(html).toContain('Closed without merge (7d)');
});

test('#1508 AC4: teams sorted descending by violation count (worst first)', () => {
  const html = panel.renderMergeEvidencePanel({
    status: 'fresh',
    snapshot: { window_days: 7, by_team: { a: 1, b: 5, c: 3 }, counts: {} },
  });
  const aPos = html.indexOf('>a<');
  const bPos = html.indexOf('>b<');
  const cPos = html.indexOf('>c<');
  expect(bPos).toBeLessThan(cPos);
  expect(cPos).toBeLessThan(aPos);
});

test('#1508 AC4: empty by_team renders "No violations" row, not blank table', () => {
  const html = panel.renderMergeEvidencePanel({
    status: 'fresh', snapshot: { window_days: 7, by_team: {}, counts: { violations: 0, passed: 10, skipped: 0 } },
  });
  expect(html).toContain('No violations in window');
});

test('#1508 AC4: status badge classes differentiate severity tiers', () => {
  const html = panel.renderMergeEvidencePanel({
    status: 'fresh',
    snapshot: { window_days: 7, by_team: { teamA: 0, teamB: 2, teamC: 10 }, counts: {} },
  });
  expect(html).toContain('me-ok');
  expect(html).toContain('me-low');
  expect(html).toContain('me-high');
});

test('#1508 AC4: null payload renders graceful empty state', () => {
  const html = panel.renderMergeEvidencePanel(null);
  expect(html).toContain('No data');
});
