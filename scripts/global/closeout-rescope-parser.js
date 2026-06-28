'use strict';
// Refs #1289/#3319 — Epic acceptance-criterion parser consumed by the AC reconciler.
// Scoped to parseEpicAcs for the #3319 re-land; the full EPIC_RESCOPE block parser
// (parseRescopeBlocks) belongs to the closeout-lint wave, re-scoped out of #3319.

function parseEpicAcs(body) {
  const acs = [];
  const lines = (body || '').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[([ xX])\]\s*\*\*?(AC\d+)\*\*?[:\s]/);
    if (match) acs.push({ id: match[2], checked: match[1].toLowerCase() === 'x' });
  }
  return acs;
}

module.exports = { parseEpicAcs };
