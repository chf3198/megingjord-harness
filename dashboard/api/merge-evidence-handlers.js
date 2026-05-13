'use strict';
// merge-evidence-handlers — Epic #1486 Phase-1d. Serves the snapshot file
// written by `npm run merge-evidence:snapshot` to the dashboard. Returns
// staleness signal when the snapshot is older than 24h so operators know
// to refresh. No live gh CLI calls from the dashboard server (keeps the
// request path fast and free of auth dependencies).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SNAPSHOT_PATH = path.join(os.homedir(), '.megingjord', 'merge-evidence-snapshot.json');
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

function readSnapshot(snapshotPath = SNAPSHOT_PATH, nowMs = Date.now()) {
  if (!fs.existsSync(snapshotPath)) {
    return {
      status: 'absent',
      snapshot_path: snapshotPath,
      instruction: 'Run `npm run merge-evidence:snapshot` to populate.',
    };
  }
  let snapshot;
  try { snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')); }
  catch (err) { return { status: 'malformed', snapshot_path: snapshotPath, error: err.message }; }
  const generatedAt = Date.parse(snapshot.generated_at || 0);
  const ageMs = nowMs - generatedAt;
  return {
    status: ageMs > STALE_AFTER_MS ? 'stale' : 'fresh',
    age_ms: ageMs,
    snapshot,
  };
}

function handleMergeEvidenceStats(_request, response) {
  const result = readSnapshot();
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(result));
}

module.exports = {
  route: '/api/merge-evidence-stats',
  handleMergeEvidenceStats, readSnapshot,
  SNAPSHOT_PATH, STALE_AFTER_MS,
};
