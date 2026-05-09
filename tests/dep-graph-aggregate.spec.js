'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const A = require(path.resolve(__dirname, '../scripts/global/dep-graph-aggregate.js'));

test.describe('dep-graph-aggregate (#1195)', () => {
  test('parseTextEdges extracts explicit body relationships', () => {
    const edges = A.parseTextEdges({
      number: 10,
      body: ['Depends-on: #1 #2', '- Blocks: #3', 'Refs #4', 'Coupled-with: #10'].join('\n'),
    });
    expect(edges.map(e => [e.from, e.to, e.type])).toEqual([
      [10, 1, 'depends-on'],
      [10, 2, 'depends-on'],
      [10, 3, 'blocks'],
      [10, 4, 'refs'],
    ]);
  });

  test('buildGraph merges text and native API edges', () => {
    const graph = A.buildGraph([
      {
        number: 10,
        title: 'A',
        state: 'OPEN',
        labels: [{ name: 'type:task' }],
        body: 'Depends-on: #1',
        native_edges: [{ from: 10, to: 1, type: 'depends-on' }],
      },
    ]);
    expect(graph.nodes[0].labels).toEqual(['type:task']);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source.sort()).toEqual(['github_api', 'text']);
  });

  test('mergeEdges flags pair/type mismatches', () => {
    const graph = A.buildGraph([
      {
        number: 10,
        title: 'A',
        state: 'OPEN',
        body: 'Depends-on: #1',
        native_edges: [{ from: 10, to: 1, type: 'blocks' }],
      },
    ]);
    expect(graph.edges.every(e => e.mismatch)).toBe(true);
    expect(graph.mismatches[0]).toEqual({ from: 10, to: 1, types: ['blocks', 'depends-on'] });
  });
});
