'use strict';
// github-dispatcher (#1643) — MCP-vs-gh-CLI dispatcher contract.
// Returns which provider should handle a given operation given the env state.

function provider(env = process.env) {
  if (env.MEGINGJORD_MCP_DISABLED === '1') return 'gh-cli';
  if (env.MEGINGJORD_MCP_FORCE_AVAILABLE === '1') return 'mcp';
  // Default detection: if MCP server registered (caller injects mcpAvailable), use it.
  return env.MEGINGJORD_MCP_AVAILABLE === '1' ? 'mcp' : 'gh-cli';
}

function toolName(operation, prov) {
  const MAP = {
    'create-issue': { mcp: 'mcp__github__create_issue', cli: 'gh issue create' },
    'add-comment': { mcp: 'mcp__github__create_issue_comment', cli: 'gh issue comment' },
    'get-issue': { mcp: 'mcp__github__get_issue', cli: 'gh issue view' },
    'list-issues': { mcp: 'mcp__github__list_issues', cli: 'gh issue list' },
    'update-issue': { mcp: 'mcp__github__update_issue', cli: 'gh issue edit' },
    'update-project-v2-item-field': {
      mcp: 'mcp__github__update_project_v2_item_field_value',
      cli: 'gh api graphql -f query=...',
    },
  };
  if (!MAP[operation]) return null;
  return prov === 'mcp' ? MAP[operation].mcp : MAP[operation].cli;
}

function dispatch(operation, env = process.env) {
  const prov = provider(env);
  const tool = toolName(operation, prov);
  return { provider: prov, tool, ok: tool !== null };
}

module.exports = { provider, toolName, dispatch };
