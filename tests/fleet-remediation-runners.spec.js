const { test, expect } = require('@playwright/test');
const { classifyError } = require('../scripts/global/fleet-benchmark-runner.js');
const { reason } = require('../scripts/global/fleet-rollout-runner.js');

test.describe('fleet remediation runner taxonomy', () => {
  test('benchmark classifyError maps timeout/memory/http', () => {
    expect(classifyError(0, '', 'Read timed out')).toBe('timeout');
    expect(classifyError(0, '', 'This operation was aborted')).toBe('timeout');
    expect(classifyError(500, 'model requires more system memory')).toBe('memory');
    expect(classifyError(503, 'x')).toBe('http_5xx');
    expect(classifyError(404, 'x')).toBe('http_4xx');
  });

  test('rollout reason maps timeout/memory/http', () => {
    expect(reason(0, '', 'timeout')).toBe('timeout');
    expect(reason(0, '', 'aborted')).toBe('timeout');
    expect(reason(500, 'requires more system memory')).toBe('memory');
    expect(reason(502, 'x')).toBe('http_5xx');
    expect(reason(401, 'x')).toBe('http_4xx');
  });
});
