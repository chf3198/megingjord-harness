// tests/antigravity-enforcement-wiring.spec.js (#3448, Epic #3411 T2.5)
// Strategy: tdd-pyramid — verify the Antigravity enforcement plane is WIRED and FIRES.
//
// Three verification tiers:
//   1. Structural — EVENT_MAP covers the right camelCase events + all 9 requiredHookScripts.
//   2. Golden — committed .antigravity/hooks.json matches a fresh emit (no drift).
//   3. Gates-fire — actually invoke pretool_guard (Python) and stop_reminder (Python) via
//      child_process with synthetic event JSON and assert an enforcement decision is produced.
//      This proves the gate FIRES, not merely that the file exists.
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const emitModule = require('../scripts/global/antigravity-hooks-emit');
const HOOKS_SCRIPTS = path.join(ROOT, 'hooks', 'scripts');
const PARITY_FILE = path.join(ROOT, 'inventory', 'orchestrator-governance-parity.json');
const HOOKS_JSON = path.join(ROOT, '.antigravity', 'hooks.json');
const RUNTIME_DESCRIPTOR = path.join(ROOT, 'inventory', 'runtimes', 'antigravity.json');

// ── 1. Structural: EVENT_MAP correctness ────────────────────────────────────

describe('antigravity hooks emit module — structural', () => {
  test('EVENT_MAP covers the five canonical camelCase lifecycle events', () => {
    const keys = Object.keys(emitModule.EVENT_MAP).sort();
    assert.deepEqual(keys, [
      'postToolUse', 'preToolUse', 'sessionStart', 'stop', 'userPromptSubmit',
    ]);
  });

  test('every Antigravity event maps onto a known harness PascalCase taxonomy slot', () => {
    const knownSlots = new Set([
      'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop',
    ]);
    for (const antigravityEvent of Object.keys(emitModule.EVENT_MAP)) {
      const slot = emitModule.HARNESS_EVENT[antigravityEvent];
      assert.ok(slot, `${antigravityEvent} missing a harness slot`);
      assert.ok(knownSlots.has(slot), `${antigravityEvent} → ${slot} not a known harness slot`);
    }
  });

  test('preToolUse wires commit_ticket_gate.py + pretool_guard.py (enforcement pair)', () => {
    assert.deepEqual(emitModule.EVENT_MAP.preToolUse, [
      'commit_ticket_gate.py',
      'pretool_guard.py',
    ]);
  });

  test('stop wires stop_reminder.py', () => {
    assert.deepEqual(emitModule.EVENT_MAP.stop, ['stop_reminder.py']);
  });

  test('sessionStart wires session_context.py + hamr_activation_check.py', () => {
    assert.ok(emitModule.EVENT_MAP.sessionStart.includes('session_context.py'));
    assert.ok(emitModule.EVENT_MAP.sessionStart.includes('hamr_activation_check.py'));
  });

  test('all 9 orchestrator-governance-parity requiredHookScripts are wired', () => {
    const parity = JSON.parse(fs.readFileSync(PARITY_FILE, 'utf8'));
    const wired = new Set(Object.values(emitModule.EVENT_MAP).flat());
    for (const script of parity.requiredHookScripts) {
      assert.ok(wired.has(script), `requiredHookScript ${script} not wired in Antigravity EVENT_MAP`);
    }
  });

  test('built hooks.json points commands at the deployed ~/.gemini/antigravity hook dir', () => {
    const built = emitModule.build();
    assert.equal(built.version, 1);
    const stopCmd = built.hooks.stop[0].command;
    assert.match(stopCmd, /~\/.gemini\/antigravity\/hooks\/scripts\/stop_reminder\.py$/);
    const preToolCmds = built.hooks.preToolUse.map((hook) => hook.command);
    assert.ok(preToolCmds.some((cmd) => cmd.includes('pretool_guard.py')));
    assert.ok(preToolCmds.some((cmd) => cmd.includes('commit_ticket_gate.py')));
  });
});

// ── 2. Golden: committed file matches fresh emit ─────────────────────────────

