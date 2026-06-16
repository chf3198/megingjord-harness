#!/usr/bin/env node
'use strict';
// cross-runtime-enforcement.js (Refs #3048): documents and exposes the per-event
// enforcement reach contract across Claude Code (settings.json hooks) vs Copilot
// (permissions-config.json + preview hooks) for the BYOK parity Epic #3041.
//
// KEY CLAIM: guards wired as PreToolUse/PostToolUse/Stop in Claude Code's
// settings.json fire on every tool call. Copilot's VS Code hook preview is a
// separate surface; it may wire the same scripts but its event mapping differs
// and its deny mechanism is advisory-only today (see doc for details).
//
// This module is query-only: no IO, no state — safe to require in tests.

// Hook events that Claude Code settings.json supports and uses.
const CLAUDE_CODE_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Stop',
];

// Per-event guard scripts wired in ~/.claude/settings.json (canonical runtime).
// Source: parsed from settings.json during #3048 implementation.
const CLAUDE_CODE_HOOKS = {
  SessionStart: [
    'session_context.py',
    'hamr_activation_check.py',
    'prune_file_history.py',
    'canonical_main_wip_check.py',
    'runtime_session_register.py',
  ],
  UserPromptSubmit: [
    'manager_ticket_gate.py',
    'goal_lens.py',
    'userprompt_gate.py',
  ],
  PreToolUse: [
    'commit_ticket_gate.py',
    'pretool_guard.py',
  ],
  PostToolUse: [
    'posttool_reminders.py',
  ],
  Stop: [
    'stop_reminder.py',
  ],
};

// Guards that can emit deny / block decisions (hard enforcement).
// Advisory hooks (posttool_reminders.py) inject additionalContext but
// never return permissionDecision:deny, so they are NOT in this set.
const DENY_CAPABLE = new Set([
  'pretool_guard.py',
  'commit_ticket_gate.py',
  'manager_ticket_gate.py',
  'canonical_main_wip_check.py',
  'stop_reminder.py',
]);

// Reach classification per guard: which operations each one intercepts.
// 'tool-call' = fires before/after any tool the agent invokes.
// 'terminal-git' = specifically targets Bash/terminal/git operations.
// 'prompt' = fires on each user prompt (before tool selection).
// 'session' = fires once per session lifecycle.
const REACH = {
  'pretool_guard.py': ['tool-call', 'terminal-git'],
  'commit_ticket_gate.py': ['terminal-git'],
  'manager_ticket_gate.py': ['prompt'],
  'goal_lens.py': ['prompt'],
  'userprompt_gate.py': ['prompt'],
  'session_context.py': ['session'],
  'hamr_activation_check.py': ['session'],
  'prune_file_history.py': ['session'],
  'canonical_main_wip_check.py': ['session'],
  'runtime_session_register.py': ['session'],
  // PostToolUse fires after the tool call — it can inject context but cannot
  // retroactively block. 'tool-call-post' is distinct from 'tool-call' (PreToolUse).
  'posttool_reminders.py': ['tool-call-post'],
  'stop_reminder.py': ['session'],
};

// Copilot-specific enforcement notes (advisory vs blocking).
// Copilot in VS Code supports PreToolUse hooks in preview but the deny mechanism
// is advisory today: it may show a warning but does not reliably block tool calls
// the way Claude Code's permissionDecision:deny does.
// See research/copilot-governance-actions.md §2.3 and §2.8.
const COPILOT_REACH = {
  'tool-call': 'advisory',      // VS Code hook preview: deny is not hard-enforced
  'tool-call-post': 'advisory', // PostToolUse: context injection only
  'terminal-git': 'advisory',   // same limitation — no permissionDecision:deny parity
  'prompt': 'advisory',         // Copilot custom instructions + AGENTS.md: soft only
  'session': 'advisory',        // Copilot SessionStart hooks wired via plugin.json
};

// Claude Code reach per operation type.
// 'tool-call'      = PreToolUse — permissionDecision:deny is hard-enforced
// 'tool-call-post' = PostToolUse — advisory only; cannot block after the fact
// 'terminal-git'   = Bash/terminal subset of PreToolUse — hard-enforced
// 'prompt'         = UserPromptSubmit — advisory (injects context)
// 'session'        = SessionStart/Stop — advisory (injects context)
const CLAUDE_CODE_REACH = {
  'tool-call': 'blocking',
  'tool-call-post': 'advisory',
  'terminal-git': 'blocking',
  'prompt': 'advisory',
  'session': 'advisory',
};

/**
 * Returns the full enforcement matrix for a given guard script.
 * @param {string} scriptName e.g. 'pretool_guard.py'
 * @returns {{ script:string, reach:string[], denyCapable:boolean,
 *             claudeCodeReach:string, copilotReach:string }}
 */
function guardInfo(scriptName) {
  const reach = REACH[scriptName] || [];
  const ccReach = reach.some((r) => CLAUDE_CODE_REACH[r] === 'blocking')
    ? 'blocking'
    : 'advisory';
  const cpReach = reach.some((r) => COPILOT_REACH[r] !== undefined)
    ? 'advisory'
    : 'not-wired';
  return {
    script: scriptName,
    reach,
    denyCapable: DENY_CAPABLE.has(scriptName),
    claudeCodeReach: ccReach,
    copilotReach: cpReach,
  };
}

/**
 * Returns the legible deny message for a given guard and context. Used in
 * tests to assert the message is operator-actionable (not just an opaque code).
 * @param {string} scriptName
 * @param {string} [context]  optional context string surfaced in the message
 * @returns {string}
 */
function denyMessage(scriptName, context) {
  const base = {
    'pretool_guard.py':
      'DENY [pretool_guard]: canonical-main write blocked or blast-radius cap exceeded. '
      + 'Use a dedicated worktree branch or review governance state.',
    'commit_ticket_gate.py':
      'DENY [commit_ticket_gate]: commit references no active ticket. '
      + 'Set active_ticket in governance state or include #N in the commit message.',
    'manager_ticket_gate.py':
      'DENY [manager_ticket_gate]: no active ticket in governance state. '
      + 'Open or resume a ticket before starting implementation work.',
    'canonical_main_wip_check.py':
      'DENY [canonical_main_wip_check]: uncommitted changes detected in canonical-main. '
      + 'Switch to a worktree branch before editing tracked files.',
    'stop_reminder.py':
      'STOP BLOCKED [stop_reminder]: admin role incomplete or uncommitted changes remain. '
      + 'Complete admin steps (commit, push, PR, CI, merge) before ending the session.',
  }[scriptName];
  if (!base) return `DENY [${scriptName}]: governance gate denied.`;
  return context ? `${base} (${context})` : base;
}

module.exports = {
  CLAUDE_CODE_EVENTS,
  CLAUDE_CODE_HOOKS,
  DENY_CAPABLE,
  REACH,
  CLAUDE_CODE_REACH,
  COPILOT_REACH,
  guardInfo,
  denyMessage,
};
