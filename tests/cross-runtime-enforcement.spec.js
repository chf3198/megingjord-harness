'use strict';
// Cross-runtime enforcement contract tests (Refs #3048, Epic #3041).
// Asserts the documented enforcement reach for Claude Code vs Copilot hooks
// and verifies each deny-capable guard emits a legible, operator-actionable message.
// Strategy: tdd-pyramid — pure-function contract test, no IO.

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const path = require('node:path');

const MOD = path.resolve(__dirname, '..', 'scripts', 'global', 'cross-runtime-enforcement.js');

describe('cross-runtime-enforcement contract', () => {
  let mod;
  it('loads without error', () => {
    mod = require(MOD);
    assert.ok(mod, 'module must export an object');
  });

  describe('CLAUDE_CODE_HOOKS', () => {
    it('PreToolUse wires pretool_guard.py and commit_ticket_gate.py', () => {
      mod = mod || require(MOD);
      const pre = mod.CLAUDE_CODE_HOOKS.PreToolUse;
      assert.ok(Array.isArray(pre), 'PreToolUse must be an array');
      assert.ok(pre.includes('pretool_guard.py'), 'pretool_guard.py must be wired');
      assert.ok(pre.includes('commit_ticket_gate.py'), 'commit_ticket_gate.py must be wired');
    });

    it('UserPromptSubmit wires manager_ticket_gate.py', () => {
      mod = mod || require(MOD);
      const upm = mod.CLAUDE_CODE_HOOKS.UserPromptSubmit;
      assert.ok(upm.includes('manager_ticket_gate.py'));
    });

    it('PostToolUse wires posttool_reminders.py', () => {
      mod = mod || require(MOD);
      assert.ok(mod.CLAUDE_CODE_HOOKS.PostToolUse.includes('posttool_reminders.py'));
    });

    it('Stop wires stop_reminder.py', () => {
      mod = mod || require(MOD);
      assert.ok(mod.CLAUDE_CODE_HOOKS.Stop.includes('stop_reminder.py'));
    });

    it('all five hook events are present', () => {
      mod = mod || require(MOD);
      const expected = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];
      for (const event of expected) {
        assert.ok(mod.CLAUDE_CODE_EVENTS.includes(event), `${event} must be in CLAUDE_CODE_EVENTS`);
        assert.ok(event in mod.CLAUDE_CODE_HOOKS, `${event} must have a hook entry`);
      }
    });
  });

  describe('DENY_CAPABLE', () => {
    it('pretool_guard.py and commit_ticket_gate.py are deny-capable', () => {
      mod = mod || require(MOD);
      assert.ok(mod.DENY_CAPABLE.has('pretool_guard.py'));
      assert.ok(mod.DENY_CAPABLE.has('commit_ticket_gate.py'));
    });

    it('posttool_reminders.py is NOT deny-capable (advisory only)', () => {
      mod = mod || require(MOD);
      assert.ok(!mod.DENY_CAPABLE.has('posttool_reminders.py'));
    });

    it('every deny-capable guard is wired to PreToolUse or Stop', () => {
      mod = mod || require(MOD);
      const preAndStop = new Set([
        ...mod.CLAUDE_CODE_HOOKS.PreToolUse,
        ...mod.CLAUDE_CODE_HOOKS.Stop,
        ...mod.CLAUDE_CODE_HOOKS.UserPromptSubmit,
        ...mod.CLAUDE_CODE_HOOKS.SessionStart,
      ]);
      for (const guard of mod.DENY_CAPABLE) {
        assert.ok(preAndStop.has(guard), `deny-capable guard ${guard} must be wired`);
      }
    });
  });

  describe('guardInfo()', () => {
    it('pretool_guard.py is blocking in Claude Code, advisory in Copilot', () => {
      mod = mod || require(MOD);
      const info = mod.guardInfo('pretool_guard.py');
      assert.equal(info.claudeCodeReach, 'blocking');
      assert.equal(info.copilotReach, 'advisory');
      assert.ok(info.denyCapable, 'must be deny-capable');
      assert.ok(info.reach.includes('tool-call'), 'must cover tool-call reach');
    });

    it('posttool_reminders.py is advisory in Claude Code', () => {
      mod = mod || require(MOD);
      const info = mod.guardInfo('posttool_reminders.py');
      assert.equal(info.claudeCodeReach, 'advisory');
      assert.ok(!info.denyCapable);
    });

    it('returns a valid shape for every known guard', () => {
      mod = mod || require(MOD);
      const allGuards = Object.values(mod.CLAUDE_CODE_HOOKS).flat();
      const seen = new Set(allGuards);
      for (const guard of seen) {
        const info = mod.guardInfo(guard);
        assert.equal(typeof info.script, 'string');
        assert.ok(Array.isArray(info.reach));
        assert.ok(typeof info.denyCapable === 'boolean');
        assert.ok(['blocking', 'advisory'].includes(info.claudeCodeReach),
          `${guard} claudeCodeReach must be blocking or advisory`);
        assert.ok(['blocking', 'advisory', 'not-wired'].includes(info.copilotReach),
          `${guard} copilotReach must be valid`);
      }
    });
  });

  describe('denyMessage()', () => {
    it('pretool_guard.py message is non-empty and actionable', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('pretool_guard.py');
      assert.ok(typeof msg === 'string' && msg.length > 0);
      // Must name the guard so the operator knows which gate fired.
      assert.ok(msg.includes('pretool_guard'), 'message must name the guard');
      // Must include an action hint.
      assert.ok(
        msg.includes('worktree') || msg.includes('governance'),
        'message must include an actionable hint',
      );
    });

    it('commit_ticket_gate.py message references ticket and action', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('commit_ticket_gate.py');
      assert.ok(msg.includes('commit_ticket_gate'));
      assert.ok(msg.includes('ticket') || msg.includes('#N'));
    });

    it('manager_ticket_gate.py message references ticket', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('manager_ticket_gate.py');
      assert.ok(msg.includes('manager_ticket_gate'));
      assert.ok(msg.includes('ticket'));
    });

    it('stop_reminder.py message references admin steps', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('stop_reminder.py');
      assert.ok(msg.includes('stop_reminder'));
      assert.ok(msg.includes('admin') || msg.includes('commit'));
    });

    it('unknown guard returns a generic deny message with guard name', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('unknown_guard.py');
      assert.ok(msg.includes('unknown_guard.py'));
      assert.ok(msg.length > 10);
    });

    it('context is appended when provided', () => {
      mod = mod || require(MOD);
      const msg = mod.denyMessage('pretool_guard.py', 'path: /some/file');
      assert.ok(msg.includes('path: /some/file'));
    });
  });
});
