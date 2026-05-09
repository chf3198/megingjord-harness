#!/usr/bin/env node
'use strict';
// actuator-engine (#1258 / Epic #1113 AC4) — invokes 7 pure-function actuators per Phase-0 §3.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DEFAULT_STORE = path.join(os.homedir(), '.megingjord', 'goal-tier-state.json');
const TIERS = ['B', 'B+', 'B++', 'B+++', 'B++++'];
const A1_THRESHOLDS = [0.80, 0.65, 0.50, 0.35];

const INITIAL_STATE = {
  ghs_7d: null, ghs_history: [],
  actuators: {
    A1: { tier: 'B', escalated_at: null, deescalation_eligible_at: null },
    A2: { level: 'advisory', escalated_at: null, deescalation_eligible_at: null },
    A3: { handoff_block_required: false, escalated_at: null, deescalation_eligible_at: null },
    A4: { consultant_mandatory: false, escalated_at: null, deescalation_eligible_at: null },
    A5: { operator_notification: false, escalated_at: null, deescalation_eligible_at: null },
    A6: { session_reminder: false, escalated_at: null, deescalation_eligible_at: null },
    A7: { anneal_auto_trigger: false, escalated_at: null, deescalation_eligible_at: null },
  },
};

function tierForGHS(ghs) {
  for (let i = 0; i < A1_THRESHOLDS.length; i += 1) {
    if (ghs < A1_THRESHOLDS[i]) continue;
    return TIERS[i === 0 ? 0 : i];
  }
  return TIERS[TIERS.length - 1];
}

function escalate(prev, now) {
  return { ...prev, escalated_at: prev.escalated_at || new Date(now).toISOString() };
}

const actuators = {
  A1: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A1) || INITIAL_STATE.actuators.A1;
    if (ghs === null) return prev;
    let tier = TIERS[0];
    for (let i = 0; i < A1_THRESHOLDS.length; i += 1) if (ghs < A1_THRESHOLDS[i]) tier = TIERS[i + 1];
    return { ...escalate(prev, now), tier };
  },
  A2: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A2) || INITIAL_STATE.actuators.A2;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), level: ghs < 0.70 ? 'required' : 'advisory' };
  },
  A3: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A3) || INITIAL_STATE.actuators.A3;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), handoff_block_required: ghs < 0.65 };
  },
  A4: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A4) || INITIAL_STATE.actuators.A4;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), consultant_mandatory: ghs < 0.55 };
  },
  A5: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A5) || INITIAL_STATE.actuators.A5;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), operator_notification: ghs < 0.60 };
  },
  A6: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A6) || INITIAL_STATE.actuators.A6;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), session_reminder: ghs < 0.75 };
  },
  A7: ({ ghs, prevState, now }) => {
    const prev = (prevState && prevState.A7) || INITIAL_STATE.actuators.A7;
    if (ghs === null) return prev;
    return { ...escalate(prev, now), anneal_auto_trigger: ghs < 0.45 };
  },
};

function loadState(storeFile) {
  if (!fs.existsSync(storeFile)) return JSON.parse(JSON.stringify(INITIAL_STATE));
  try { return JSON.parse(fs.readFileSync(storeFile, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(INITIAL_STATE)); }
}

function runEngine({ ghs, sensors = {}, now = Date.now() }, storeFile = DEFAULT_STORE) {
  const prev = loadState(storeFile);
  const newActuators = {};
  for (const key of Object.keys(actuators)) newActuators[key] = actuators[key]({ ghs, prevState: prev.actuators, sensors, now });
  const next = { ghs_7d: ghs, ghs_history: [...(prev.ghs_history || []), { ts: new Date(now).toISOString(), value: ghs }],
    actuators: newActuators };
  fs.mkdirSync(path.dirname(storeFile), { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(next, null, 2));
  return next;
}

if (require.main === module) {
  const ghs = Number(process.argv[2]);
  console.log(JSON.stringify(runEngine({ ghs: Number.isFinite(ghs) ? ghs : null }), null, 2));
}

module.exports = { actuators, runEngine, INITIAL_STATE, tierForGHS, TIERS, A1_THRESHOLDS, DEFAULT_STORE };
