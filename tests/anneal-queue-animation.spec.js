// Anneal queue + baton-flow animations — unit tests (#1356, Epic #1339 C5).
const { test, expect } = require('@playwright/test');
const path = require('path');
const PA = require(path.resolve(__dirname, '..', 'dashboard', 'js', 'panel-anim.js'));
const BF = require(path.resolve(__dirname, '..', 'dashboard', 'js', 'baton-flow-anim.js'));

test('panel-anim: prefersReducedMotion returns false in Node context', () => {
  expect(PA.prefersReducedMotion()).toBe(false);
});

test('panel-anim: animatePanelUpdate no-ops on null element', () => {
  expect(() => PA.animatePanelUpdate(null, 'test-class')).not.toThrow();
});

test('panel-anim: animatePanelUpdate adds class and removes after expiry', async () => {
  const classList = new Set();
  const mockElement = {
    classList: {
      add: (cls) => classList.add(cls),
      remove: (cls) => classList.delete(cls),
    },
  };
  PA.animatePanelUpdate(mockElement, 'aq-row-new', { expiry: 50 });
  expect(classList.has('aq-row-new')).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(classList.has('aq-row-new')).toBe(false);
});

test('panel-anim: exports expected constants', () => {
  expect(PA.PANEL_ANIM_DEFAULT_EXPIRY_MS).toBeGreaterThan(0);
  expect(PA.PANEL_ANIM_REDUCED_EXPIRY_MS).toBeLessThan(PA.PANEL_ANIM_DEFAULT_EXPIRY_MS);
});

test('baton-flow-anim: BF_ROLE_INDEX maps 4 roles', () => {
  expect(BF.BF_ROLE_INDEX.manager).toBe(0);
  expect(BF.BF_ROLE_INDEX.collaborator).toBe(1);
  expect(BF.BF_ROLE_INDEX.admin).toBe(2);
  expect(BF.BF_ROLE_INDEX.consultant).toBe(3);
});

test('baton-flow-anim: _bfHandleBatonEvent no-ops on null/empty', () => {
  expect(() => BF._bfHandleBatonEvent(null)).not.toThrow();
  expect(() => BF._bfHandleBatonEvent({})).not.toThrow();
  expect(() => BF._bfHandleBatonEvent({ issue: 1234 })).not.toThrow();
});

test('baton-flow-anim: _bfMatchRowByIssue returns null when document absent', () => {
  expect(BF._bfMatchRowByIssue('1234')).toBeNull();
});

test('baton-flow-anim: _bfFindActiveStepInRow handles null gracefully', () => {
  expect(BF._bfFindActiveStepInRow(null)).toBeNull();
  expect(BF._bfFindActiveStepInRow({ querySelectorAll: () => [] })).toBeNull();
});
