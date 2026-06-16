// copilot-skill-invoke unit tests — Refs #3047 (C5: skill-invocation wiring for Copilot).
// Strategy: tdd-pyramid. Surface: scripts/global (pure functions, no IO beyond FS reads).
// Stress: not required — pure read-only resolver, one-shot CLI, trivially-bounded input.
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const INVOKE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'copilot-skill-invoke'));
const { WIRED_SKILLS, resolveSkill, buildInvocation, listWiredSkills, parseSkillFrontmatter } = INVOKE;

// --- parseSkillFrontmatter ---

test('parseSkillFrontmatter extracts name, description, user-invocable', () => {
  const md = `---\nname: my-skill\ndescription: Does things\nuser-invocable: true\n---\n# body`;
  const meta = parseSkillFrontmatter(md);
  expect(meta.name).toBe('my-skill');
  expect(meta.description).toBe('Does things');
  expect(meta['user-invocable']).toBe(true);
});

test('parseSkillFrontmatter returns empty object when no frontmatter', () => {
  expect(parseSkillFrontmatter('# No frontmatter')).toEqual({});
});

test('parseSkillFrontmatter coerces false string to boolean false', () => {
  const md = `---\nuser-invocable: false\n---`;
  expect(parseSkillFrontmatter(md)['user-invocable']).toBe(false);
});

// --- WIRED_SKILLS catalog ---

test('WIRED_SKILLS is a non-empty array of strings', () => {
  expect(Array.isArray(WIRED_SKILLS)).toBe(true);
  expect(WIRED_SKILLS.length).toBeGreaterThan(0);
  for (const name of WIRED_SKILLS) expect(typeof name).toBe('string');
});

test('WIRED_SKILLS includes the required governance skills', () => {
  const required = ['global-task-router', 'role-baton-orchestrator', 'docs-drift-maintenance'];
  for (const name of required) expect(WIRED_SKILLS).toContain(name);
});

// --- resolveSkill (using a tmp fake skills root) ---

function makeFakeSkillRoot(skills) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-invoke-test-'));
  for (const [name, md] of Object.entries(skills)) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(path.join(root, name, 'SKILL.md'), md);
  }
  return root;
}

const GOOD_MD = `---\nname: global-task-router\ndescription: Route tasks\nuser-invocable: true\nargument-hint: "[mode] [task]"\n---\n# body`;
const NON_INVOCABLE_MD = `---\nname: global-task-router\ndescription: Route tasks\nuser-invocable: false\n---`;

test('resolveSkill returns ok:true for a wired skill with valid SKILL.md', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': GOOD_MD });
  const result = resolveSkill('global-task-router', { skillsRoot: root });
  expect(result.ok).toBe(true);
  expect(result.skill.name).toBe('global-task-router');
  expect(result.skill.file).toContain('SKILL.md');
});

test('resolveSkill rejects a skill not in WIRED_SKILLS', () => {
  const root = makeFakeSkillRoot({ 'secret-skill': GOOD_MD });
  const result = resolveSkill('secret-skill', { skillsRoot: root });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/not in the governed wired-skills list/);
});

test('resolveSkill returns ok:false when SKILL.md is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-invoke-empty-'));
  const result = resolveSkill('global-task-router', { skillsRoot: root });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/not found/);
});

test('resolveSkill rejects non-invocable skill', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': NON_INVOCABLE_MD });
  const result = resolveSkill('global-task-router', { skillsRoot: root });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/not user-invocable/);
});

test('resolveSkill rejects empty name', () => {
  const result = resolveSkill('', {});
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/non-empty string/);
});

test('resolveSkill rejects null name', () => {
  const result = resolveSkill(null, {});
  expect(result.ok).toBe(false);
});

// --- buildInvocation ---

test('buildInvocation returns ok:true with prompt string for valid skill', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': GOOD_MD });
  const result = buildInvocation('global-task-router', 'classify foo', { skillsRoot: root });
  expect(result.ok).toBe(true);
  expect(result.invocation.prompt).toBe('/global-task-router classify foo');
  expect(result.invocation.skill).toBe('global-task-router');
  expect(result.invocation.hint).toBe('[mode] [task]');
});

test('buildInvocation builds prompt without args when args is empty', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': GOOD_MD });
  const result = buildInvocation('global-task-router', '', { skillsRoot: root });
  expect(result.ok).toBe(true);
  expect(result.invocation.prompt).toBe('/global-task-router');
});

test('buildInvocation propagates resolve error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-invoke-none-'));
  const result = buildInvocation('global-task-router', 'x', { skillsRoot: root });
  expect(result.ok).toBe(false);
  expect(result.reason).toMatch(/not found/);
});

// --- listWiredSkills ---

test('listWiredSkills returns one entry per wired skill', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': GOOD_MD });
  const list = listWiredSkills({ skillsRoot: root });
  expect(list.length).toBe(WIRED_SKILLS.length);
});

test('listWiredSkills marks unavailable skills with null file', () => {
  const root = makeFakeSkillRoot({ 'global-task-router': GOOD_MD });
  const list = listWiredSkills({ skillsRoot: root });
  const unavailable = list.filter((s) => s.file === null);
  // All skills except global-task-router are unavailable in this fake root
  expect(unavailable.length).toBe(WIRED_SKILLS.length - 1);
  const available = list.find((s) => s.name === 'global-task-router');
  expect(available.file).toBeTruthy();
});
