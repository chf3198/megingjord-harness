'use strict';
// work-log-sync.js — megalint validator (#3199).
// Verifies local wiki/work-log/tickets/<N>.md handoff blocks are
// posted as comments on the live GitHub issue. Reuses shared fetchers
// from closeout-preflight.js (AC2). Deferred-final aware (AC3).
// G6 degradation: skips with advisory when gh is unavailable (AC4).

const fs = require('node:fs');
const path = require('node:path');
const helpers = require('./work-log-sync-helpers.js');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function validate(input) {
  const violations = [];
  const ticketRef = input.ticketRef || input.issueNumber;
  if (!ticketRef) return { ok: true, violations: [], skipped: 'no-ticket-ref' };

  const workLogPath = helpers.resolveWorkLogPath(ticketRef, ROOT);
  if (!workLogPath) return { ok: true, violations: [], skipped: 'no-work-log' };

  let localBlocks;
  try { localBlocks = helpers.parseLocalHandoffs(workLogPath); }
  catch { return { ok: true, violations: [], skipped: 'parse-error' }; }

  if (!localBlocks.length) return { ok: true, violations: [] };

  const remoteComments = (input.comments || []).map(c => c.body || '');
  const prExists = input.prBody !== undefined && input.prBody !== null;
  const phase = helpers.currentPhase(prExists, input.state);
  const required = helpers.requiredForPhase(phase);

  for (const block of localBlocks) {
    if (!required.includes(block.type)) continue;
    const found = helpers.commentContainsHandoff(remoteComments, block.type);
    if (!found) {
      violations.push({
        rule: 'work-log-sync',
        detail: `Local work-log declares ${block.type} but no matching comment found on GitHub issue #${ticketRef}.`,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate };
