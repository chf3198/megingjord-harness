// Tests for scripts/global/consultant-checks-lib.js (#1240/#1241/#1243).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const lib = require('../scripts/global/consultant-checks-lib');

test('#1240 gov-002: passes when all four baton artifacts are present', () => {
  const comments = 'MANAGER_HANDOFF\n---\nCOLLABORATOR_HANDOFF\n---\nADMIN_HANDOFF\n---\nCONSULTANT_CLOSEOUT';
  expect(lib.decideGov002(comments)).toBe(true);
});

test('#1240 gov-002: fails when any baton artifact is missing', () => {
  const noManager = 'COLLABORATOR_HANDOFF\nADMIN_HANDOFF\nCONSULTANT_CLOSEOUT';
  const noCollab = 'MANAGER_HANDOFF\nADMIN_HANDOFF\nCONSULTANT_CLOSEOUT';
  const noAdmin = 'MANAGER_HANDOFF\nCOLLABORATOR_HANDOFF\nCONSULTANT_CLOSEOUT';
  const noConsultant = 'MANAGER_HANDOFF\nCOLLABORATOR_HANDOFF\nADMIN_HANDOFF';
  expect(lib.decideGov002(noManager)).toBe(false);
  expect(lib.decideGov002(noCollab)).toBe(false);
  expect(lib.decideGov002(noAdmin)).toBe(false);
  expect(lib.decideGov002(noConsultant)).toBe(false);
  expect(lib.decideGov002('')).toBe(false);
});

test('#1241 gov-003: passes when fleet-health.jsonl has baton: marker', () => {
  expect(lib.decideGov003('{"baton:handoff":1}', '')).toBe(true);
});

test('#1241 gov-003: passes when events.jsonl has baton:handoff type', () => {
  expect(lib.decideGov003('', '{"type":"baton:handoff"}')).toBe(true);
});

test('#1241 gov-003: fails when neither log carries baton evidence', () => {
  expect(lib.decideGov003('', '')).toBe(false);
  expect(lib.decideGov003('{"telemetry":"only"}', '{"type":"system"}')).toBe(false);
});

test('#1243 gov-005: passes when issue body has no unchecked ACs', () => {
  expect(lib.decideGov005('- [x] AC1\n- [x] AC2')).toBe(true);
  expect(lib.decideGov005('no checklist at all')).toBe(true);
  expect(lib.decideGov005('')).toBe(true);
});

test('#1243 gov-005: fails when issue body has any unchecked AC', () => {
  expect(lib.decideGov005('- [ ] AC1 unchecked\n- [x] AC2')).toBe(false);
  expect(lib.decideGov005('- [x] AC1\n- [ ] AC2 unchecked')).toBe(false);
});

test('#1241 AC1: readWithMainFallback reads local file when present', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consultant-fallback-'));
  const sub = path.join(tmp, 'logs');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'fleet-health.jsonl'), '{"baton:handoff":"local"}\n');
  const result = lib.readWithMainFallback({
    fs, path, run: () => '', cwdRoot: tmp, relPath: 'logs/fleet-health.jsonl',
  });
  expect(result).toContain('baton:handoff');
  expect(result).toContain('local');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('#1241 AC1: readWithMainFallback falls back to main checkout when worktree empty', () => {
  const tmpMain = fs.mkdtempSync(path.join(os.tmpdir(), 'consultant-main-'));
  const tmpWt = fs.mkdtempSync(path.join(os.tmpdir(), 'consultant-wt-'));
  const sub = path.join(tmpMain, '.dashboard');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, 'events.jsonl'), '{"type":"baton:handoff","src":"main"}\n');
  const fakeRun = () => `worktree ${tmpMain}\nbranch refs/heads/main\n\nworktree ${tmpWt}\nbranch refs/heads/feature\n`;
  const result = lib.readWithMainFallback({
    fs, path, run: fakeRun, cwdRoot: tmpWt, relPath: '.dashboard/events.jsonl',
  });
  expect(result).toContain('baton:handoff');
  expect(result).toContain('main');
  fs.rmSync(tmpMain, { recursive: true, force: true });
  fs.rmSync(tmpWt, { recursive: true, force: true });
});

test('#1241 AC1: readWithMainFallback returns empty when neither path has file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consultant-empty-'));
  const result = lib.readWithMainFallback({
    fs, path, run: () => `worktree ${tmp}\n`, cwdRoot: tmp, relPath: 'logs/missing.jsonl',
  });
  expect(result).toBe('');
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('#1615 isIssueOnlyLane: lane:docs-research → true (skip branch check)', () => {
  expect(lib.isIssueOnlyLane('lane:docs-research\ntype:research\npriority:P1')).toBe(true);
});

test('#1615 isIssueOnlyLane: type:epic → true (Epic closeout from main is valid)', () => {
  expect(lib.isIssueOnlyLane('type:epic\nstatus:review\npriority:P2')).toBe(true);
});

test('#1615 isIssueOnlyLane: lane:trivial → true (no PR expected)', () => {
  expect(lib.isIssueOnlyLane('lane:trivial\ntype:task')).toBe(true);
});

test('#1615 isIssueOnlyLane: lane:code-change → false (branch check enforced)', () => {
  expect(lib.isIssueOnlyLane('lane:code-change\ntype:bug\npriority:P2')).toBe(false);
});

test('#1615 isIssueOnlyLane: empty/null → false (branch check enforced)', () => {
  expect(lib.isIssueOnlyLane('')).toBe(false);
  expect(lib.isIssueOnlyLane(null)).toBe(false);
  expect(lib.isIssueOnlyLane(undefined)).toBe(false);
});
