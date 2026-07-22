'use strict';
// @megingjord/core entry — the versioned MegingjordCoreApi (Epic #2508 AC-R2).
// Exposes governance decisions only; no credentials cross this boundary (G4).
const { createGoalLens } = require('./goal-lens');
const { classifyCarveOut } = require('./carve-outs');

const CONTRACT_VERSION = '0.0.1';

/** @returns {import('../index').MegingjordCoreApi} */
function createCore() {
  const goalLens = createGoalLens();
  return {
    version: CONTRACT_VERSION,
    goalLens,
    classifyCarveOut,
    isRetainedTouchpoint: (text) => classifyCarveOut(text).isCarveOut,
  };
}

module.exports = { createCore, CONTRACT_VERSION };
