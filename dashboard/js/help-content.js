// Help Content — comprehensive help center with search
// Uses HELP_USER_SECTIONS and HELP_DEV_SECTIONS from split files

function renderWikiLinks(body) {
  return body.replace(/\[\[([\w-]+)\]\]/g, (_m, name) =>
    `<a href="#" class="wiki-link" title="Open wiki: ${name}" onclick="Alpine.$data(document.querySelector('[x-data]')).setView('wiki');return false;">${name}</a>`);
}

function getHelpSections(devMode) {
  const user = typeof HELP_USER_SECTIONS !== 'undefined'
    ? HELP_USER_SECTIONS : [];
  const dev = typeof HELP_DEV_SECTIONS !== 'undefined'
    ? HELP_DEV_SECTIONS : [];
  return devMode ? [...user, ...dev] : user;
}

function renderHelpPanel(devMode) {
  const sections = getHelpSections(devMode);
  if (!sections.length) {
    return '<p class="help-empty">Help content loading…</p>';
  }
  const toggleLabel = devMode ? '👤 User View' : '🔧 Dev View';
  const toolbar = `<div class="help-toolbar">
    <input type="text" class="help-search"
      placeholder="Search help…"
      oninput="filterHelpSections(this.value)"/>
    <button class="help-toggle"
      onclick="Alpine.$data(document.querySelector('[x-data]')).toggleHelpDevMode()">
      ${toggleLabel}</button></div>`;

  const cats = devMode
    ? [
        { title: '🚀 Getting Started', ids: ['start-what', 'start-tour'] },
        { title: '📖 Live & Logs', ids: ['use-baton', 'use-health', 'use-context', 'use-activity', 'use-ticket-log'] },
        { title: '📊 Ops & Governance', ids: ['use-quotas', 'use-router', 'use-governance', 'use-github'] },
        { title: '🌐 Fleet & Wiki', ids: ['use-devices', 'use-services', 'use-settings', 'use-config', 'use-wiki-metrics', 'use-wiki-reader'] },
        { title: '🧪 Testing & Troubleshooting', ids: ['use-stress', 'trouble-offline', 'trouble-stale'] },
        { title: '👨‍💻 For Developers', ids: ['dev-arch', 'dev-files', 'dev-alpine', 'dev-panel', 'dev-api', 'dev-test', 'dev-contribute', 'dev-skills'] }
      ]
    : [
        { title: '🚀 Getting Started', ids: ['start-what', 'start-tour'] },
        { title: '📖 Live & Logs', ids: ['use-baton', 'use-health', 'use-context', 'use-activity', 'use-ticket-log'] },
        { title: '📊 Ops & Governance', ids: ['use-quotas', 'use-router', 'use-governance', 'use-github'] },
        { title: '🌐 Fleet & Wiki', ids: ['use-devices', 'use-services', 'use-settings', 'use-config', 'use-wiki-metrics', 'use-wiki-reader'] },
        { title: '🧪 Testing & Troubleshooting', ids: ['use-stress', 'trouble-offline', 'trouble-stale'] }
      ];

  const byId = {};
  for (const s of sections) byId[s.id] = s;

  const html = cats.map(cat => {
    const items = cat.ids
      .filter(id => byId[id])
      .map(id => {
        const s = byId[id];
        return `<details id="help-${s.id}" class="help-section" data-help-id="${s.id}">
          <summary>${s.title}</summary>
          <div class="help-body">${renderWikiLinks(s.body)}</div></details>`;
      }).join('');
    return `<div class="help-category">
      <h3 class="help-cat-title">${cat.title}</h3>${items}</div>`;
  }).join('');

  return `${toolbar}${html}
    <div class="help-feedback">
      <a href="https://github.com/chf3198/devenv-ops/issues/new"
        target="_blank" class="svc-link">📝 Report an issue</a>
      <a href="https://github.com/chf3198/devenv-ops/issues/new?labels=enhancement"
        target="_blank" class="svc-link">💡 Request a feature</a></div>`;
}

function filterHelpSections(query) {
  const q = (query || '').toLowerCase();
  document.querySelectorAll('.help-section').forEach(el => {
    const text = el.textContent.toLowerCase();
    el.style.display = !q || text.includes(q) ? '' : 'none';
  });
}
