// cascade-policy-overrides consumer (in model-routing-engine) tests (#977).
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ENGINE = require(path.resolve(__dirname, '..', 'scripts', 'global', 'model-routing-engine.js'));
const OVERRIDES = path.join(os.homedir(), '.megingjord', 'cascade-policy-overrides.json');

test('loadOverrides returns null when file absent', () => {
  // Move existing temporarily if present
  const backup = fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : null;
  if (backup) fs.unlinkSync(OVERRIDES);
  try {
    expect(ENGINE.loadOverrides()).toBeNull();
  } finally {
    if (backup) fs.writeFileSync(OVERRIDES, backup);
  }
});

test('loadOverrides returns parsed JSON when file present', () => {
  const stash = fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : null;
  fs.mkdirSync(path.dirname(OVERRIDES), { recursive: true });
  fs.writeFileSync(OVERRIDES, JSON.stringify({ ts: 123, providers: { groq: { available: true } }, stale: false }));
  try {
    const o = ENGINE.loadOverrides();
    expect(o.providers.groq.available).toBe(true);
    expect(o.stale).toBe(false);
  } finally {
    if (stash) fs.writeFileSync(OVERRIDES, stash);
    else fs.unlinkSync(OVERRIDES);
  }
});

test('loadOverrides returns null on malformed JSON (graceful)', () => {
  const stash = fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : null;
  fs.writeFileSync(OVERRIDES, '{not json');
  try {
    expect(ENGINE.loadOverrides()).toBeNull();
  } finally {
    if (stash) fs.writeFileSync(OVERRIDES, stash);
    else fs.unlinkSync(OVERRIDES);
  }
});

test('resolveRouting includes overridesApplied flag', () => {
  const stash = fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : null;
  fs.mkdirSync(path.dirname(OVERRIDES), { recursive: true });
  fs.writeFileSync(OVERRIDES, JSON.stringify({ ts: Date.now(), providers: {}, stale: false }));
  try {
    const r = ENGINE.resolveRouting('test prompt', { lane: 'fleet', complexity: 0.4 });
    expect(r.overridesApplied).toBe(true);
    expect(r.overridesStale).toBe(false);
    expect(r.lane).toBe('fleet');
  } finally {
    if (stash) fs.writeFileSync(OVERRIDES, stash);
    else fs.unlinkSync(OVERRIDES);
  }
});

test('resolveRouting unchanged when overrides absent (back-compat)', () => {
  const stash = fs.existsSync(OVERRIDES) ? fs.readFileSync(OVERRIDES) : null;
  if (stash) fs.unlinkSync(OVERRIDES);
  try {
    const r = ENGINE.resolveRouting('test prompt', { lane: 'haiku', complexity: 0.5 });
    expect(r.overridesApplied).toBe(false);
    expect(r.lane).toBe('haiku');
  } finally {
    if (stash) fs.writeFileSync(OVERRIDES, stash);
  }
});
