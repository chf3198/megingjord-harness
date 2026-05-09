'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const R = require(path.resolve(__dirname, '../scripts/global/dep-graph-render.js'));

function fixture() {
  const graph = {
    generated_at: '2026-05-09T00:00:00.000Z',
    nodes: [
      { id: 3, title: 'Ship dashboard graph' },
      { id: 1, title: 'Collect graph edges' },
      { id: 2, title: 'Review proposals' },
    ],
    edges: [
      { from: 2, to: 3, type: 'depends-on', source: ['text'], mismatch: false },
      { from: 1, to: 2, type: 'blocks', source: ['github_api'], mismatch: true },
    ],
  };
  const proposals = {
    proposals: [
      { from: 1, to: 3, edge_type: 'depends-on', confidence: 0.88, cache_key: 'p1' },
      { from: 3, to: 1, edge_type: 'coupled-with', confidence: 0.6, cache_key: 'p2' },
    ],
  };
  const decisions = {
    updated_at: '2026-05-09T01:00:00.000Z',
    decisions: [
      { cache_key: 'p1', status: 'accepted' },
      { cache_key: 'old', status: 'rejected' },
    ],
  };
  return { graph, proposals, decisions };
}

test.describe('dep-graph-render (#1198)', () => {
  test('renders deterministic markdown with annotated Mermaid edges', () => {
    const f = fixture();
    const first = R.renderMarkdown(f.graph, f.proposals, f.decisions, 'now');
    const second = R.renderMarkdown(f.graph, f.proposals, f.decisions, 'now');
    expect(first).toBe(second);
    expect(first).toContain('N1 -->|blocks [github_api; mismatch]| N2');
    expect(first).toContain('N1 -.->|depends-on [proposal:accepted; 0.88]| N3');
    expect(first).toContain('N3 -.->|coupled-with [proposal:pending; 0.6]| N1');
  });

  test('summarizes critical path and proposal review drift', () => {
    const f = fixture();
    const summary = R.summary(f.graph, f.proposals, f.decisions, 'now');
    expect(summary.critical_path).toEqual([1, 2, 3]);
    expect(summary.stale.pending_proposals).toEqual(['p2']);
    expect(summary.stale.decisions_without_proposal).toEqual(['old']);
    expect(summary.proposal_statuses).toEqual({ accepted: 1, pending: 1 });
  });

  test('reports cycles deterministically', () => {
    const f = fixture();
    f.graph.edges.push({ from: 3, to: 1, type: 'blocks', source: ['text'] });
    expect(R.cycles(f.graph)).toEqual(['1 -> 2 -> 3 -> 1']);
    expect(R.summary(f.graph, f.proposals, f.decisions, 'now').critical_path).toEqual([1]);
  });
});
