'use strict';
const { test, expect } = require('@playwright/test');
const O = require('../scripts/global/label-lint-optimistic-transition');

test('labelsDrifted detects concurrent edits', () => {
  expect(O.labelsDrifted(['status:done'], ['status:review'])).toBe(true);
  expect(O.labelsDrifted(['status:done'], ['status:done'])).toBe(false);
});

test('shouldAbortTransition on updated_at drift', () => {
  const r = O.shouldAbortTransition(['a'], ['a'], 't1', 't2');
  expect(r.abort).toBe(true);
});
