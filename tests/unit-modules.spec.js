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
