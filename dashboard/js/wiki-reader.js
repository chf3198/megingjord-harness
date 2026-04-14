// Wiki Reader — browse research files as categorized wiki
// Uses static manifest since dashboard has no server-side dir listing

const WIKI_MANIFEST = [
  { cat: 'Agent Drift', files: [
    'agent-drift-detection.md', 'agent-drift-governance.md',
    'agent-drift-metrics.md', 'agent-drift-mitigation.md',
    'agent-drift-patterns.md', 'agent-drift-prevention.md',
    'agent-drift-summary.md'
  ]},
  { cat: 'GitHub Governance', files: [
    'github-gov/branch-protection.md', 'github-gov/code-review.md',
    'github-gov/dependency-management.md', 'github-gov/environments.md',
    'github-gov/issue-management.md', 'github-gov/org-policies.md',
    'github-gov/release-management.md', 'github-gov/repository-settings.md',
    'github-gov/rulesets.md', 'github-gov/security-features.md'
  ]},
  { cat: 'Copilot Governance', files: [
    'copilot-gov/actions-integration.md', 'copilot-gov/agent-governance.md',
    'copilot-gov/api-governance.md', 'copilot-gov/audit-compliance.md',
    'copilot-gov/code-review-automation.md',
    'copilot-gov/governance-patterns.md',
    'copilot-gov/policy-enforcement.md', 'copilot-gov/workspace-governance.md'
  ]},
  { cat: 'Help & Roles', files: [
    'help-best-practices.md', 'help-section-structure.md',
    'agile-roles-analysis.md', 'agile-roles-cross-verification.md'
  ]},
  { cat: 'General', files: [
    'free-tier-inventory.md', 'hardware-evaluation.md'
  ]}
];

function getWikiPages() {
  const pages = [];
  for (const cat of WIKI_MANIFEST) {
    for (const f of cat.files) {
      pages.push({ cat: cat.cat, file: f, path: `../research/${f}` });
    }
  }
  return pages;
}

function getWikiHealth() {
  const pages = getWikiPages();
  const cats = WIKI_MANIFEST.length;
  return {
    loaded: true, pages: pages.length, dirs: cats, issues: 0,
    broken: [], orphans: [], frontmatter: [], indexSync: [],
    lastCheck: new Date().toISOString()
  };
}

function renderWikiReader(pages) {
  if (!pages || !pages.length) {
    return '<p class="wiki-empty">No wiki pages found.</p>';
  }
  const cats = {};
  for (const p of pages) {
    if (!cats[p.cat]) cats[p.cat] = [];
    cats[p.cat].push(p);
  }
  const sections = Object.entries(cats).map(([cat, files]) => {
    const items = files.map(f => {
      const name = f.file.replace(/\.md$/, '').replace(/.*\//, '');
      const href = `../research/${f.file}`;
      return `<li><a href="${esc(href)}" target="_blank"
        class="wiki-link">${esc(name)}</a></li>`;
    }).join('');
    return `<details class="wiki-section" open>
      <summary>📁 ${esc(cat)} (${files.length})</summary>
      <ul class="wiki-list">${items}</ul></details>`;
  }).join('');
  return `<div class="wiki-reader">
    <div class="wiki-summary">${pages.length} pages · ${Object.keys(cats).length} categories</div>
    ${sections}</div>`;
}
