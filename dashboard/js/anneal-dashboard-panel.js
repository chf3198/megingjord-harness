/**
 * Anneal Dashboard Panel — AC9 dashboard integration for anneal queue visibility
 * Renders pending/proposed/resolved counts and top patterns
 */
function renderAnnealPanel(metrics) {
  if (!metrics) return '<div class="anneal-panel"><p>No data yet</p></div>';
  
  const topStr = metrics.top_patterns
    .map(p => `<li><strong>${p.pattern_id}</strong>: ${p.count}</li>`)
    .join('');
  
  return `
    <div class="anneal-panel">
      <div class="anneal-stats">
        <div class="stat-box">
          <h4>Pending</h4>
          <p class="stat-value" style="color:${metrics.pending>0?'#ff6b6b':'#51cf66'}">${metrics.pending}</p>
        </div>
        <div class="stat-box">
          <h4>Proposed</h4>
          <p class="stat-value" style="color:${metrics.proposed>0?'#ffd93d':'#51cf66'}">${metrics.proposed}</p>
        </div>
        <div class="stat-box">
          <h4>Resolved</h4>
          <p class="stat-value" style="color:#51cf66">${metrics.resolved}</p>
        </div>
        <div class="stat-box">
          <h4>Suppressed</h4>
          <p class="stat-value" style="color:#a8a8a8">${metrics.suppressed}</p>
        </div>
      </div>
      ${metrics.top_patterns.length>0?`
      <div class="anneal-top-patterns">
        <h5>Top Patterns</h5>
        <ul>${topStr}</ul>
      </div>
      `:''}
    </div>
  `;
}

// CSS for anneal panel
const ANNEAL_PANEL_CSS = `
.anneal-panel {
  padding: 1rem;
}
.anneal-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.stat-box {
  background: var(--bg-secondary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  padding: 0.75rem;
  text-align: center;
}
.stat-box h4 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  opacity: 0.8;
}
.stat-value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
}
.anneal-top-patterns {
  background: var(--bg-secondary, #1e1e1e);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  padding: 0.75rem;
}
.anneal-top-patterns h5 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  opacity: 0.8;
}
.anneal-top-patterns ul {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.9rem;
}
.anneal-top-patterns li {
  margin: 0.25rem 0;
}
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = ANNEAL_PANEL_CSS;
  document.head.appendChild(style);
}
