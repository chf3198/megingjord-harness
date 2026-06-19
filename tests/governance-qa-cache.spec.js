'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { get, put } = require('../scripts/global/governance-qa-cache.js');

let counter = 0;
function tmpStore() {
  counter += 1;
  return path.join(os.tmpdir(), `qa-${process.pid}-${counter}.json`);
}

test('put then get returns the cached answer (hit)', () => {
  const store = tmpStore();
  assert.equal(
    put('What is the baton order?', 'Manager, Collaborator, Admin, Consultant', store),
    true
  );
  assert.equal(get('What is the baton order?', store), 'Manager, Collaborator, Admin, Consultant');
  fs.unlinkSync(store);
});

test('get is a clean miss (null) for an unknown question', () => {
  assert.equal(get('never asked', tmpStore()), null);
});

test('case/whitespace variants of the same question hit the same entry', () => {
  const store = tmpStore();
  put('What is the BATON   order?', 'X', store);
  assert.equal(get('what is the baton order?', store), 'X');
  fs.unlinkSync(store);
});

test('different questions do not collide', () => {
  const store = tmpStore();
  put('What is the baton order?', 'A', store);
  put('What is the lane order?', 'B', store);
  assert.equal(get('What is the baton order?', store), 'A');
  assert.equal(get('What is the lane order?', store), 'B');
  fs.unlinkSync(store);
});

test('get/put are resilient to absent/corrupt store and bad input', () => {
  assert.equal(get('q', '/nonexistent/qa.json'), null);
  assert.equal(put('', 'a', tmpStore()), false);
  assert.equal(put('q', null, tmpStore()), false);
});
