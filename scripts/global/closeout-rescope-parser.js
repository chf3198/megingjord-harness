'use strict';
// Refs #1287 — EPIC_RESCOPE block parser per Epic #1271 AC7 schema.
// Per instructions/epic-governance.instructions.md "EPIC_RESCOPE artifact schema".

const REASON_ENUM = new Set([
  'structural-measurement-window',
  'dependent-on-producer',
  'scope-cut-to-followon',
  'external-blocker',
  'other',
]);

function parseEpicAcs(body) {
  const acs = [];
  const lines = (body || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*\*\*?(AC\d+)\*\*?[:\s]/);
    if (m) acs.push({ id: m[2], checked: m[1].toLowerCase() === 'x' });
  }
  return acs;
}

function parseListField(value) {
  if (!value) return [];
  const trimmed = value.trim();
  const inner = trimmed.replace(/^\[/, '').replace(/\]$/, '');
  if (!inner) return [];
  return inner.split(',').map(s => s.trim()).filter(Boolean);
}

function parseRescopeBlocks(text) {
  const blocks = [];
  const blockRe = /EPIC_RESCOPE\b([\s\S]*?)(?=EPIC_RESCOPE|$)/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const body = m[1];
    const block = { errors: [] };
    const get = (key) => {
      const fieldRe = new RegExp('^\\s*' + key + ':\\s*(.+?)\\s*$', 'm');
      const mm = body.match(fieldRe);
      return mm ? mm[1] : null;
    };
    block.deferred_acs = parseListField(get('deferred_acs'));
    block.re_evaluate_by = get('re_evaluate_by');
    block.follow_on_tickets = parseListField(get('follow_on_tickets'));
    block.ruleset_bypass_actor = get('ruleset_bypass_actor');
    block.ruleset_bypass_reason = get('ruleset_bypass_reason');
    block.signed_by = get('signed_by');
    block.role = get('Role');
    block.team_model = (body.match(/Team&Model:\s*(\S+)/) || [])[1] || null;

    const reasonsBlock = body.match(/deferred_reason_per_ac:\s*\n([\s\S]*?)(?:\n[a-z_]+:|\n*$)/);
    block.deferred_reason_per_ac = {};
    if (reasonsBlock) {
      const reasonLines = reasonsBlock[1].split(/\r?\n/);
      for (const rl of reasonLines) {
        const rm = rl.match(/^\s+(\S+):\s*(.+?)\s*$/);
        if (rm) block.deferred_reason_per_ac[rm[1]] = rm[2];
      }
    }

    if (!block.deferred_acs.length) block.errors.push('deferred_acs is empty');
    for (const ac of block.deferred_acs) {
      const reason = block.deferred_reason_per_ac[ac];
      if (!reason) block.errors.push(`AC ${ac} missing deferred_reason_per_ac entry`);
      else if (!REASON_ENUM.has(reason)) block.errors.push(`AC ${ac} reason "${reason}" not in enum`);
      if (reason === 'structural-measurement-window' && !block.re_evaluate_by) {
        block.errors.push(`AC ${ac} requires re_evaluate_by (structural-measurement-window)`);
      }
    }
    if (block.signed_by && /manager/i.test(block.role || '')) {
      block.errors.push('EPIC_RESCOPE signed by manager — Consultant signature required');
    }
    blocks.push(block);
  }
  return blocks;
}

module.exports = { parseEpicAcs, parseRescopeBlocks, REASON_ENUM };
