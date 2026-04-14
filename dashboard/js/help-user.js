// Help User Sections — task-oriented help for dashboard operators

const HELP_USER_SECTIONS = [
  { id: 'start-what', title: '🚀 What is DevEnv Ops?',
    body: 'DevEnv Ops is a fleet operations dashboard that monitors your development devices, AI services, and agent workflows in real-time. It shows device health, Tailscale mesh connectivity, Ollama model status, and Agile agent baton flow — all from a single browser tab.' },
  { id: 'start-tour', title: '🗺️ Quick tour of the dashboard',
    body: 'Use the <strong>nav bar</strong> to switch views: Fleet (device topology + agent baton), Ops (quotas, router, settings), Wiki (research browser), Resources (device/service cards), Help (this page). The <strong>header buttons</strong>: ↻ refresh, ⏱️ auto-refresh, 🧪 stress test, 💡 tooltips, ◐ contrast, ❓ guided tour.' },
  { id: 'use-health', title: '💚 Checking fleet health',
    body: 'The Fleet Topology panel shows all devices as nodes. <strong>Green dot</strong> = online and healthy. <strong>Yellow</strong> = degraded (slow response). <strong>Red</strong> = offline. Solid green lines between nodes = active Tailscale mesh. Dashed lines = mesh configured but one end offline. The ⭐ icon marks your primary dev workstation.' },
  { id: 'use-baton', title: '🔄 Understanding agent baton flow',
    body: 'The Agent Baton panel shows active tickets moving through the Agile pipeline: Manager → Collaborator → Admin → Consultant. Each row is one ticket. The <strong>active step</strong> glows blue. Completed steps show green borders. Multiple rows = parallel ticket execution.' },
  { id: 'use-activity', title: '📡 Reading the activity feed',
    body: 'The Live Activity feed shows timestamped events: 🎫 ticket created, 🏷️ role transitions, 🌿 branch operations, 🔀 PRs, ✅ merges, 🚀 deploys, 🧪 test rounds, ↻ refreshes. Events auto-scroll with newest on top. Max 30 entries retained.' },
  { id: 'use-stress', title: '🧪 Running a stress test',
    body: 'Click the 🧪 button to start a ~60 second stress test. It simulates 5 parallel tickets through all agent roles, generates mock router log entries, cycles device statuses, and exercises every panel. Watch the baton flow, activity feed, and router log populate with test data.' },
  { id: 'trouble-offline', title: '🔴 Device shows as offline',
    body: '<strong>Symptom</strong>: Red dot on a topology node.<br><strong>Causes</strong>: Device powered off, Tailscale disconnected, network issue, or health check timeout (2.5s).<br><strong>Fix</strong>: Check device power → verify Tailscale status → check network → click ↻ to re-check.' },
  { id: 'trouble-stale', title: '⏳ Data appears stale',
    body: '<strong>Symptom</strong>: "Last refresh" timestamp is old.<br><strong>Causes</strong>: Auto-refresh disabled, browser tab backgrounded, network error.<br><strong>Fix</strong>: Click ↻ manually → check ⏱️ auto-refresh is enabled → verify network connectivity.' }
];
