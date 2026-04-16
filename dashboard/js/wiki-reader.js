// Wiki Reader — browse real wiki pages from /api/wiki-pages

let _wikiPagesCache = [];

async function loadWikiPages() {
  try {
    const r = await fetch('/api/wiki-pages');
    if (!r.ok) return [];
    _wikiPagesCache = await r.json();
    return _wikiPagesCache;
  } catch { return []; }
}

function getWikiPages() { return _wikiPagesCache; }

function renderWikiReader(pages) {
  if (!pages || !pages.length) {
    return '<p class="wiki-empty">No wiki pages found.</p>';
  }
  const cats = {};
  for (const p of pages) {
    const cat = p.type || 'unknown';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(p);
  }
  const typeLabel = {
    entities: '📦 Entities', concepts: '💡 Concepts',
    sources: '📄 Sources', syntheses: '🔬 Syntheses',
  };
  const sections = Object.entries(cats).map(([cat, files]) => {
    const label = typeLabel[cat] || `📁 ${cat}`;
    const items = files.map(f => {
      const name = esc(f.title || f.slug);
      const slug = f.slug || '';
      const onclick = `trackWikiAccess('${esc(cat)}','${esc(slug)}')`;
      return `<li class="wiki-link" onclick="${onclick}">${name}
        <small class="wiki-tags">${(f.tags || []).map(
        t => '<span class="wiki-tag">' + esc(t) + '</span>'
      ).join('')}</small></li>`;
    }).join('');
    return `<details class="wiki-section" open>
      <summary onclick="trackWikiAccess('${esc(cat)}','')">${label} (${files.length})</summary>
      <ul class="wiki-list">${items}</ul></details>`;
  }).join('');
  const total = pages.length;
  const catCount = Object.keys(cats).length;
  return `<div class="wiki-reader">
    <div class="wiki-summary">${total} pages · ${catCount} types</div>
    ${sections}</div>`;
}
