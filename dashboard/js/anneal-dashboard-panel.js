/**
 * Anneal Dashboard Panel — AC9 dashboard integration for anneal queue visibility
 * Renders pending/proposed/resolved counts and top patterns
 */
const ANNEAL_STAT_COLOR_PENDING='#ff6b6b';
const ANNEAL_STAT_COLOR_PROPOSED='#ffd93d';
const ANNEAL_STAT_COLOR_OK='#51cf66';
const ANNEAL_STAT_COLOR_GRAY='#a8a8a8';
const CSS_PADDING='1rem';
const CSS_GAP='0.5rem';
const CSS_MB='margin-bottom';

function renderAnnealPanelStats(metrics){
  const pc=metrics.pending>0?ANNEAL_STAT_COLOR_PENDING:ANNEAL_STAT_COLOR_OK;
  const propo=metrics.proposed>0?ANNEAL_STAT_COLOR_PROPOSED:ANNEAL_STAT_COLOR_OK;
  return `<div class="stat-box"><h4>Pending</h4><p class="stat-value" style="color:${pc}">${metrics.pending}</p></div>
<div class="stat-box"><h4>Proposed</h4><p class="stat-value" style="color:${propo}">${metrics.proposed}</p></div>
<div class="stat-box"><h4>Resolved</h4><p class="stat-value" style="color:${ANNEAL_STAT_COLOR_OK}">${metrics.resolved}</p></div>
<div class="stat-box"><h4>Suppressed</h4><p class="stat-value" style="color:${ANNEAL_STAT_COLOR_GRAY}">${metrics.suppressed}</p></div>`;}
function renderAnnealPanel(metrics) {
  if (!metrics) return '<div class="anneal-panel"><p>No data yet</p></div>';
  const topStr = metrics.top_patterns.map(p => `<li><strong>${p.pattern_id}</strong>: ${p.count}</li>`).join('');
  const hasPatterns = metrics.top_patterns.length>0;
  return `<div class="anneal-panel"><div class="anneal-stats">${renderAnnealPanelStats(metrics)}</div>${hasPatterns?`<div class="anneal-top-patterns"><h5>Top Patterns</h5><ul>${topStr}</ul></div>`:''}</div>`;
}

// CSS for anneal panel
const CSS_DEFAULT_BG='#1e1e1e';
const CSS_DEFAULT_BORDER='#333';
const CSS_BORDER_RADIUS='4px';
const CSS_PADDING_BOX='0.75rem';
const CSS_FONT_SIZE_HEADER='0.9rem';
const CSS_FONT_SIZE_VALUE='1.5rem';
const CSS_PADDING_LEFT='1.5rem';
const CSS_MARGIN_ITEM='0.25rem';
const ANNEAL_PANEL_CSS = `
.anneal-panel{padding:${CSS_PADDING}}.anneal-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:${CSS_GAP};${CSS_MB}:1rem}
.stat-box{background:var(--bg-secondary,${CSS_DEFAULT_BG});border:1px solid var(--border-color,${CSS_DEFAULT_BORDER});border-radius:${CSS_BORDER_RADIUS};padding:${CSS_PADDING_BOX};text-align:center}
.stat-box h4{margin:0 0 0.5rem 0;font-size:${CSS_FONT_SIZE_HEADER};opacity:0.8}.stat-value{margin:0;font-size:${CSS_FONT_SIZE_VALUE};font-weight:bold}
.anneal-top-patterns{background:var(--bg-secondary,${CSS_DEFAULT_BG});border:1px solid var(--border-color,${CSS_DEFAULT_BORDER});border-radius:${CSS_BORDER_RADIUS};padding:${CSS_PADDING_BOX}}
.anneal-top-patterns h5{margin:0 0 0.5rem 0;font-size:${CSS_FONT_SIZE_HEADER};opacity:0.8}.anneal-top-patterns ul{margin:0;padding-left:${CSS_PADDING_LEFT};font-size:${CSS_FONT_SIZE_HEADER}}
.anneal-top-patterns li{margin:${CSS_MARGIN_ITEM} 0}
`;

if(typeof document!=='undefined'){const style=document.createElement('style');style.textContent=ANNEAL_PANEL_CSS;document.head.appendChild(style);}
