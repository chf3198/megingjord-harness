'use strict';
// tdd-pyramid unit suite for prompt-artifact-lint (#3302). Covers each structural
// check (broken links, frontmatter, stub body, JSON) plus the .claude/commands
// deploy-copy fallback resolution that prevents false positives on skill-internal links.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  lintFile, validate, resolveTarget, isExternalOrAnchor,
  checkJson, parseFrontmatter,
} = require('../scripts/global/megalint/prompt-artifact-lint.js');

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pa-lint-'));
}
function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}
const SKILL_OK = '---\nname: demo\ndescription: a demo skill\n---\n\n# Demo\n\nBody text that is clearly long enough to not be a stub.';

test('flags a broken relative link', () => {
  const root = tmpRoot();
  const f = writeFile(root, 'skills/demo/SKILL.md', SKILL_OK + '\n[gone](./missing.md)');
  const out = lintFile(f, { repoRoot: root });
  assert.equal(out.filter(x => x.rule === 'broken-link').length, 1);
});

test('valid relative link passes', () => {
  const root = tmpRoot();
  writeFile(root, 'skills/demo/extra.md', '# extra');
  const f = writeFile(root, 'skills/demo/SKILL.md', SKILL_OK + '\n[ok](./extra.md)');
  assert.equal(lintFile(f, { repoRoot: root }).length, 0);
});

test('external links and anchors are skipped', () => {
  for (const t of ['https://x.com', 'http://x', 'mailto:a@b.c', '#section', 'tel:123']) {
    assert.equal(isExternalOrAnchor(t), true, t);
  }
  assert.equal(isExternalOrAnchor('./rel.md'), false);
});

test('.claude/commands deploy-copy resolves links against source skill (no false positive)', () => {
  const root = tmpRoot();
  writeFile(root, 'skills/router/references/MAP.md', '# map');
  writeFile(root, 'skills/router/SKILL.md', SKILL_OK + '\n[map](references/MAP.md)');
  const cmd = writeFile(root, '.claude/commands/router.md', '# Router\n\nlong enough body here\n[map](references/MAP.md)');
  assert.equal(lintFile(cmd, { repoRoot: root }).length, 0);
  // sanity: same link from an unrelated location IS broken
  const r = resolveTarget(path.join(root, 'skills/other/SKILL.md'), 'references/MAP.md', root);
  assert.equal(r.resolved, false);
});

test('SKILL.md missing frontmatter name/description is flagged', () => {
  const root = tmpRoot();
  const f = writeFile(root, 'skills/bad/SKILL.md', '---\nname: only-name\n---\n\n# B\n\nsufficiently long body content here.');
  const out = lintFile(f, { repoRoot: root });
  assert.equal(out.filter(x => x.rule === 'missing-frontmatter').length, 1);
});

test('*.agent.md requires frontmatter; plain fragment .md does not', () => {
  const root = tmpRoot();
  const agent = writeFile(root, 'agents/foo.agent.md', '# no frontmatter\n\nthis is a reasonably long body for an agent file.');
  assert.equal(lintFile(agent, { repoRoot: root }).filter(x => x.rule === 'missing-frontmatter').length, 1);
  const frag = writeFile(root, 'agents/pre-merge-review/fragment.md', '# fragment\n\nthis is a reasonably long fragment body, no frontmatter expected.');
  assert.equal(lintFile(frag, { repoRoot: root }).filter(x => x.rule === 'missing-frontmatter').length, 0);
});

test('stub / header-less body is flagged', () => {
  const root = tmpRoot();
  const f = writeFile(root, 'skills/stub/SKILL.md', '---\nname: s\ndescription: d\n---\nhi');
  assert.equal(lintFile(f, { repoRoot: root }).filter(x => x.rule === 'stub-body').length, 1);
});

test('malformed JSON flagged; agent-def JSON missing description flagged; roster exempt', () => {
  assert.equal(checkJson('{bad', '/x.json').filter(x => x.rule === 'malformed-json').length, 1);
  assert.equal(checkJson('{"name":"a"}', '/a.json').filter(x => x.rule === 'missing-frontmatter').length, 1);
  assert.equal(checkJson('{"version":1,"description":"roster","personas":[]}', '/r.json').length, 0);
});

test('parseFrontmatter handles CRLF and absent block', () => {
  assert.equal(parseFrontmatter('no fm here'), null);
  const fm = parseFrontmatter('---\r\nname: x\r\ndescription: y\r\n---\r\nbody');
  assert.equal(fm.name, 'x');
});

test('validate() reports ok on a clean fixture set', () => {
  const root = tmpRoot();
  writeFile(root, 'skills/clean/SKILL.md', SKILL_OK);
  writeFile(root, 'agents/roster.json', '{"version":1,"description":"r","personas":[]}');
  assert.equal(validate([], { repoRoot: root }).ok, true);
});

test('AC2 regression: the real repo tree has no structural defects', () => {
  const repoRoot = path.join(__dirname, '..');
  const { ok, findings } = validate([], { repoRoot });
  assert.equal(ok, true,
    'prompt-artifact-lint found defects in the tree:\n' +
    findings.map(f => `${f.file}${f.line ? ':' + f.line : ''} [${f.rule}] ${f.detail}`).join('\n'));
});
