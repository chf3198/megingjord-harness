#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const cfgPath = path.join(os.homedir(), '.copilot', 'hooks', 'repo-scope.json');

function loadCfg() {
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return { default_enabled: false, enabled_repos: [] };
  }
}

function saveCfg(cfg) {
  fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
}

function norm(p) { return path.resolve(p); }

function main() {
  const [cmd, arg] = process.argv.slice(2);
  const cfg = loadCfg();
  cfg.enabled_repos = Array.isArray(cfg.enabled_repos) ? cfg.enabled_repos : [];

  if (cmd === 'list') {
    console.log(JSON.stringify(cfg, null, 2));
    return;
  }
  if (cmd === 'enable') {
    if (!arg) throw new Error('Missing repo path. Usage: repo-scope enable /abs/path');
    const p = norm(arg);
    if (!cfg.enabled_repos.includes(p)) cfg.enabled_repos.push(p);
    saveCfg(cfg);
    console.log(`Enabled workflow for: ${p}`);
    return;
  }
  if (cmd === 'disable') {
    if (!arg) throw new Error('Missing repo path. Usage: repo-scope disable /abs/path');
    const p = norm(arg);
    cfg.enabled_repos = cfg.enabled_repos.filter((x) => x !== p);
    saveCfg(cfg);
    console.log(`Disabled workflow for: ${p}`);
    return;
  }
  if (cmd === 'default-on' || cmd === 'default-off') {
    cfg.default_enabled = cmd === 'default-on';
    saveCfg(cfg);
    console.log(`Default set to: ${cfg.default_enabled}`);
    return;
  }

  console.log('Usage: repo-scope <list|enable|disable|default-on|default-off> [repoPath]');
  process.exit(2);
}

try { main(); } catch (err) {
  console.error(err.message);
  process.exit(1);
}
