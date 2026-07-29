'use strict';
// Lane-selection guidance (Epic #3576 W-B, E2). Recommends the lightest adequate lane from
// diff size / touched paths / risk labels — the Manager lane-SELECTION gap (validators are
// already lane-aware). Advisory guidance, not enforcement. Returns a lane-enum value.
const RISK_LABELS = ['area:hooks', 'area:infra', 'security', 'lane:security-surface', 'priority:P1'];
const CONFIG_PATH_RE = /\.(json|ya?ml|toml|ini)$|(^|\/)config\//i;
const TRIVIAL_PATH_RE = /\.(md|txt)$|(^|\/)(README|CHANGELOG)|package-lock\.json$/i;

function recommendLane(input = {}) {
  const diffLines = Number(input.diffLines) || 0;
  const paths = Array.isArray(input.touchedPaths) ? input.touchedPaths : [];
  const risky = (Array.isArray(input.riskLabels) ? input.riskLabels : [])
    .some((label) => RISK_LABELS.includes(label));
  if (risky || diffLines > 100 || paths.length > 3 || paths.length === 0) return 'lane:code-change';
  if (paths.every((p) => TRIVIAL_PATH_RE.test(p)) && diffLines <= 20) return 'lane:trivial';
  if (paths.every((p) => CONFIG_PATH_RE.test(p)) && diffLines <= 30) return 'lane:config-only';
  return 'lane:code-change';
}

module.exports = { recommendLane, RISK_LABELS };
