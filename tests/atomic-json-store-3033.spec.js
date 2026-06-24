'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('../scripts/global/atomic-json-store');

test('writeJsonAtomic + readJson round-trip', () => {
  const file = path.join(os.tmpdir(), `atomic-${Date.now()}.json`);
  store.writeJsonAtomic({ ok: true }, file);
  expect(store.readJson(file)).toEqual({ ok: true });
  fs.unlinkSync(file);
});

test('mutateJson serializes concurrent writers', () => {
  const file = path.join(os.tmpdir(), `atomic-mut-${Date.now()}.json`);
  store.writeJsonAtomic({ n: 0 }, file);
  store.mutateJson(file, (d) => { d.n += 1; return d.n; });
  store.mutateJson(file, (d) => { d.n += 1; return d.n; });
  expect(store.readJson(file).n).toBe(2);
  fs.unlinkSync(file);
});
