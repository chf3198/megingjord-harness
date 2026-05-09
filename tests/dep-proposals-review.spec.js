'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const R = require(path.resolve(__dirname, '../scripts/global/dep-proposals-review.js'));

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-review-'));
  const graph = path.join(dir, 'graph.json');
  const proposals = path.join(dir, 'proposals.json');
  const decisions = path.join(dir, 'decisions.json');
  fs.writeFileSync(
    graph,
    JSON.stringify({
      nodes: [
        { id: 1, title: 'Add dependency API' },
        { id: 2, title: 'Review dependency API' },
      ],
    })
  );
  fs.writeFileSync(
    proposals,
    JSON.stringify({
      proposals: [
        {
          from: 1,
          to: 2,
          edge_type: 'depends-on',
          confidence: 0.91,
          cache_key: 'k1',
          rationale: 'shared API',
        },
      ],
    })
  );
  return { graph, proposals, decisions };
}
const choices = (...items) => {
  let i = 0;
  return () => items[i++] || 's';
};

test.describe('dep-proposals-review (#1197)', () => {
  test('accept persists mutation-ready proposal data', async () => {
    const f = fixture();
    const result = await R.review({ ...f, ask: choices('a'), write: () => {} });
    const decision = result.decisions.decisions[0];
    expect(result.persisted).toBe(1);
    expect(decision).toMatchObject({ cache_key: 'k1', status: 'accepted' });
    expect(decision.proposal.from_issue.title).toBe('Add dependency API');
    expect(decision.proposal.to_issue.title).toBe('Review dependency API');
  });

  test('reject tombstones until proposal cache key changes', async () => {
    const f = fixture();
    await R.review({ ...f, ask: choices('r'), write: () => {} });
    const second = await R.review({ ...f, ask: choices('a'), write: () => {} });
    expect(second.reviewed).toBe(0);
    const data = JSON.parse(fs.readFileSync(f.decisions, 'utf8'));
    expect(data.decisions).toHaveLength(1);
    fs.writeFileSync(
      f.proposals,
      JSON.stringify({
        proposals: [{ from: 1, to: 2, edge_type: 'depends-on', confidence: 0.91, cache_key: 'k2' }],
      })
    );
    const third = await R.review({ ...f, ask: choices('a'), write: () => {} });
    expect(third.reviewed).toBe(1);
  });

  test('suppress records reason and skip does not persist', async () => {
    const f = fixture();
    const suppressed = await R.review({
      ...f,
      ask: choices('u', 'duplicate epic scope'),
      write: () => {},
    });
    expect(suppressed.decisions.decisions[0]).toMatchObject({
      status: 'suppressed',
      reason: 'duplicate epic scope',
    });
    const g = fixture();
    const skipped = await R.review({ ...g, ask: choices('s'), write: () => {} });
    expect(skipped).toMatchObject({ reviewed: 1, persisted: 0 });
    expect(JSON.parse(fs.readFileSync(g.decisions, 'utf8')).decisions).toEqual([]);
  });
});
