// Unit tests — verify dashboard modules are testable in Node.js
// This proves the dual-export pattern: browser globals + module.exports
const { test, expect } = require('@playwright/test');

test.describe('Node.js module exports', () => {
  test('health-check exports mergeHealthStatus', () => {
    const { mergeHealthStatus } = require('../dashboard/js/health-check.js');
    const devices = [
      { id: 'a', alias: 'dev', status: 'offline' },
      { id: 'b', alias: 'gpu', status: 'healthy' },
    ];
    const checks = { a: { status: 'healthy' } };
    const result = mergeHealthStatus(devices, checks);
    expect(result[0].status).toBe('healthy');
    expect(result[1].status).toBe('healthy');
  });

  test('provider-presets exports PROVIDER_PRESETS', () => {
    const { PROVIDER_PRESETS, getProviderPreset } = require('../dashboard/js/provider-presets.js');
    expect(PROVIDER_PRESETS.ollama.label).toBe('Ollama');
    expect(getProviderPreset('openai').label).toBe('OpenAI');
    expect(getProviderPreset('nonexistent').label).toBe('Custom Endpoint');
  });

  test('event-bus exports eventToActivity', () => {
    const { eventToActivity } = require('../dashboard/js/event-bus.js');
    const e = { type: 'git:commit', agent: 'impl', detail: 'fix bug' };
    const a = eventToActivity(e);
    expect(a.type).toBe('commit');
    expect(a.message).toContain('impl');
  });

  test('github-monitor exports ghIcon', () => {
    const { ghIcon } = require('../dashboard/js/github-monitor.js');
    expect(ghIcon('success')).toBe('✅');
    expect(ghIcon('failure')).toBe('❌');
    expect(ghIcon('unknown')).toBe('⬜');
  });
});

test.describe('Judge gate wiring — #512', () => {
  test('model-routing-policy has judge.enabled=true and judge.model set', () => {
    const policy = require('../scripts/global/model-routing-policy.json');
    expect(policy.judge.enabled).toBe(true);
    expect(typeof policy.judge.model).toBe('string');
    expect(policy.judge.model.length).toBeGreaterThan(0);
    expect(typeof policy.judge.threshold).toBe('number');
  });

  test('local-judge exports JUDGE_MODEL and DEFAULT_THRESHOLD', () => {
    const { JUDGE_MODEL, DEFAULT_THRESHOLD } = require('../scripts/global/local-judge.js');
    expect(typeof JUDGE_MODEL).toBe('string');
    expect(DEFAULT_THRESHOLD).toBe(0.7);
  });

  test('cascade-dispatch assessQuality rejects short content', () => {
    const { assessQuality, hints } = require('../scripts/global/cascade-dispatch.js');
    const h = hints('write a function');
    const result = assessQuality('short', h);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('too_short');
  });

  test('cascade-dispatch assessQuality passes adequate plain response', () => {
    const { assessQuality, hints } = require('../scripts/global/cascade-dispatch.js');
    const h = hints('explain what a variable is');
    const long = 'A variable is a named storage location in memory. '.repeat(3);
    const result = assessQuality(long, h);
    expect(result.pass).toBe(true);
  });

  test('cascade-dispatch source wires judgeModel from policy to judgeResponse', () => {
    const fs = require('fs'), path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../scripts/global/cascade-dispatch.js'), 'utf8');
    expect(src).toContain('judgeModel: jcfg.model');
    expect(src).toContain('judge_latency_ms: j.latency_ms');
  });
});
