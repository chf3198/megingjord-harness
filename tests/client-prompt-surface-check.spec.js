// tdd-pyramid unit suite for the client-prompt-surface registry validator (#3404, Epic #3392 AC3).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const V = require('../scripts/global/megalint/client-prompt-surface-check');

const REGISTRY = {
  carve_outs: [{ id: 'security-policy-weakening', class: 'security-weakening' }],
  sanctioned_ask_surfaces: [
    { file: 'hooks/scripts/pretool_guard.py', marker: 'Direct ungoverned hook-script mutation', carve_out: 'security-policy-weakening' },
    { file: 'hooks/scripts/pretool_guard.py', marker: 'Sensitive (tracked/committable) secret-file path', carve_out: 'security-policy-weakening' },
  ],
};

/** Write a fake hook file under a temp cwd and return { cwd, rel }. */
function fixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-'));
  const rel = 'hooks/scripts/fake_hook.py';
  fs.mkdirSync(path.join(dir, 'hooks', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
  return { cwd: dir, rel };
}

test('registeredSurfaces returns the registry markers', () => {
  assert.deepEqual(V.registeredSurfaces(REGISTRY), [
    'Direct ungoverned hook-script mutation', 'Sensitive (tracked/committable) secret-file path',
  ]);
});

test('a registered ask surface produces no violation', () => {
  const { cwd, rel } = fixture('return emit("ask", "Direct ungoverned hook-script mutation detected. Manual approval.")');
  const out = V.findUnregisteredAsks([rel], { registry: REGISTRY, cwd });
  assert.equal(out.length, 0);
});

test('a NEW unregistered ask surface is flagged', () => {
  const { cwd, rel } = fixture('return emit("ask", "Brand new prompt that nobody registered. Confirm intentional.")');
  const out = V.findUnregisteredAsks([rel], { registry: REGISTRY, cwd });
  assert.equal(out.length, 1);
  assert.match(out[0].reason, /Brand new prompt/);
});

test('mixed: registered passes, unregistered flagged', () => {
  const { cwd, rel } = fixture([
    'emit("ask", "Direct ungoverned hook-script mutation X")',
    'emit("ask", "Some unregistered surface Y")',
  ].join('\n'));
  const out = V.findUnregisteredAsks([rel], { registry: REGISTRY, cwd });
  assert.equal(out.length, 1);
  assert.match(out[0].reason, /unregistered surface Y/);
});

test('single-quoted emit and deny are handled (deny ignored)', () => {
  const { cwd, rel } = fixture("emit('ask', 'Sensitive (tracked/committable) secret-file path Z')\nemit('deny', 'blocked something')");
  const out = V.findUnregisteredAsks([rel], { registry: REGISTRY, cwd });
  assert.equal(out.length, 0); // the ask is registered; the deny is not a client prompt
});

test('validate() ships advisory severity', () => {
  const { cwd, rel } = fixture('emit("ask", "Unregistered surface")');
  const r = V.validate({ files: [rel], registry: REGISTRY, cwd });
  assert.equal(r.advisory, true);
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].severity, 'advisory');
  assert.equal(r.violations[0].rule, 'unregistered-client-prompt-surface');
});

test('validate() is clean when all surfaces are registered', () => {
  const { cwd, rel } = fixture('emit("ask", "Direct ungoverned hook-script mutation")');
  const r = V.validate({ files: [rel], registry: REGISTRY, cwd });
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

test('fail-open: a missing scan file yields no violation, never throws', () => {
  const r = V.validate({ files: ['hooks/scripts/does-not-exist.py'], registry: REGISTRY, cwd: os.tmpdir() });
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

test('loadRegistry fail-opens to an empty registry on a bad path', () => {
  const reg = V.loadRegistry('/nonexistent/registry.json');
  assert.deepEqual(reg.sanctioned_ask_surfaces, []);
});

test('the shipped registry parses and lists S6 + S7', () => {
  const reg = V.loadRegistry(); // the real config/retained-human-touchpoints.json
  const markers = V.registeredSurfaces(reg);
  assert.ok(markers.some((m) => /hook-script mutation/.test(m)));
  assert.ok(markers.some((m) => /secret-file path/.test(m)));
  assert.equal(reg.carve_outs.length, 4);
});
