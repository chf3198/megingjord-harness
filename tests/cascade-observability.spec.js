'use strict';
// Integration spec: cascade-dispatch wires progress + failover observability (#2842 / C2).
// AC2 (tier-start heartbeat reaches stderr around the fleet call) + AC3 (free-cloud failover line).
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const G = (m) => require.resolve(path.join(__dirname, '..', 'scripts', 'global', m));
function seed(modName, exports) {
  const id = G(modName);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
function loadCascadeFresh() {
  delete require.cache[G('cascade-dispatch')];
  return require(G('cascade-dispatch'));
}

// Capture stderr around a single async run; always restore.
async function captureStderr(fn) {
  const lines = [];
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => { lines.push(String(chunk)); return true; };
  try { await fn(); } finally { process.stderr.write = orig; }
  return lines.join('');
}

test('AC2: a healthy fleet inference emits the tier-start heartbeat line to stderr', async () => {
  seed('litellm-client', {
    // #2929 C3: cascade now dispatches via the probe-first dispatchFleet (not healthCheck+chatComplete).
    dispatchFleet: async () => ({ ok: true, content: 'a sufficiently long fleet answer body', model: 'qwen2.5:7b-instruct', backend: 'litellm' }),
  });
  seed('model-routing-telemetry', { recordTelemetry: () => {} });
  seed('local-judge', { judgeResponse: async () => ({ ok: false }) });
  seed('free-cloud-dispatch', { dispatchFreeCloud: async () => ({ ok: false }) });
  const { cascade } = loadCascadeFresh();
  const err = await captureStderr(() => cascade('what is two plus two', { env: true }));
  assert.match(err, /\[cascade\] fleet inference \(qwen2\.5:7b-instruct\) — starting/);
});

test('AC3: fleet-unreachable emits the free-cloud failover line to stderr ($0, never paid)', async () => {
  seed('litellm-client', {
    // dispatchFleet itself can't reach either backend -> returns an availability error -> free-cloud.
    dispatchFleet: async () => ({ ok: false, error: 'ollama_unreachable', backend: 'ollama', fallback_reason: 'probe-failed' }),
  });
  seed('model-routing-telemetry', { recordTelemetry: () => {} });
  seed('local-judge', { judgeResponse: async () => ({ ok: false }) });
  seed('free-cloud-dispatch', { dispatchFreeCloud: async () => ({ ok: true, content: 'free answer', provider: 'gemini' }) });
  const { cascade } = loadCascadeFresh();
  const err = await captureStderr(() => cascade('explain something', { env: true }));
  assert.match(err, /\[cascade\] fleet unavailable \(ollama_unreachable\) → free-cloud failover \(\$0\)/);
});
