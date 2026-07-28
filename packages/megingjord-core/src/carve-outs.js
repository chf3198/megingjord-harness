'use strict';
// Carve-out classifier — mirrors the 4 retained human touchpoints
// (config/retained-human-touchpoints.json). Narrow, bias-to-catch; the
// authoritative enforcement stays in hooks/scripts/ask_reference_monitor.py.
const PATTERNS = [
  // security-weakening FIRST (highest-consequence; never auto-resolved)
  ['security-weakening', /\b(disable|bypass|weaken|turn\s+off|remove|loosen)\b[^.]{0,40}\b(gate|guard|check|validator|control|protection|auth|permission)\b/i],
  ['security-weakening', /\b(grant|broaden|escalate)\b[^.]{0,30}\b(permission|privilege|scope|access)\b/i],
  // irreversible / outward-facing
  ['irreversible', /\b(publish|deploy\s+to\s+prod|release\s+to|go[-\s]?live|delete\s+permanently|force[-\s]?push|send\s+to|make\s+public)\b/i],
  ['irreversible', /\b(vsce|ovsx)\s+publish\b|\bmarketplace\s+publish\b/i],
  // design direction
  ['design', /\b(design\s+direction|architecture\s+decision|which\s+approach|product\s+(?:direction|decision)|go\/no-?go|scope\s+expansion)\b/i],
  // UAT / visual confirmation
  ['uat', /\b(does\s+(?:this|it)\s+(?:look|match)|visual(?:ly)?\s+confirm|is\s+this\s+what\s+you\s+(?:expected|wanted)|uat)\b/i],
];

/** @param {string} text @returns {import('../index').CarveOutResult} */
function classifyCarveOut(text) {
  const t = String(text || '');
  for (const [cls, re] of PATTERNS) {
    if (re.test(t)) return { isCarveOut: true, class: cls };
  }
  return { isCarveOut: false, class: null };
}

module.exports = { PATTERNS, classifyCarveOut };
