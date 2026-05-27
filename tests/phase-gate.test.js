'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gate = require('../scripts/global/phase-gate.js');

const gh = map => args => {
  if (args[0] === 'issue' && args[1] === 'list') return map.list;
  if (args[0] === 'issue' && args[1] === 'view') return map.views[args[2]];
  throw new Error(`unexpected gh args: ${args.join(' ')}`);
};

test('creation allowed when parent epic R&D is done', () => {
  const mock = gh({
    list: [{ number: 10, title: 'D-2000-01: Phase-0 R&D', body: '## Parent Epic\n#2000', state: 'CLOSED', labels: [] }],
    views: {},
  });
  assert.deepEqual(gate.checkCreation(2000, mock), []);
});

test('creation denied when parent epic R&D missing or open', () => {
  const missing = gh({ list: [], views: {} });
  assert.match(gate.checkCreation(2001, missing)[0], /missing Phase-0 R&D/i);
  const open = gh({
    list: [{ number: 11, title: 'D-2001-01: Phase-0 R&D', body: '## Parent Epic\n#2001', state: 'OPEN', labels: [] }],
    views: {},
  });
  assert.match(gate.checkCreation(2001, open)[0], /gate not complete/i);
});

test('transition denied when dependency is not complete', () => {
  const mock = gh({
    list: [{ number: 12, title: 'D-3000-01: Phase-0 R&D', body: '## Parent Epic\n#3000', state: 'CLOSED', labels: [] }],
    views: { '99': { number: 99, state: 'OPEN', labels: [] } },
  });
  const failures = gate.checkTransition({ number: 101, body: '## Parent Epic\n#3000\n\n## Depends On\n#99' }, mock);
  assert.match(failures.join('\n'), /dependency #99 not complete/i);
});

test('bypass audit log records actor and failures', () => {
  const home = fs.mkdtempSync(path.join(process.cwd(), 'tmp-phase-gate-'));
  const oldHome = process.env.HOME;
  process.env.HOME = home;
  process.env.USER = 'tester';
  gate.logBypass({ issue: 55, toStatus: 'in-progress' }, ['failure']);
  const file = path.join(home, '.megingjord', 'phase-gate-bypass.jsonl');
  const entry = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  assert.equal(entry.actor, 'tester');
  assert.equal(entry.context.issue, 55);
  process.env.HOME = oldHome;
});
