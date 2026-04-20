// Quota Live — fetch real usage from all service APIs
// Returns normalized { used, limit, percent } objects

async function fetchOpenRouterCredits() {
  try {
    const r = await fetch('/api/openrouter/credits', { signal: AbortSignal.timeout(5000) });
    if (r.status === 503) return { id: 'openrouter', name: 'OpenRouter Credits',
      used: '—', limit: '—', percent: 0, note: '🔧 No API key', link: 'https://openrouter.ai/activity' };
    if (!r.ok) return null;
    const info = (await r.json()).data || {};
    const used = info.usage ?? 0, limit = info.limit ?? 0;
    return { id: 'openrouter', name: 'OpenRouter Credits', used: Math.round(used * 100) / 100,
      limit: limit || '∞', percent: limit ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      link: 'https://openrouter.ai/activity' };
  } catch (e) { return { id: 'openrouter', name: 'OpenRouter Credits',
    used: '—', limit: '—', percent: 0, note: '⚠️ Unreachable', link: 'https://openrouter.ai/activity' }; }
}

async function fetchCloudflareAI() {
  try {
    const r = await fetch('/api/cloudflare/ai-usage', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return { id: 'cloudflare-ai', name: 'Cloudflare AI Neurons',
      used: '—', limit: 10000, percent: 0, note: r.status === 503 ? '🔧 Config needed' : '⚠️ Error',
      link: 'https://dash.cloudflare.com/' };
    const neurons = (await r.json()).result?.neurons_used ?? 0;
    return { id: 'cloudflare-ai', name: 'Cloudflare AI Neurons', used: neurons, limit: 10000,
      percent: Math.min(100, Math.round((neurons / 10000) * 100)), link: 'https://dash.cloudflare.com/' };
  } catch (e) { return { id: 'cloudflare-ai', name: 'Cloudflare AI Neurons',
    used: '—', limit: 10000, percent: 0, note: '⚠️ Unreachable', link: 'https://dash.cloudflare.com/' }; }
}

async function fetchCopilotUsage() {
  try {
    const r = await fetch('/api/copilot-usage', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const d = await r.json();
    return { id: 'copilot-pro', name: 'Copilot Pro (' + d.source + ')', used: d.used,
      limit: d.limit, percent: d.percent, period: d.period, note: d.note,
      link: d.usageLink };
  } catch (e) { return null; }
}

async function fetchServiceProbes() {
  try {
    const r = await fetch('/api/quota-probes', { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const d = await r.json();
    const out = [];
    if (d.groq && !d.groq.error) {
      const used = d.groq.limitReqs - d.groq.remainReqs;
      out.push({ id: 'groq', name: 'Groq Rate Limit', used, limit: d.groq.limitReqs,
        percent: Math.min(100, Math.round((used / d.groq.limitReqs) * 100)),
        period: 'window', link: 'https://console.groq.com/' });
    }
    if (d.google && !d.google.error) {
      out.push({ id: 'google-ai', name: 'Google AI Studio (' + d.google.models + ' models)',
        used: '✓ active', limit: '500/day grounding', percent: 0,
        link: 'https://aistudio.google.com/' });
    }
    if (d.cerebras && !d.cerebras.error) {
      out.push({ id: 'cerebras', name: 'Cerebras (' + d.cerebras.models + ' models)',
        used: '✓ active', limit: 'free tier', percent: 0,
        link: 'https://cloud.cerebras.ai/' });
    }
    return out;
  } catch (e) { return []; }
}

function buildServiceCosts() {
  return [
    { id: 'copilot-pro', name: 'GitHub Copilot Pro', cost: 'Metered',
      detail: 'Set $10 budget cap at billing → budgets', link: 'https://github.com/settings/billing' },
    { id: 'cloudflare', name: 'Cloudflare Workers', cost: '$10/mo',
      detail: 'Pages + Workers AI', link: 'https://dash.cloudflare.com/' },
  ];
}

async function fetchAllLiveQuotas() {
  const [or, cf, cp, probes] = await Promise.all([
    fetchOpenRouterCredits(), fetchCloudflareAI(), fetchCopilotUsage(), fetchServiceProbes() ]);
  return [cp, or, cf, ...probes].filter(Boolean);
}
