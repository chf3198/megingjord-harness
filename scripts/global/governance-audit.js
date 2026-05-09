#!/usr/bin/env node
// governance-audit.js — Productized Manager-side ticket audit (#837).
// Composes deterministic governance checks + optional fleet-LLM ticket review.
// Output: /tmp/governance-audit.json + 1-line stdout summary.
'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPORT_FILE = '/tmp/governance-audit.json';
const HAMR = (() => { try { return require('./hamr-provider-wrapper'); } catch { return null; } })();
const CHECKS = ['governance:drift', 'governance:verify', 'governance:reconcile', 'governance:worktrees'];
const TIMEOUT_MS = 60_000;
const RAW_PREVIEW_MAX = 500;
const ERR_PREVIEW_MAX = 300;
const TICKET_FETCH_LIMIT = 200;

function runCheck(name) {
  try {
    const out = execSync(`npm run --silent ${name}`, { encoding: 'utf8', timeout: TIMEOUT_MS });
    let parsed = null;
    try { parsed = JSON.parse(out); } catch { parsed = { raw: out.slice(0, RAW_PREVIEW_MAX) }; }
    return { name, ok: true, result: parsed };
  } catch (err) {
    return { name, ok: false, error: err.message.slice(0, ERR_PREVIEW_MAX) };
  }
}

function listOpenTickets() {
  try {
    const cmd = `gh issue list --state open --limit ${TICKET_FETCH_LIMIT} --json number,title,labels --jq ".[] | {number, title, labels: [.labels[].name]}"`;
    const out = execSync(cmd, { encoding: 'utf8', timeout: TIMEOUT_MS });
    return out.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch (err) { return []; }
}

function detectViolations(tickets) {
  const violations = [];
  for (const ticket of tickets) {
    const labels = ticket.labels || [];
    const status = labels.find(l => l.startsWith('status:')) || null;
    const roles = labels.filter(l => l.startsWith('role:'));
    const isEpic = labels.includes('type:epic');
    if (status === 'status:backlog' && roles.length > 0 && !isEpic) {
      violations.push({ ticket: ticket.number, rule: 'Rule 4', detail: `non-Epic backlog with ${roles.join(',')}` });
    }
    if (status === 'status:in-progress' && !labels.includes('role:collaborator') && !isEpic) {
      violations.push({ ticket: ticket.number, rule: 'Rule 8', detail: 'in-progress missing role:collaborator' });
    }
    if (isEpic && status === 'status:backlog' && !labels.includes('role:manager')) {
      violations.push({ ticket: ticket.number, rule: 'Rule E2', detail: 'Epic backlog missing role:manager' });
    }
  }
  return violations;
}

async function audit(opts = {}) {
  const startedAt = new Date().toISOString();
  const checks = CHECKS.map(runCheck);
  const tickets = listOpenTickets();
  const violations = detectViolations(tickets);
  let hamrSensor = null;
  try { hamrSensor = require('./hamr-utilization-sensor').compute(); } catch { /* sensor optional */ }
  if (hamrSensor && hamrSensor.status === 'violation') {
    violations.push({ ticket: 'HAMR', rule: 'utilization-floor',
      detail: `production_hamr_utilization_rate_7d=${hamrSensor.rate?.toFixed(2)} below floor ${hamrSensor.thresholds.violation}` });
  }
  if (hamrSensor && hamrSensor.status === 'escalation') {
    violations.push({ ticket: 'HAMR', rule: 'utilization-escalation',
      detail: `production_hamr_utilization_rate_7d=${hamrSensor.rate?.toFixed(2)} below escalation ${hamrSensor.thresholds.escalation}` });
  }
  const summary = {
    schema_version: 1,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    checks: checks.map(c => ({ name: c.name, ok: c.ok, error: c.error || null })),
    open_tickets: tickets.length,
    violations,
    hamr_utilization: hamrSensor,
    overall: violations.length === 0 && checks.every(c => c.ok) ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(REPORT_FILE, JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  audit().then(s => {
    const status = s.overall;
    const failed = s.checks.filter(c => !c.ok).length;
    console.log(`governance-audit: ${status} | open=${s.open_tickets} violations=${s.violations.length} failed-checks=${failed} → ${REPORT_FILE}`);
    if (s.violations.length) {
      const MAX_PRINTED = 10;
      for (const violation of s.violations.slice(0, MAX_PRINTED)) {
        console.log(`  ! #${violation.ticket} ${violation.rule}: ${violation.detail}`);
      }
    }
    process.exit(status === 'PASS' ? 0 : 1);
  }).catch(err => { console.error('governance-audit error:', err.message); process.exit(2); });
}

module.exports = { audit, runCheck, listOpenTickets, detectViolations, REPORT_FILE, CHECKS };
