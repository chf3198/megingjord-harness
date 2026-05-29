const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const KNOWN = ['claude-code', 'codex', 'copilot', 'antigravity'];
const TARGET = (process.env.ORCHESTRATOR ? [process.env.ORCHESTRATOR] : KNOWN);

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function loadText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const SURFACES = {
  'signer-registry': (orch) => {
    const reg = loadJson('inventory/team-model-signatures.json');
    const hit = (reg.registry || []).find((e) => e.team === orch);
    return { recognized: !!hit, evidence: hit ? `registry aliasSeed=${hit.aliasSeed}` : 'no registry entry' };
  },
  'routing-runtimeKinds': (orch) => {
    const adapters = loadJson('scripts/global/routing-provider-adapters.json');
    const present = (adapters.runtimeKinds || []).includes(orch);
    return { recognized: present, evidence: `runtimeKinds=${JSON.stringify(adapters.runtimeKinds)}` };
  },
  'deploy-target': (orch) => {
    const sh = loadText('scripts/deploy.sh');
    const target = orch === 'claude-code' ? 'claude' : orch;
    const present = new RegExp(`\\|${target}\\|`).test(sh) || new RegExp(`\\(${target}\\|`).test(sh) || new RegExp(`\\|${target}\\)`).test(sh);
    return { recognized: present, evidence: present ? `target "${target}" in regex` : 'absent from target regex' };
  },
  'plugin-manifest': (orch) => {
    const js = loadText('scripts/validate-plugin-compat.js');
    const candidate = orch === 'antigravity' ? '.antigravity-plugin' : orch === 'claude-code' ? '.claude-plugin' : orch === 'copilot' ? '.github/plugin' : null;
    if (!candidate) return { applicable: false, recognized: null, evidence: 'orchestrator has no canonical plugin convention; surface not applicable' };
    const present = js.includes(`${candidate}/plugin.json`);
    return { applicable: true, recognized: present, evidence: present ? `${candidate}/plugin.json in validator` : `${candidate} not in validator paths` };
  },
  'dashboard-vendor': (orch) => {
    const js = loadText('dashboard/js/multi-agent-sessions.js');
    const key = orch === 'claude-code' ? 'claude' : orch;
    const inIcons = new RegExp(`${key}:\\s*['"]`).test(js);
    return { recognized: inIcons, evidence: inIcons ? `VENDOR_ICONS["${key}"] present` : `VENDOR_ICONS["${key}"] absent` };
  },
  'parity-inventory': (orch) => {
    const inv = loadJson('inventory/orchestrator-governance-parity.json');
    const present = (inv.runtimes || []).includes(orch);
    return { recognized: present, evidence: `runtimes=${JSON.stringify(inv.runtimes)}` };
  },
};

const report = {};
for (const orchestrator of TARGET) {
  test(`orchestrator: ${orchestrator}`, async (t) => {
    report[orchestrator] = {};
    for (const [name, check] of Object.entries(SURFACES)) {
      const result = check(orchestrator);
      report[orchestrator][name] = result;
      await t.test(`${orchestrator} × ${name}`, () => {
        if (result.applicable === false) {
          // Surface intentionally does not apply to this orchestrator
          return;
        }
        assert.ok(result.recognized,
          `${orchestrator} not recognized at ${name}: ${result.evidence}`);
      });
    }
  });
}

test('parity matrix exported to ~/.megingjord/', () => {
  const outDir = path.join(os.homedir(), '.megingjord');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `orchestrator-parity-${process.env.PARITY_TS || 'latest'}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  assert.ok(fs.existsSync(outFile));
});