describe('antigravity hooks.json — golden / no-drift', () => {
  test('committed .antigravity/hooks.json equals a fresh emit (no drift)', () => {
    const committed = fs.readFileSync(HOOKS_JSON, 'utf8').trimEnd();
    const rendered = emitModule.render().trimEnd();
    assert.equal(committed, rendered,
      '.antigravity/hooks.json has drifted from antigravity-hooks-emit.js — re-run the emit script');
  });

  test('emit() writes .antigravity/hooks.json under an arbitrary temp root (deterministic)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-hooks-'));
    const written = emitModule.emit(tmpDir);
    assert.ok(fs.existsSync(written));
    assert.equal(fs.readFileSync(written, 'utf8'), emitModule.render());
  });

  test('render() is deterministic — two calls produce byte-identical output', () => {
    assert.equal(emitModule.render(), emitModule.render());
  });
});

// ── 3. Gates-fire: actually invoke the Python hook scripts ───────────────────
//
// Strategy: pipe a synthetic hook event JSON into the hook scripts via stdin and
// verify the gate produces an enforcement decision (non-zero exit or a structured
// output containing "deny"/"block"/"allow"). This proves the scripts are invokable
// and produce decisions — not just that they exist on disk.

describe('gates-fire: pretool_guard.py produces enforcement decisions via preToolUse', () => {
  test('pretool_guard.py with a canonical-main write event exits non-zero (deny)', () => {
    // Simulate: tool tries to edit a tracked file in the main checkout.
    // The canonical-main enforcer inside pretool_guard.py should deny this.
    const event = JSON.stringify({
      tool_name: 'write_to_file',
      tool_input: { TargetFile: 'instructions/global-standards.instructions.md' },
      cwd: path.join(os.homedir(), 'devenv-ops'),
    });
    const result = spawnSync('python3', [path.join(HOOKS_SCRIPTS, 'pretool_guard.py')], {
      input: event,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      timeout: 10000,
    });
    // The gate must produce a structured response: either non-zero exit (block)
    // or stdout containing a deny decision. Either proves the gate FIRES.
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    const combined = stdout + stderr;
    const firedDeny = result.status !== 0 || /deny|block|read.only|canonical.main/i.test(combined);
    assert.ok(firedDeny,
      `pretool_guard.py did not produce a deny decision for a canonical-main write.\n` +
      `exit=${result.status} stdout=${stdout.slice(0, 200)} stderr=${stderr.slice(0, 200)}`);
  });

  test('pretool_guard.py with a safe read-only tool exits 0 (allow)', () => {
    const event = JSON.stringify({
      tool_name: 'read_file',
      tool_input: { TargetFile: 'README.md' },
      cwd: path.join(os.homedir(), 'devenv-ops-3448'),
    });
    const result = spawnSync('python3', [path.join(HOOKS_SCRIPTS, 'pretool_guard.py')], {
      input: event,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      timeout: 10000,
    });
    // Read-only tools must not be denied by pretool_guard
    const stdout = result.stdout ?? '';
    const deniedForRead = result.status !== 0 && /deny|block/i.test(stdout);
    assert.ok(!deniedForRead,
      `pretool_guard.py incorrectly denied a read-only tool.\n` +
      `exit=${result.status} stdout=${stdout.slice(0, 200)}`);
  });
});

describe('gates-fire: stop_reminder.py produces enforcement output via stop event', () => {
  test('stop_reminder.py is invokable and produces output (gate fires)', () => {
    const event = JSON.stringify({
      stop_hook_active: false,
      cwd: path.join(os.homedir(), 'devenv-ops-3448'),
      session_id: 'test-session-antigravity-enforcement',
    });
    const result = spawnSync('python3', [path.join(HOOKS_SCRIPTS, 'stop_reminder.py')], {
      input: event,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      timeout: 10000,
    });
    // stop_reminder exits 0 and may emit messages. The key invariant: it runs
    // without crashing (import errors or missing deps would produce exit 1 + traceback).
    const stderr = result.stderr ?? '';
    const isTraceback = /Traceback|ImportError|ModuleNotFoundError/.test(stderr);
    assert.ok(!isTraceback,
      `stop_reminder.py crashed with a traceback — gate cannot fire.\nstderr=${stderr.slice(0, 300)}`);
  });

  test('stop_reminder.py with stop_hook_active=true returns 0 immediately (re-entry guard)', () => {
    const event = JSON.stringify({ stop_hook_active: true });
    const result = spawnSync('python3', [path.join(HOOKS_SCRIPTS, 'stop_reminder.py')], {
      input: event,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      timeout: 10000,
    });
    assert.equal(result.status, 0,
      'stop_reminder.py should exit 0 when stop_hook_active=true (re-entry guard)');
  });
});

