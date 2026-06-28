'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const reconciler = require(path.join(root, 'scripts/global/epic-ac-reconcile.js'));
const dc = require(path.join(root, 'scripts/global/sensors/dc.js'));
const linter = require(path.join(root, 'scripts/global/manager-narrative-lint.js'));

test.describe('C3 #1289 — AC reconciler JSON contract', () => {
  test('produces per-AC row with truth_status', () => {
    const reconciled = reconciler.reconcileEpic({
      body: '- [ ] **AC1**: foo\n- [x] **AC2**: bar\n',
      evidenceCatalog: {
        AC1: [{ vote: 'satisfied', source: 'native_github_api' }],
        AC2: [{ vote: 'unmet', source: 'closed_child' }],
      },
    });
    expect(reconciled[0].truth_status).toBe('READY_TO_CLOSE');
    expect(reconciled[1].truth_status).toBe('UNMET');
  });
  test('MEASURING when status:measuring label present', () => {
    const reconciled = reconciler.reconcileEpic({
      body: '- [ ] **AC1**: pending',
      evidenceCatalog: { AC1: [{ vote: 'satisfied', source: 'native_github_api' }] },
      hasMeasuringLabel: true,
    });
    expect(reconciled[0].truth_status).toBe('MEASURING');
  });
  test('epicReadyToClose true when all READY/MEASURING/rescoped', () => {
    expect(reconciler.epicReadyToClose([
      { truth_status: 'READY_TO_CLOSE', rescope_ref: null },
      { truth_status: 'MEASURING', rescope_ref: null },
      { truth_status: 'UNMET', rescope_ref: '#9999' },
    ])).toBe(true);
  });
});

test.describe('C4 #1290 — declared-complete sensor', () => {
  test('emits drift signal on narrative+unmet', () => {
    const result = dc.compute({
      epicComments: [{ epic: 1130, body: 'Epic complete', created_at: '2026-05-15' }],
      reconciledByEpic: { 1130: [{ truth_status: 'UNMET', ac_id: 'AC4' }] },
    });
    expect(result.value).toBe(1);
  });
  test('ignores comments before since (R4 mitigation)', () => {
    const result = dc.compute({
      epicComments: [{ epic: 1130, body: 'Epic complete', created_at: '2026-04-01' }],
      reconciledByEpic: { 1130: [{ truth_status: 'UNMET', ac_id: 'AC4' }] },
    });
    expect(result.value).toBe(0);
  });
  test('marker-aware narrative regex avoids false positives', () => {
    expect(dc.matchesNarrative('Epic #1130 complete')).toBe(true);
    expect(dc.matchesNarrative('the build is complete')).toBe(false);
  });
});

test.describe('C5 #1291 — manager-narrative linter', () => {
  test('detects narrative trigger', () => {
    expect(linter.detectNarrative('Epic #1130 complete')).toBeTruthy();
    expect(linter.detectNarrative('the build is complete')).toBeNull();
  });
  test('does not advise when reconciler is ready', () => {
    const result = linter.lintComment({
      commentBody: 'Epic complete',
      epicBody: '- [x] **AC1**: done',
    });
    expect(result.triggered).toBe(false);
  });
  test('advises when reconciler shows unmet', () => {
    const result = linter.lintComment({
      commentBody: 'Epic complete',
      epicBody: '- [ ] **AC1**: pending',
    });
    expect(result.triggered).toBe(true);
    expect(result.unmet_acs).toContain('AC1');
  });
});
