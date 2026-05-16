'use strict';

const { test, expect } = require('@playwright/test');
const { detectParent, detectParentByMarker, detectParentByProse } =
  require('../scripts/global/megalint/sub-issue-preference.js');

test('detectParent prefers sub-issue marker over prose refs', () => {
  const body = '<!-- sub-issue-linked: parent=1604 -->\nRefs Epic #9999\nrest of body';
  const result = detectParent(body);
  expect(result.parent).toBe(1604);
  expect(result.source).toBe('sub-issue-marker');
});

test('detectParent falls back to prose Refs when no marker present', () => {
  const result = detectParent('No marker. Refs Epic #1604 in body.');
  expect(result.parent).toBe(1604);
  expect(result.source).toBe('prose-refs');
});

test('detectParent returns none when no parent reference at all', () => {
  const result = detectParent('Plain body without any parent reference.');
  expect(result.parent).toBe(null);
  expect(result.source).toBe('none');
});

test('detectParentByMarker extracts parent from sentinel marker', () => {
  expect(detectParentByMarker('<!-- sub-issue-linked: parent=42 -->')).toBe(42);
  expect(detectParentByMarker('plain text')).toBe(null);
});

test('detectParentByProse extracts parent from Refs Epic #N', () => {
  expect(detectParentByProse('Refs Epic #100')).toBe(100);
  expect(detectParentByProse('Refs #200')).toBe(200);
  expect(detectParentByProse('no refs')).toBe(null);
});

test('detectParent handles null and empty body gracefully', () => {
  expect(detectParent(null).parent).toBe(null);
  expect(detectParent('').parent).toBe(null);
  expect(detectParent('').source).toBe('none');
});
