const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { renderPrompt, TEMPLATE_DIR } = require('../scripts/global/synthesis-prompt-render.js');

test('three canonical templates exist with .md extension', () => {
  for (const name of ['admin-init', 'team-prep', 'team-init']) {
    assert.ok(fs.existsSync(path.join(TEMPLATE_DIR, `${name}.md`)),
      `template ${name}.md must exist`);
  }
});

test('renderPrompt substitutes all placeholders in admin-init', () => {
  const out = renderPrompt('admin-init', {
    epic_n: '1112', admin_team: 'cc', team_list: 'cc, cp, cx, ag', wall_clock_cap: '24',
  });
  assert.ok(!out.match(/\{\{\w+\}\}/), 'no unsubstituted placeholders');
  assert.match(out, /Epic #1112/);
  assert.match(out, /Admin-team: cc/);
  assert.match(out, /24h/);
});

test('renderPrompt substitutes all placeholders in team-prep', () => {
  const out = renderPrompt('team-prep', {
    epic_n: '1112', team_code: 'ag', team_alias: 'Apollo Harper',
  });
  assert.ok(!out.match(/\{\{\w+\}\}/));
  assert.match(out, /team-code: ag/);
  assert.match(out, /Apollo Harper/);
});

test('renderPrompt substitutes all placeholders in team-init', () => {
  const out = renderPrompt('team-init', {
    epic_n: '1112', team_code: 'cc', team_alias: 'Orla Harper',
  });
  assert.ok(!out.match(/\{\{\w+\}\}/));
  assert.match(out, /planning\/synthesis-1112\/artifacts\/cc-rd\.md/);
});

test('renderPrompt throws on missing vars', () => {
  assert.throws(() => renderPrompt('admin-init', { epic_n: '1112' }),
    /missing required vars/);
});

test('renderPrompt throws on unknown template', () => {
  assert.throws(() => renderPrompt('does-not-exist', { epic_n: '1112' }),
    /template not found/);
});

test('renderPrompt throws on invalid args', () => {
  assert.throws(() => renderPrompt(null, {}), /name required/);
  assert.throws(() => renderPrompt('admin-init', null), /vars object required/);
});

test('all templates are ≤100 lines per repo line-cap', () => {
  for (const name of ['admin-init', 'team-prep', 'team-init']) {
    const lines = fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.md`), 'utf8').split('\n').length;
    assert.ok(lines <= 100, `${name}.md has ${lines} lines (cap 100)`);
  }
});
