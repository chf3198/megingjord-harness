// Wiki Metrics — track access counts and compute health grade.
// #1682: page-level telemetry fix + atomic write + Epic #1942 forward-compat
// (wikiType discriminator defaults to 'wisdom' for current Karpathy Wiki).
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const METRICS_FILE = path.join(ROOT, 'logs', 'wiki-metrics.json');
const TMP_SUFFIX = '.tmp';
const DEFAULT_WIKI_TYPE = 'wisdom';

function loadMetrics(file = METRICS_FILE) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return { totalAccess: 0, sections: {}, pages: {}, pagesByType: {}, firstSeen: new Date().toISOString() }; }
}

function saveMetrics(m, file = METRICS_FILE) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + TMP_SUFFIX + '.' + process.pid + '.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(m, null, 2));
    fs.renameSync(tmp, file);
  } catch { /* non-blocking */ }
}

function recordAccess(section, slug, opts = {}) {
  const file = opts.file || METRICS_FILE;
  const wikiType = opts.wikiType || DEFAULT_WIKI_TYPE;
  const slugs = Array.isArray(slug) ? slug : (slug ? [slug] : []);
  const m = loadMetrics(file);
  m.totalAccess = (m.totalAccess || 0) + 1;
  m.sections = m.sections || {};
  m.pages = m.pages || {};
  m.pagesByType = m.pagesByType || {};
  m.pagesByType[wikiType] = m.pagesByType[wikiType] || {};
  if (section) m.sections[section] = (m.sections[section] || 0) + 1;
  for (const oneSlug of slugs) {
    if (oneSlug && typeof oneSlug === 'string') {
      m.pages[oneSlug] = (m.pages[oneSlug] || 0) + 1;
      m.pagesByType[wikiType][oneSlug] = (m.pagesByType[wikiType][oneSlug] || 0) + 1;
    }
  }
  m.lastAccess = new Date().toISOString();
  saveMetrics(m, file);
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

function getWikiMetrics(health, opts = {}) {
  const m = loadMetrics(opts.file);
  const gradeInfo = computeGrade(health, m);
  return { ...m, grade: gradeInfo.grade, score: gradeInfo.score, gradeReasons: gradeInfo.reasons };
}

function getTopPages(metrics, n = 5, wikiType) {
  if (!metrics) return [];
  const source = wikiType ? ((metrics.pagesByType || {})[wikiType] || {}) : (metrics.pages || {});
  return Object.entries(source).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([slug, count]) => ({ slug, count }));
}

module.exports = { recordAccess, getWikiMetrics, loadMetrics, saveMetrics,
  computeGrade, getTopPages, METRICS_FILE, DEFAULT_WIKI_TYPE };
