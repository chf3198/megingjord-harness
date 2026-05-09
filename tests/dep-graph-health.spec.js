'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const H = require(path.resolve(__dirname, '../scripts/global/dep-graph-health.js'));

function writeJson(dir, name, data) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}
function fixture(tmp, graph) {
  const proposals = {
    proposals: [
      { from: 4, to: 5, edge_type: 'depends-on', cache_key: 'old', proposed_at: '2026-05-01T00:00:00.000Z',
        model: { id: 'fleet:cascade-dispatch', lane: 'fleet' }, token_usage: { total_tokens: 10 }, cost_usd: 0 },
    ],
    skipped: [{ status: 'fallback', model: { id: 'haiku:sonnet', lane: 'haiku' }, cost_usd: 0.002 }],
  };
  return {
    graph: writeJson(tmp, 'graph.json', graph),
    proposals: writeJson(tmp, 'proposals.json', proposals),
    decisions: writeJson(tmp, 'decisions.json', { decisions: [] }),
  };
}

test.describe('dep-graph-health (#1199)', () => {
  test('flags cycles as violations and counts mismatches', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
    const files = fixture(tmp, { nodes: [{ id: 1 }, { id: 2 }], edges: [
      { from: 1, to: 2, type: 'blocks', mismatch: true }, { from: 2, to: 1, type: 'blocks' },
    ] });
    const result = H.compute({ ...files, now: '2026-05-09T00:00:00.000Z' });
    expect(result.status).toBe('violation');
    expect(result.cycles).toEqual(['1 -> 2 -> 1']);
    expect(result.unresolved_mismatch_count).toBe(1);
  });

  test('computes deterministic critical path for acyclic graphs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
    const files = fixture(tmp, { nodes: [{ id: 1 }, { id: 2 }, { id: 3 }], edges: [
      { from: 1, to: 2, type: 'blocks' }, { from: 2, to: 3, type: 'blocks' },
    ] });
    const result = H.compute({ ...files, now: '2026-05-09T00:00:00.000Z' });
    expect(result.critical_path).toEqual([1, 2, 3]);
    expect(result.critical_path_length).toBe(3);
  });

  test('reports stale proposals plus free cost and fallback counters', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
    const files = fixture(tmp, { nodes: [], edges: [] });
    const result = H.compute({ ...files, now: '2026-05-09T00:00:00.000Z' });
    expect(result.proposals.stale_count).toBe(1);
    expect(result.proposals.max_pending_age_days).toBe(8);
    expect(result.cost).toMatchObject({ requests: 2, tokens: 10, cost_usd: 0.002, fallbacks: 1 });
    expect(result.cost.by_lane).toEqual({ fleet: 1, haiku: 1 });
  });

  test('missing files degrade to warnings', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-'));
    const result = H.compute({ graph: path.join(tmp, 'missing.json'), proposals: path.join(tmp, 'none.json'),
      decisions: path.join(tmp, 'decisions.json'), now: '2026-05-09T00:00:00.000Z' });
    expect(result.warnings.length).toBe(3);
    expect(result.status).toBe('ok');
    expect(result.critical_path).toEqual([]);
  });
});
