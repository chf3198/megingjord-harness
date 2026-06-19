'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { routeQuery, recallMiss, ROUTES } = require('../scripts/global/read-router.js');

test('routeQuery maps query-classes to sub-wiki + strategy', () => {
  assert.equal(routeQuery('symbol').subWiki, 'wiki/code/symbols');
  assert.equal(routeQuery('symbol').strategy, 'grep-index');
  assert.equal(routeQuery('ticket').strategy, 'mirror-lookup');
  assert.equal(routeQuery('governance').strategy, 'index-first');
});

test('heavy-sweep routes to the sub-agent isolated digest', () => {
  assert.equal(routeQuery('heavy-sweep').strategy, 'sub-agent-digest');
});

test('unknown query-class falls back to the index-first floor', () => {
  const result = routeQuery('nonsense');
  assert.equal(result.strategy, 'index-first');
  assert.equal(result.fallback, 'index-first');
});

test('no route uses embeddings/vector/graph (deferred)', () => {
  const strategies = Object.values(ROUTES).map((entry) => entry.strategy);
  assert.ok(!strategies.some((strategy) => /embed|vector|graph/.test(strategy)));
});

test('recallMiss appends a schema-v3 recall-miss signal', () => {
  const tmp = path.join(os.tmpdir(), `recall-${process.pid}.jsonl`);
  assert.ok(recallMiss('find foo symbol', tmp));
  const event = JSON.parse(fs.readFileSync(tmp, 'utf8').trim().split('\n')[0]);
  assert.equal(event.event, 'recall-miss');
  assert.equal(event.version, 3);
  fs.unlinkSync(tmp);
});
