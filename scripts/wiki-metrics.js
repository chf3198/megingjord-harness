// Wiki Metrics — track access counts and compute health grade
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const METRICS_FILE = path.join(ROOT, 'logs', 'wiki-metrics.json');

function loadMetrics() {
  try { return JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8')); }
  catch { return { totalAccess: 0, sections: {}, pages: {}, firstSeen: new Date().toISOString() }; }
}

function saveMetrics(m) {
  try {
    const dir = path.dirname(METRICS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(METRICS_FILE, JSON.stringify(m, null, 2));
  } catch { /* non-blocking */ }
}

function recordAccess(section, slug) {
  const m = loadMetrics();
  m.totalAccess = (m.totalAccess || 0) + 1;
  m.sections = m.sections || {};
  m.pages = m.pages || {};
  if (section) m.sections[section] = (m.sections[section] || 0) + 1;
  if (slug) m.pages[slug] = (m.pages[slug] || 0) + 1;
  m.lastAccess = new Date().toISOString();
  saveMetrics(m);
  return m;
}

function computeGrade(health, metrics) {
  if (!health || !health.loaded) return { grade: 'N/A', score: 0, reasons: [] };
  const pages = health.pages || 0;
  if (pages === 0) return { grade: 'F', score: 0, reasons: ['No wiki pages'] };
  const issues = health.issues || 0;
  const issueRatio = issues / pages;
  const accessed = metrics ? (metrics.totalAccess || 0) : 0;
  const reasons = [];
  let score = 100;
  if (issueRatio > 0.5) { score -= 40; reasons.push(`High issue ratio (${issues}/${pages})`); }
  else if (issueRatio > 0.2) { score -= 20; reasons.push(`Moderate issues (${issues})`); }
  if (health.broken?.length > 0) { score -= 10; reasons.push(`${health.broken.length} broken links`); }
  if (health.orphans?.length > pages * 0.3) { score -= 10; reasons.push(`${health.orphans.length} orphan pages`); }
  if (accessed === 0) { score -= 15; reasons.push('No usage recorded yet'); }
  else if (accessed > 50) { score += 5; reasons.push(`Active usage (${accessed} accesses)`); }
  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { grade, score, reasons };
}

function getWikiMetrics(health) {
  const m = loadMetrics();
  const gradeInfo = computeGrade(health, m);
  return { ...m, grade: gradeInfo.grade, score: gradeInfo.score, gradeReasons: gradeInfo.reasons };
}

module.exports = { recordAccess, getWikiMetrics };
