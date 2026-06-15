const test = require('node:test');
const assert = require('node:assert/strict');

test('planning-consensus role guard fixtures stay explicit', () => {
  const good = 'Role: manager';
  const bad = 'Role: collaborator';

  assert.match(good, /^Role:\s*manager$/);
  assert.doesNotMatch(bad, /^Role:\s*manager$/);
});
