'use strict';
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rescope = require(path.join(root, 'scripts/global/closeout-rescope-parser.js'));
const consultantRule = require(path.join(root, 'scripts/global/closeout-consultant-rule.js'));

test.describe('C1 #1287 — EPIC_RESCOPE parser', () => {
  test('parses a valid RESCOPE block', () => {
    const text = `EPIC_RESCOPE\ndeferred_acs: [AC4, AC5]\ndeferred_reason_per_ac:\n  AC4: structural-measurement-window\n  AC5: dependent-on-producer\nre_evaluate_by: 2026-05-24\nfollow_on_tickets: [#1234]\nsigned_by: Nova Vale\nTeam&Model: codex:gpt-5@codex-cli\nRole: consultant\n`;
    const blocks = rescope.parseRescopeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].deferred_acs).toEqual(['AC4', 'AC5']);
    expect(blocks[0].errors).toEqual([]);
  });
  test('rejects RESCOPE signed by manager', () => {
    const text = `EPIC_RESCOPE\ndeferred_acs: [AC4]\ndeferred_reason_per_ac:\n  AC4: external-blocker\nfollow_on_tickets: []\nsigned_by: Cole Mason\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager\n`;
    const blocks = rescope.parseRescopeBlocks(text);
    expect(blocks[0].errors.some(e => /manager/i.test(e))).toBe(true);
  });
  test('parses Epic AC checkboxes', () => {
    const acs = rescope.parseEpicAcs('- [x] **AC1**: done\n- [ ] **AC2**: pending\n');
    expect(acs).toEqual([{ id: 'AC1', checked: true }, { id: 'AC2', checked: false }]);
  });
  test('flags missing reason for time-windowed deferral', () => {
    const text = `EPIC_RESCOPE\ndeferred_acs: [AC4]\ndeferred_reason_per_ac:\n  AC4: structural-measurement-window\nfollow_on_tickets: []\nsigned_by: Nova Vale\nTeam&Model: copilot:gpt-5.3-codex@local\nRole: consultant\n`;
    const blocks = rescope.parseRescopeBlocks(text);
    expect(blocks[0].errors.some(e => /re_evaluate_by/.test(e))).toBe(true);
  });
});

test.describe('C2 #1288 — Consultant cross-team rule', () => {
  test('teamOf extracts team part', () => {
    expect(consultantRule.teamOf('claude-code:opus-4-7@anthropic')).toBe('claude-code');
    expect(consultantRule.teamOf('codex:gpt-5@codex-cli')).toBe('codex');
    expect(consultantRule.teamOf(null)).toBe(null);
  });
  test('flags same-team Manager+Consultant on Epic close', () => {
    const closeout = { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Cole Vale\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: consultant\n' };
    const comments = [
      { body: 'MANAGER_HANDOFF\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager\n' },
      closeout,
    ];
    const violations = consultantRule.validateConsultantClose({ closeout, comments });
    expect(violations.some(v => /matches MANAGER_HANDOFF team/.test(v))).toBe(true);
  });
  test('passes cross-team Consultant on Epic close', () => {
    const closeout = { body: 'CONSULTANT_EPIC_CLOSEOUT\nSigned-by: Nova Vale\nTeam&Model: codex:gpt-5@codex-cli\nRole: consultant\n' };
    const comments = [
      { body: 'MANAGER_HANDOFF\nTeam&Model: claude-code:opus-4-7@anthropic\nRole: manager\n' },
      closeout,
    ];
    const violations = consultantRule.validateConsultantClose({ closeout, comments });
    expect(violations.filter(v => /matches MANAGER_HANDOFF team/.test(v))).toHaveLength(0);
  });
});
