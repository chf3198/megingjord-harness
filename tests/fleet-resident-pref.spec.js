// #2599 (G3) — resident-model preference keeps fleet reviews on the free lane.
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const G = path.resolve(__dirname, '..', 'scripts', 'global');
const { residentModels, preferResident } = require(path.join(G, 'fleet-resident.js'));
const { selectModel } = require(path.join(G, 'fleet-red-team-dispatch.js'));

const fakeFetch = (payload, ok = true) => async () => ({
  ok, json: async () => payload,
});
const throwFetch = async () => { throw new Error('network'); };

test('residentModels parses /api/ps name/model fields', async () => {
  const f = fakeFetch({ models: [{ name: 'qwen2.5-coder:32b' }, { model: 'llama3:8b' }, {}] });
  expect(await residentModels('http://h:11434', f)).toEqual(['qwen2.5-coder:32b', 'llama3:8b']);
});

test('residentModels degrades to [] on error / not-ok / no-host', async () => {
  expect(await residentModels('http://h:11434', throwFetch)).toEqual([]);
  expect(await residentModels('http://h:11434', fakeFetch({}, false))).toEqual([]);
  expect(await residentModels('', fakeFetch({ models: [{ name: 'x' }] }))).toEqual([]);
});

test('preferResident returns first resident candidate, else null', async () => {
  const f = fakeFetch({ models: [{ name: 'z' }, { name: 'b' }] });
  expect(await preferResident(['a', 'b', 'z'], 'http://h:11434', f)).toBe('b');
  expect(await preferResident(['a', 'c'], 'http://h:11434', f)).toBeNull();
  expect(await preferResident([], 'http://h:11434', f)).toBeNull();
});

test('selectModel: non-high stakes prefers a resident cross-family model (#2599)', () => {
  const r = selectModel({ stakes: 'low' }, { residentModels: ['qwen2.5-coder:32b'] });
  expect(r.modelId).toBe('qwen2.5-coder:32b');
  expect(r.rationale).toBe('resident-preferred-low');
});

test('selectModel: high stakes ignores residency (quality first)', () => {
  const r = selectModel({ stakes: 'high' }, { residentModels: ['qwen2.5-coder:7b'] });
  expect(r.rationale).toBe('matrix-stakes-high');
});

test('selectModel: no residentModels → unchanged matrix selection', () => {
  const r = selectModel({ stakes: 'low' }, {});
  expect(r.rationale).toMatch(/^matrix-stakes-|^fallback-chain$|^hardcoded-default$/);
});
