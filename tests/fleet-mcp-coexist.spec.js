// Refs #2855 P1-0 child of #2802 — IDE/native-MCP coexistence resolver. Network/disk-free: the port
// binder and the host-config reader are injected.
const { test, expect } = require('@playwright/test');
const {
  resolveCoexistence, detectHostMcpPorts, pickBoundPort, DEFAULT_CANDIDATES,
} = require('../scripts/global/fleet-mcp-coexist.js');

const freeBinder = () => ({ release: () => {} });            // every port bindable
const busyBinder = () => null;                                // every port in use
const onlyFree = (free) => (port) => (free.includes(port) ? { release: () => {} } : null);

test('#2855 AC1 binds the preferred free port (no host config)', async () => {
  const out = await resolveCoexistence({ preferredPort: 8900, binder: freeBinder, readConfig: () => null });
  expect(out.mode).toBe('port');
  expect(out.port).toBe(8900);
  expect(out.avoided).toEqual([]);
  expect(typeof out.release).toBe('function');
});

test('#2855 AC1 falls through to the next free candidate when the preferred port is busy', async () => {
  const out = await resolveCoexistence({ preferredPort: 8900, binder: onlyFree([8902]), readConfig: () => null });
  expect(out.mode).toBe('port');
  expect(out.port).toBe(8902);
});

test('#2855 AC1 degrades to disk-read-only when every candidate is busy (never hard-fails)', async () => {
  const out = await resolveCoexistence({ binder: busyBinder, readConfig: () => null });
  expect(out.mode).toBe('disk-read-only');
  expect(out.reason).toMatch(/disk-read-only/);
});

test('#2855 AC3 avoids ports a host IDE MCP config declares (servers.port + url)', async () => {
  const config = { servers: { a: { port: 8900 }, b: { url: 'http://127.0.0.1:8901/mcp' } } };
  const ports = detectHostMcpPorts({ readConfig: () => config });
  expect(ports.sort()).toEqual([8900, 8901]);
  // the resolver must skip those and bind a non-avoided candidate
  const out = await resolveCoexistence({ binder: freeBinder, readConfig: () => config });
  expect(out.mode).toBe('port');
  expect([8900, 8901]).not.toContain(out.port);
  expect(out.avoided.sort()).toEqual([8900, 8901]);
});

test('#2855 AC3 tier-graceful: a missing/malformed config avoids nothing', () => {
  expect(detectHostMcpPorts({ readConfig: () => null })).toEqual([]);
  expect(detectHostMcpPorts({ readConfig: () => 'not-an-object' })).toEqual([]);
  expect(detectHostMcpPorts({ readConfig: () => ({ mcpServers: { x: {} } }) })).toEqual([]);
});

test('#2855 AC3 reads the alternate mcpServers config shape', () => {
  const ports = detectHostMcpPorts({ readConfig: () => ({ mcpServers: { g: { port: 7777 } } }) });
  expect(ports).toEqual([7777]);
});

test('#2855 AC2 pickBoundPort returns the held handle; release is callable', async () => {
  let released = false;
  const binder = (port) => (port === 8901 ? { release: () => { released = true; } } : null);
  const bound = await pickBoundPort([8900, 8901, 8902], [], binder);
  expect(bound.port).toBe(8901);
  bound.handle.release();
  expect(released).toBe(true);
});

test('#2855 default candidate pool is distinct from the dashboard port', () => {
  expect(DEFAULT_CANDIDATES).not.toContain(8090);
  expect(DEFAULT_CANDIDATES.every((port) => Number.isInteger(port))).toBe(true);
});
