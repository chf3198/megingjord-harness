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
  try {
    await loadDriverJS();
  } catch {
    alert('Tour library failed to load. Check your connection.');
    return;
  }
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
        description: 'Overall health: healthy, degraded, or loading.',
        side: 'bottom' }},
      { element: '#panel-topology', popover: {
        title: 'Fleet Topology',
        description: 'SVG network graph with Tailscale mesh and legend.',
        side: 'bottom' }},
      { element: '#panel-baton', popover: {
        title: 'Agent Baton Flow',
        description: 'Manager→Collaborator→Admin→Consultant pipeline.',
        side: 'bottom' }},
      { element: '#panel-activity', popover: {
        title: 'Live Activity',
        description: 'Real-time events: refreshes, tests, transitions.',
        side: 'top' }},
      { element: '#panel-resources', popover: {
        title: 'Remote Resources',
        description: 'OpenClaw, Tailscale mesh, and Ollama fleet.',
        side: 'top' }}
    ]
  });
  tour.drive();
}
