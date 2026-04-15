function renderGovernancePanel(state = {}) {
  const enabled = state.enabled ? 'enabled' : 'disabled';
  const hooks = state.hooks || {};
  const pre = hooks.PreToolUse || [];
  const user = hooks.UserPromptSubmit || [];
  const stop = hooks.Stop || [];
  return `
    <div class="governance-grid">
      <div class="gov-card gov-status">
        <h3>Enforcement</h3>
        <p>Status: <strong>${enabled}</strong></p>
        <p>Repo scope: <code>${state.repoScope?.default_enabled ? 'true' : 'false'}</code></p>
      </div>
      <div class="gov-card gov-list">
        <h3>PreToolUse hooks</h3>
        <ul>${pre.map(item => `<li>${escapeHtml(item.command)}</li>`).join('')}</ul>
      </div>
      <div class="gov-card gov-list">
        <h3>UserPromptSubmit hooks</h3>
        <ul>${user.map(item => `<li>${escapeHtml(item.command)}</li>`).join('')}</ul>
      </div>
      <div class="gov-card gov-list">
        <h3>Stop hooks</h3>
        <ul>${stop.map(item => `<li>${escapeHtml(item.command)}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

async function fetchGovernanceState() {
  try {
    const r = await fetch('/api/governance');
    if (!r.ok) return {};
    return await r.json();
  } catch (e) {
    return { error: 'fetch failed' };
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
