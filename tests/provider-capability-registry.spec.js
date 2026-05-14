const { test, expect } = require('@playwright/test');
const registryTools = require('../scripts/global/provider-capability-registry');

test('provider capability registry validates cleanly', () => {
  const registry = registryTools.loadRegistry();
  expect(registryTools.validateRegistry(registry)).toEqual([]);
});

test('runtime and provider records stay separate', () => {
  const registry = registryTools.loadRegistry();
  const runtimeIds = new Set(registry.runtimes.map(r => r.id));
  for (const provider of registry.providers) {
    expect(runtimeIds.has(provider.id)).toBe(false);
  }
});

test('validator rejects missing telemetry confidence and citations', () => {
  const registry = registryTools.loadRegistry();
  const broken = {
    ...registry,
    providers: [{ ...registry.providers[0], telemetryConfidence: '', citations: [] }],
  };
  const errors = registryTools.validateRegistry(broken).join('\n');
  expect(errors).toContain('missing telemetryConfidence');
  expect(errors).toContain('missing citations');
});

test('generated markdown names output source and owner boundary', () => {
  const registry = registryTools.loadRegistry();
  const markdown = registryTools.renderMarkdown(registry);
  expect(markdown).toContain('provider-capability-registry.json');
  expect(markdown).toContain('Owner boundary:');
  expect(markdown).toContain('| openai-compatible |');
});
