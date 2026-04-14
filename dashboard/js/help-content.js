// Help Content — collapsible sections with search

const HELP_SECTIONS = [
  { id: 'fleet', title: '🌐 Fleet Topology', body:
    'Compact SVG network graph showing all inventoried devices. '
    + 'Green status dots = reachable via Tailscale. Grey = no route. '
    + 'Solid green lines = active mesh link between healthy nodes. '
    + 'Dashed lines = no Tailscale route. Only devices with a '
    + 'tailscaleIP in inventory/devices.json participate in mesh links. '
    + 'Data source: inventory/devices.json merged with live '
    + 'health-check pings to each device\'s Ollama /api/tags endpoint.' },
  { id: 'baton', title: '🔄 Agent Baton Flow', body:
    'Visualizes the Agile role workflow: Manager → Collaborator → '
    + 'Admin → Consultant. The active role is derived from the most '
    + 'recent LLM Router Log entry. Manager scopes tickets, '
    + 'Collaborator implements, Admin merges/deploys, Consultant '
    + 'reviews. When no routing decisions exist, baton shows idle.' },
  { id: 'activity', title: '📡 Live Activity Feed', body:
    'Timestamped event log of dashboard actions. Captures: refresh '
    + 'cycles (with healthy/total counts), stress test rounds '
    + '(per-round ok/fail/ms), auto-refresh toggles, and system init. '
    + 'Max 20 entries, newest first. Scrollable when full.' },
  { id: 'resources', title: '⚡ Remote Resources', body:
    'Three cards: OpenClaw Gateway (LiteLLM proxy on windows-laptop '
    + 'port 4000), Tailscale Mesh (connected node count + IPs), and '
    + 'Ollama Fleet (model counts per node). Data comes from '
    + 'inventory/services.json + live health checks.' },
  { id: 'quotas', title: '📊 Quotas (Ops view)', body:
    'Shows API quota usage for free-tier services. Live quotas poll '
    + 'provider APIs (OpenRouter /api/v1/auth/key, etc). Static quotas '
    + 'come from inventory/services.json rate limits. Bars turn yellow '
    + 'above 80% usage.' },
  { id: 'router', title: '🛣️ Task Router (Ops view)', body:
    'Lane distribution bar chart: Free (local Ollama), Fleet '
    + '(OpenClaw/Tailscale), Premium (Copilot/paid APIs). Fetched '
    + 'from /api/router/metrics. Router Log shows recent LLM routing '
    + 'decisions with agent, model, and timestamp.' },
  { id: 'controls', title: '🎛️ Header Controls', body:
    '↻ Refresh: polls all endpoints immediately. ⏱️ Auto: toggles '
    + '60s auto-refresh cycle. 🧪 Test: runs 12 lightweight stress '
    + 'rounds with live activity feed updates. 💡 Tips: toggles '
    + 'contextual tooltips on hover. ◐ Contrast: high-contrast mode. '
    + '❓ Tour: guided walkthrough (loads Driver.js from CDN).' },
  { id: 'views', title: '📋 View Navigation', body:
    'Fleet: topology + baton + activity + resources (2×2 grid). '
    + 'Ops: quotas, stats, router, settings, stress test. '
    + 'Resources: device + service inventory cards. '
    + 'Help: this searchable reference. Views using x-if remove '
    + 'panels from DOM when inactive to save memory.' },
  { id: 'data', title: '🗄️ Data Sources', body:
    'inventory/devices.json: 3 fleet devices with Tailscale IPs, '
    + 'Ollama configs, and hardware specs. inventory/services.json: '
    + '7 services (Copilot Pro, Cloudflare, OpenRouter, OpenClaw, '
    + 'Google AI Studio, Groq, Cerebras). Health checks: fetch() to '
    + 'each device\'s Ollama API with 2.5s timeout. All data loaded '
    + 'on init, refreshed on 60s cycle or manual refresh.' },
  { id: 'perf', title: '⚡ Performance Budgets', body:
    'DOM nodes < 2000, JS heap < 50 MB, script duration < 3s, '
    + 'task duration < 5s, layout recalcs < 50. Target viewport: '
    + '960×1080 (half-screen). No build step — static files served '
    + 'directly. Alpine.js for state, vanilla JS for logic.' }
];

function getHelpSections() { return HELP_SECTIONS; }
