// Stress tests for #2855 IDE/MCP coexistence — port-collision + lock-coexistence chaos (G6) + a p99
// budget on resolution (G7). Satisfies #2802 AC7 for the port/lock surface. Network/disk-free (injected).
const { test, expect } = require('@playwright/test');
const net = require('node:net');
const { resolveCoexistence, detectHostMcpPorts } = require('../scripts/global/fleet-mcp-coexist.js');
const { defaultBinder } = require('../scripts/global/fleet-mcp-portbind.js');

// This one test exercises the REAL defaultBinder over loopback (not injected) to cover the bind-failure
// path + FD release; everything else is injected and network-free.
test('#2855 REAL defaultBinder: returns null for an in-use port and rebinds after release', async () => {
  const held = await new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => resolve({ port: srv.address().port, close: () => srv.close() }));
  });
  const busy = await defaultBinder(held.port); // port in use → null (error path closes its server, no FD leak)
  expect(busy).toBe(null);
  held.close();
  const free = await defaultBinder(held.port); // freed → bindable
  expect(free).not.toBe(null);
  free.release();
});

// A stateful fake binder that models the OS port mutex: a bound port is unavailable until released.
function osLikeBinder() {
  const bound = new Set();
  return {
    binder: (port) => {
      if (bound.has(port)) return null; // EADDRINUSE — already held
      bound.add(port);
      return { release: () => bound.delete(port) };
    },
    bound,
  };
}

test('#2855 LOCK: two concurrent loops never bind the same port (held bind is the lock)', async () => {
  const { binder } = osLikeBinder();
  const runA = await resolveCoexistence({ binder, readConfig: () => null });
  const runB = await resolveCoexistence({ binder, readConfig: () => null });
  expect(runA.mode).toBe('port');
  expect(runB.mode).toBe('port');
  expect(runA.port).not.toBe(runB.port); // second loop got a different port — no double-bind
});

test('#2855 LOCK: releasing a port lets the next loop reuse it', async () => {
  const { binder } = osLikeBinder();
  const runA = await resolveCoexistence({ preferredPort: 8900, binder, readConfig: () => null });
  expect(runA.port).toBe(8900);
  runA.release();
  const runB = await resolveCoexistence({ preferredPort: 8900, binder, readConfig: () => null });
  expect(runB.port).toBe(8900); // freed → reusable
});

test('#2855 CHAOS: a config declaring every candidate port forces disk-read-only', async () => {
  const { binder } = osLikeBinder();
  const config = { servers: Object.fromEntries(
    [8900, 8901, 8902, 8903, 8904].map((port, idx) => [`s${idx}`, { port }])) };
  const out = await resolveCoexistence({ binder, readConfig: () => config });
  expect(out.mode).toBe('disk-read-only');
  expect(out.avoided.sort((first, second) => first - second)).toEqual([8900, 8901, 8902, 8903, 8904]);
});

test('#2855 CHAOS: adversarial / malformed host configs degrade to [] (never throw)', () => {
  const cases = [null, undefined, 42, 'str', [], { servers: null }, { servers: 'x' },
    { mcpServers: { a: null, b: { port: 'NaN' }, c: { url: 'no-port-here' } } },
    { servers: { d: { url: `http://h:${'9'.repeat(9000)}/x` } } }];
  for (const config of cases) {
    expect(() => detectHostMcpPorts({ readConfig: () => config })).not.toThrow();
    expect(Array.isArray(detectHostMcpPorts({ readConfig: () => config }))).toBe(true);
  }
});

test('#2855 PERF: resolveCoexistence p99 < 5ms (injected binder)', async () => {
  const samples = [];
  const binder = () => ({ release: () => {} });
  for (let iter = 0; iter < 1000; iter += 1) {
    const start = process.hrtime.bigint();
    await resolveCoexistence({ preferredPort: 8900, binder, readConfig: () => null });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((first, second) => first - second);
  expect(samples[Math.floor(samples.length * 0.99)]).toBeLessThan(5);
});
