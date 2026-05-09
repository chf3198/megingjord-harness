'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const A = require(path.resolve(__dirname, '../scripts/global/dep-graph-augment.js'));

const node = (id, title, labels = ['type:task', 'area:scripts']) => ({ id, title, state: 'OPEN', labels });

test.describe('dep-graph-augment (#1196)', () => {
  test('candidate filtering avoids all-pairs analysis', () => {
    const graph = { nodes: [node(1, 'Add graph cache'), node(2, 'Review graph cache'), node(3, 'Paint dashboard', ['area:dashboard'])], edges: [{ from: 1, to: 2 }] };
    expect(A.candidatePairs(graph).map(p => [p.a.id, p.b.id])).toEqual([]);
  });

  test('proposed-edge path honors threshold and metadata', async () => {
    const graph = { nodes: [node(1, 'Add dependency JSON'), node(2, 'Review dependency JSON')], edges: [] };
    const result = await A.augment(graph, { classify: () => ({ edge_type: 'depends-on', confidence: 0.91, rationale: 'shared JSON contract', evidence_spans: ['dependency JSON'] }) });
    expect(result.threshold).toBe(0.85);
    expect(result.proposals[0]).toMatchObject({ from: 1, to: 2, status: 'proposed', edge_type: 'depends-on', confidence: 0.91 });
    expect(result.proposals[0].model.prompt_version).toBe('dep-proposal-v1');
  });

  test('stale-cache path recomputes when issue hash changes', async () => {
    const oldA = node(1, 'Old title'); const issueB = node(2, 'Shared title');
    const oldKey = A.cacheKey(oldA, issueB);
    let calls = 0;
    const graph = { nodes: [node(1, 'New shared title'), issueB], edges: [] };
    await A.augment(graph, { classify: () => { calls += 1; return { edge_type: 'none', confidence: 0.1 }; } });
    expect(oldKey).not.toBe(A.cacheKey(graph.nodes[0], issueB));
    expect(calls).toBe(1);
  });

  test('invalid-output path falls back without auto-accepting', async () => {
    const graph = { nodes: [node(1, 'Add parser'), node(2, 'Review parser')], edges: [] };
    const result = await A.augment(graph, { classify: () => 'not json' });
    expect(result.proposals).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ status: 'fallback', edge_type: 'none' });
  });
});
