// Live Activity Feed — real-time event log for Fleet view

const MAX_ACTIVITY = 15;

function addActivity(log, type, message, detail) {
  log.unshift({
    time: new Date().toLocaleTimeString(),
    type: type || 'info',
    message: message || '',
    detail: detail || ''
  });
  if (log.length > MAX_ACTIVITY) log.length = MAX_ACTIVITY;
}

function renderActivityFeed(log) {
  if (!log || !log.length) {
    return `<div class="activity-empty">
      <p>No activity yet. Events appear on refresh,
      test runs, and role transitions.</p></div>`;
  }
  const rows = log.map(e => {
    const icon = activityIcon(e.type);
    return `<div class="activity-row">
      <span class="activity-time">${esc(e.time)}</span>
      <span class="activity-icon">${icon}</span>
      <span class="activity-msg">${esc(e.message)}</span>
      ${e.detail ? `<span class="activity-detail">${esc(e.detail)}</span>` : ''}
    </div>`;
  }).join('');
  return `<div class="activity-list">${rows}</div>`;
}

function activityIcon(type) {
  const icons = {
    refresh: '↻', test: '🧪', baton: '🔄',
    router: '🛣️', system: '⚙️', error: '❌'
  };
  return icons[type] || '📌';
}
