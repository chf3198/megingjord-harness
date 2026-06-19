'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { applyPrefixCache, cacheCoverageReport } = require('../scripts/global/prefix-cache.js');

test('applyPrefixCache converts a string system prefix to a cached block', () => {
  const request = { system: 'STABLE PREFIX', messages: [] };
  applyPrefixCache(request);
  assert.ok(Array.isArray(request.system));
  assert.equal(request.system[0].cache_control.type, 'ephemeral');
});

test('cacheCoverageReport confirms the prefix is cache-eligible', () => {
  const request = { system: 'STABLE PREFIX', messages: [] };
  assert.equal(cacheCoverageReport(request).prefixCached, false);
  applyPrefixCache(request);
  assert.equal(cacheCoverageReport(request).prefixCached, true);
  assert.equal(cacheCoverageReport(request).breakpoints, 1);
});

test('applyPrefixCache is idempotent', () => {
  const request = { system: 'STABLE PREFIX', messages: [] };
  applyPrefixCache(request);
  applyPrefixCache(request);
  assert.equal(cacheCoverageReport(request).breakpoints, 1, 'no duplicate breakpoint');
});

test('applyPrefixCache marks the last block of an array system', () => {
  const request = {
    system: [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
    ],
  };
  applyPrefixCache(request);
  assert.equal(request.system[1].cache_control.type, 'ephemeral');
});

test('applyPrefixCache is a graceful no-op on unexpected shapes (cache miss = no behavior change)', () => {
  assert.deepEqual(applyPrefixCache(null), null);
  assert.deepEqual(applyPrefixCache({ messages: [] }), { messages: [] });
  assert.equal(cacheCoverageReport({}).prefixCached, false);
});
