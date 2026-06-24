const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');

describe('dashboard lint regression (#3060)', () => {
  it('baton-flow.js has zero no-undef warnings', () => {
    const out = execSync(
      'npx eslint -c lint-configs/eslint.config.devenv.js dashboard/js/baton-flow.js --format json 2>/dev/null',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const results = JSON.parse(out);
    const noUndefs = results[0].messages.filter(m => m.ruleId === 'no-undef');
    assert.strictEqual(noUndefs.length, 0,
      'no-undef warnings found: ' + noUndefs.map(m => m.message).join('; '));
  });

  it('event-bus.js has zero no-undef warnings', () => {
    const out = execSync(
      'npx eslint -c lint-configs/eslint.config.devenv.js dashboard/js/event-bus.js --format json 2>/dev/null',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    const results = JSON.parse(out);
    const noUndefs = results[0].messages.filter(m => m.ruleId === 'no-undef');
    assert.strictEqual(noUndefs.length, 0,
      'no-undef warnings found: ' + noUndefs.map(m => m.message).join('; '));
  });

  it('event-bus.js exports detectMissingEvents', () => {
    const EB = require('../dashboard/js/event-bus.js');
    assert.strictEqual(typeof EB.detectMissingEvents, 'function');
  });

  it('event-bus.js exports getTicketTimeline', () => {
    const EB = require('../dashboard/js/event-bus.js');
    assert.strictEqual(typeof EB.getTicketTimeline, 'function');
  });

  it('both files are ≤100 lines', () => {
    const fs = require('node:fs');
    const bf = fs.readFileSync('dashboard/js/baton-flow.js', 'utf8');
    const eb = fs.readFileSync('dashboard/js/event-bus.js', 'utf8');
    assert.ok(bf.split('\n').length <= 101, 'baton-flow.js exceeds 100 lines');
    assert.ok(eb.split('\n').length <= 101, 'event-bus.js exceeds 100 lines');
  });
});
