// Help Tour — Driver.js guided walkthrough of dashboard
// Launched from ❓ button in header

function startDashboardTour() {
  if (typeof driver === 'undefined') return;
  const tour = driver({
    showProgress: true,
    animate: true,
    overlayColor: '#0d1117',
    overlayOpacity: 0.75,
    popoverClass: 'tour-popover',
    steps: [
      {
        element: '.status-badge',
        popover: {
          title: 'Fleet Status',
          description: 'Shows overall health: healthy (all up), ' +
            'degraded (partial), or offline.',
          side: 'bottom'
        }
      },
      {
        element: '#panel-devices',
        popover: {
          title: 'Fleet Devices',
          description: 'Your Tailscale mesh devices. Shows RAM, ' +
            'model count, and live Ollama status.',
          side: 'right'
        }
      },
      {
        element: '#panel-services',
        popover: {
          title: 'Services',
          description: 'External services and subscriptions. ' +
            'Status badges update on refresh.',
          side: 'left'
        }
      },
      {
        element: '#panel-quotas',
        popover: {
          title: 'Live Quotas',
          description: 'Real-time usage from OpenRouter, ' +
            'Cloudflare, and GitHub Copilot.',
          side: 'left'
        }
      },
      {
        element: '#panel-stats',
        popover: {
          title: 'Live Fleet Stats',
          description: 'Ollama model inventory and running ' +
            'processes fetched from each device.',
          side: 'right'
        }
      },
      {
        element: '#btn-refresh',
        popover: {
          title: 'Refresh',
          description: 'Polls all devices and services for ' +
            'fresh status, stats, and quotas.',
          side: 'bottom'
        }
      }
    ]
  });
  tour.drive();
}
