// Help Tour — Driver.js guided walkthrough (lazy-loaded)
// Only downloads Driver.js CSS+JS when user clicks ❓

let driverLoaded = false;

async function loadDriverJS() {
  if (driverLoaded) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.css';
  document.head.appendChild(link);
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  driverLoaded = true;
}

async function startDashboardTour() {
  await loadDriverJS();
  if (typeof driver === 'undefined') return;
  const tour = driver({
    showProgress: true,
    animate: true,
    overlayColor: '#0d1117',
    overlayOpacity: 0.75,
    popoverClass: 'tour-popover',
    steps: [
      { element: '.status-badge', popover: {
        title: 'Fleet Status',
        description: 'Shows overall health: healthy, degraded, or offline.',
        side: 'bottom' }},
      { element: '#panel-quotas', popover: {
        title: 'Live Quotas',
        description: 'Real-time usage from OpenRouter, Cloudflare, GitHub.',
        side: 'left' }},
      { element: '#panel-router', popover: {
        title: 'Task Router',
        description: 'Free/Fleet/Premium lane distribution.',
        side: 'right' }},
      { element: '#panel-router-log', popover: {
        title: 'Router Log',
        description: 'Recent LLM agent and model routing decisions.',
        side: 'left' }},
      { element: '#btn-refresh', popover: {
        title: 'Refresh',
        description: 'Polls all devices and services immediately.',
        side: 'bottom' }}
    ]
  });
  tour.drive();
}
