'use strict';
// Contract test: keep_alive is threaded into the dispatch request bodies (Epic #3414 #3484 AC1).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('ollama-direct forwards keep_alive into the /api/chat body when provided', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'ollama-direct.js'), 'utf8');
  assert.match(src, /opts\.keepAlive\s*\?\s*\{\s*keep_alive:\s*opts\.keepAlive\s*\}/);
});

test('litellm-client forwards keep_alive into the chat body when provided', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'litellm-client.js'), 'utf8');
  assert.match(src, /opts\.keepAlive\s*\?\s*\{\s*keep_alive:\s*opts\.keepAlive\s*\}/);
});

test('cascade-dispatch derives the fleet route + keepAlive from the stakes router', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'global', 'cascade-dispatch.js'), 'utf8');
  assert.match(src, /resolveFleetRoute/);
  assert.match(src, /keepAlive/);
});
