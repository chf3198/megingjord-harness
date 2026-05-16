'use strict';

const { test, expect } = require('@playwright/test');
const { provider, toolName, dispatch } = require('../scripts/global/github-dispatcher.js');

test('provider falls back to gh-cli when MEGINGJORD_MCP_DISABLED=1', () => {
  expect(provider({ MEGINGJORD_MCP_DISABLED: '1' })).toBe('gh-cli');
});

test('provider uses mcp when MEGINGJORD_MCP_FORCE_AVAILABLE=1', () => {
  expect(provider({ MEGINGJORD_MCP_FORCE_AVAILABLE: '1' })).toBe('mcp');
});

test('provider defaults to gh-cli when no MCP signals set', () => {
  expect(provider({})).toBe('gh-cli');
});

test('toolName maps create-issue to MCP tool when provider=mcp', () => {
  expect(toolName('create-issue', 'mcp')).toBe('mcp__github__create_issue');
});

test('toolName maps create-issue to gh CLI when provider=gh-cli', () => {
  expect(toolName('create-issue', 'gh-cli')).toBe('gh issue create');
});

test('toolName maps update-project-v2-item-field to GraphQL CLI fallback', () => {
  expect(toolName('update-project-v2-item-field', 'gh-cli')).toContain('gh api graphql');
});

test('dispatch returns provider + tool for known operation', () => {
  const result = dispatch('add-comment', { MEGINGJORD_MCP_FORCE_AVAILABLE: '1' });
  expect(result.ok).toBe(true);
  expect(result.provider).toBe('mcp');
  expect(result.tool).toBe('mcp__github__create_issue_comment');
});

test('dispatch returns ok=false for unknown operation', () => {
  const result = dispatch('not-a-real-op', {});
  expect(result.ok).toBe(false);
  expect(result.tool).toBe(null);
});

test('dispatch with MCP-disabled chooses gh-cli regardless of force flag', () => {
  const result = dispatch('get-issue', {
    MEGINGJORD_MCP_DISABLED: '1',
    MEGINGJORD_MCP_FORCE_AVAILABLE: '1',
  });
  expect(result.provider).toBe('gh-cli');
});

test('dispatch list-issues works on both providers', () => {
  expect(dispatch('list-issues', { MEGINGJORD_MCP_FORCE_AVAILABLE: '1' }).tool)
    .toBe('mcp__github__list_issues');
  expect(dispatch('list-issues', { MEGINGJORD_MCP_DISABLED: '1' }).tool)
    .toBe('gh issue list');
});
