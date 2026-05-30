const test = require('node:test');
const assert = require('node:assert');
const { renderSynthesisPanel, renderSynthesisRun, formatPValue } = require('../dashboard/js/synthesis-panel.js');

test('renderSynthesisPanel returns empty state when no runs', () => {
  const html = renderSynthesisPanel({ runs: [] });
  assert.match(html, /No active cross-team R&D synthesis runs/);
});

test('renderSynthesisPanel renders single run', () => {
  const html = renderSynthesisPanel({ runs: [{
    rdN: 1112, admin: 'cc', phase: 'Phase-D', wave: 2,
    elapsedHours: 4.5, remainingHours: 19.5, latestKsPvalue: 0.03,
    totalWavesObserved: 3,
  }]});
  assert.match(html, /Epic #1112/);
  assert.match(html, /Phase-D/);
  assert.match(html, /admin: cc/);
  assert.match(html, /Wave 2/);
  assert.match(html, /4\.5h elapsed/);
});

test('renderSynthesisPanel renders multiple runs', () => {
  const html = renderSynthesisPanel({ runs: [
    { rdN: 1112, admin: 'cc', phase: 'Phase-D', wave: 2 },
    { rdN: 2398, admin: 'ag', phase: 'Phase-R', wave: 1 },
  ]});
  assert.match(html, /Epic #1112/);
  assert.match(html, /Epic #2398/);
});

test('formatPValue handles null + small + normal values', () => {
  assert.strictEqual(formatPValue(null), 'n/a');
  assert.strictEqual(formatPValue(undefined), 'n/a');
  assert.strictEqual(formatPValue(0.0001), '< 0.001');
  assert.strictEqual(formatPValue(0.05), '0.050');
  assert.strictEqual(formatPValue(0.5), '0.500');
});

test('renderSynthesisRun applies phase-specific badge class', () => {
  const phaseR = renderSynthesisRun({ rdN: 1, phase: 'Phase-R' });
  assert.match(phaseR, /badge-progress/);
  const phaseD = renderSynthesisRun({ rdN: 1, phase: 'Phase-D' });
  assert.match(phaseD, /badge-active/);
  const unknown = renderSynthesisRun({ rdN: 1, phase: 'Mystery' });
  assert.match(unknown, /badge-default/);
});

test('renderSynthesisRun uses agent-class for admin styling', () => {
  const html = renderSynthesisRun({ rdN: 1, admin: 'ag' });
  assert.match(html, /agent-ag/);
});
