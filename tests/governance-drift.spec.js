// tests/governance-drift.spec.js — targeted unit tests for drift classifier (#360)
const { test, expect } = require('@playwright/test');
const { classify, classifyIssue } = require('../scripts/global/governance-drift-classifier');

test.describe('governance-drift-classifier — drift class detection', () => {
  test('empty issues produce empty classified lists', () => {
    const result = classify([]);
    expect(result.open).toHaveLength(0);
    expect(result.terminal).toHaveLength(0);
    expect(result.epic).toHaveLength(0);
  });

  test('open drift — baton missing Signed-by on in-progress ticket', () => {
    const issue = '122-fix.md: baton sections missing Signed-by: COLLABORATOR_HANDOFF';
    expect(classifyIssue(issue)).toBe('open');
    const result = classify([issue]);
    expect(result.open).toHaveLength(1);
    expect(result.open[0].driftClass).toBe('open');
  });

  test('open drift — ready SLA violation', () => {
    const issue = '130-task.md: ready >24h without BLOCKER_NOTE fields';
    expect(classifyIssue(issue)).toBe('open');
  });

  test('open drift — missing workflow merge_group trigger', () => {
    const issue = '.github/workflows/lint.yml: missing merge_group trigger';
    expect(classifyIssue(issue)).toBe('open');
  });

  test('terminal drift — missing CONSULTANT_CLOSEOUT on closed ticket', () => {
    const issue = '120-epic.md: missing CONSULTANT_CLOSEOUT';
    expect(classifyIssue(issue)).toBe('terminal');
    const result = classify([issue]);
    expect(result.terminal).toHaveLength(1);
    expect(result.terminal[0].driftClass).toBe('terminal');
  });

  test('terminal drift — missing GitHub Evidence Block', () => {
    const issue = '130-task.md: missing GitHub Evidence Block';
    expect(classifyIssue(issue)).toBe('terminal');
  });

  test('terminal drift — closed status contains role label', () => {
    const issue = '125-task.md: closed status contains role label';
    expect(classifyIssue(issue)).toBe('terminal');
  });

  test('epic drift — epic closed with open children', () => {
    const issue = '120-epic.md: epic closed with open children 127';
    expect(classifyIssue(issue)).toBe('epic');
    const result = classify([issue]);
    expect(result.epic).toHaveLength(1);
    expect(result.epic[0].driftClass).toBe('epic');
  });

  test('epic drift has highest priority over terminal patterns', () => {
    const issue = '120-epic.md: epic closed with open children 127, missing CONSULTANT_CLOSEOUT';
    expect(classifyIssue(issue)).toBe('epic');
  });

  test('classify preserves message text in result objects', () => {
    const issue = '140-task.md: missing CONSULTANT_CLOSEOUT';
    const result = classify([issue]);
    expect(result.terminal[0].message).toBe(issue);
  });

  test('mixed issues classify correctly into all three classes', () => {
    const issues = [
      '120-epic.md: epic closed with open children 127',
      '125-task.md: missing CONSULTANT_CLOSEOUT',
      '130-task.md: baton sections missing Signed-by: MANAGER_HANDOFF',
    ];
    const result = classify(issues);
    expect(result.epic).toHaveLength(1);
    expect(result.terminal).toHaveLength(1);
    expect(result.open).toHaveLength(1);
  });
});