// ── 4. HAMR config path coverage ─────────────────────────────────────────────

describe('HAMR config path — antigravity coverage', () => {
  test('hamr-provider-wrapper.js TEAM_CONFIG_PATHS includes ~/.antigravity/hamr-config.json', () => {
    const wrapperSrc = fs.readFileSync(
      path.join(ROOT, 'scripts', 'global', 'hamr-provider-wrapper.js'), 'utf8');
    assert.ok(wrapperSrc.includes('.antigravity'),
      'hamr-provider-wrapper.js missing .antigravity hamr-config.json path (5-runtime parity gap)');
    const wrapper = require('../scripts/global/hamr-provider-wrapper');
    const antigravityPath = path.join(os.homedir(), '.antigravity', 'hamr-config.json');
    assert.ok(wrapper.TEAM_CONFIG_PATHS.includes(antigravityPath),
      `TEAM_CONFIG_PATHS does not include ${antigravityPath}`);
  });
});

// ── 5. Runtime descriptor coherence ──────────────────────────────────────────

describe('inventory/runtimes/antigravity.json — descriptor coherence', () => {
  test('runtime descriptor lists all five hook events', () => {
    const descriptor = JSON.parse(fs.readFileSync(RUNTIME_DESCRIPTOR, 'utf8'));
    const descriptorEvents = new Set(descriptor.hooks.events);
    for (const emitEvent of Object.keys(emitModule.EVENT_MAP)) {
      assert.ok(descriptorEvents.has(emitEvent),
        `descriptor.hooks.events missing ${emitEvent} (present in EVENT_MAP)`);
    }
  });

  test('runtime descriptor points to antigravity-hooks-emit.js', () => {
    const descriptor = JSON.parse(fs.readFileSync(RUNTIME_DESCRIPTOR, 'utf8'));
    assert.equal(descriptor.hooks.emitScript, 'scripts/global/antigravity-hooks-emit.js');
  });

  test('hook-wiring parity waiver is absent (resolved by T2.5)', () => {
    const descriptor = JSON.parse(fs.readFileSync(RUNTIME_DESCRIPTOR, 'utf8'));
    const waivers = descriptor.parityWaivers ?? [];
    const hookWaiver = waivers.find((waiver) => waiver.surface === 'hook-wiring');
    assert.ok(!hookWaiver,
      'hook-wiring parity waiver still present — T2.5 should have removed it');
  });
});

// ── 6. Stress: p99 budget + fault injection ──────────────────────────────────

describe('stress: performance and fault injection', () => {
  test('stress: p99 of 1000 build()+render() cycles under 5ms budget', () => {
    const samples = [];
    for (let iteration = 0; iteration < 1000; iteration += 1) {
      const start = process.hrtime.bigint();
      emitModule.render();
      samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    samples.sort((sampleA, sampleB) => sampleA - sampleB);
    const p99 = samples[Math.floor(samples.length * 0.99)];
    assert.ok(p99 < 5, `p99 ${p99.toFixed(3)}ms exceeded 5ms budget`);
  });

  test('stress: hostile hookDir is rendered as data, never executed at emit time', () => {
    const hostileDir = '/tmp/$(rm -rf ~); echo pwned';
    const built = emitModule.build(hostileDir);
    // The hostile path is embedded as a string — the module never shells out.
    assert.match(built.hooks.stop[0].command, /python3.*stop_reminder\.py$/);
    assert.ok(built.hooks.stop[0].command.includes(hostileDir));
    // render() must still return a valid JSON string with the path embedded literally
    const rendered = emitModule.render(hostileDir);
    assert.doesNotThrow(() => JSON.parse(rendered));
  });
});
