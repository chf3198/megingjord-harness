'use strict';
// contract-test: the CI throughput benchmark consumes the committed floor table and fails on regression.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const obs = require('../scripts/global/fleet-advisor-observability.js');

const FLOORS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'fleet-throughput-floors.json'), 'utf8')).floors;

test('contract — floor table is well-formed (model@tier → positive number)', () => {
  const keys = Object.keys(FLOORS);
  assert.ok(keys.length >= 1);
  for (const [key, floor] of Object.entries(FLOORS)) {
    assert.match(key, /^[\w.:-]+@F[0-4]$/, `bad key ${key}`);
    assert.ok(typeof floor === 'number' && floor > 0, `bad floor ${key}`);
  }
});

test('contract — a healthy measurement set clears every floor (build stays green)', () => {
  const healthy = Object.entries(FLOORS).map(([key, floor]) => {
    const [model, tier] = key.split('@');
    return { model, tier, tokensPerSec: floor + 5 };
  });
  assert.equal(obs.checkThroughputFloor(healthy, FLOORS).ok, true);
});

test('contract — a regressed measurement below the floor fails the build (G7)', () => {
  const [firstKey, firstFloor] = Object.entries(FLOORS)[0];
  const [model, tier] = firstKey.split('@');
  const regressed = [{ model, tier, tokensPerSec: firstFloor - 1 }];
  const result = obs.checkThroughputFloor(regressed, FLOORS);
  assert.equal(result.ok, false);
  assert.equal(result.regressions.length, 1);
});
