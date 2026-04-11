// Quota Live — fetch real usage from OpenRouter + Cloudflare
// Returns normalized { used, limit, percent } objects

async function fetchOpenRouterCredits() {
  try {
    const r = await fetch('/api/openrouter/credits', {
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const data = await r.json();
    const info = data.data || data;
    const used = info.usage ?? 0;
    const limit = info.limit ?? info.rate_limit?.credits ?? 0;
    return {
      id: 'openrouter',
      name: 'OpenRouter: Credits',
      used: Math.round(used * 100) / 100,
      limit: limit || 'unlimited',
      percent: limit ? Math.min(100,
        Math.round((used / limit) * 100)) : 0,
      period: 'account'
    };
  } catch {
    return null;
  }
}

async function fetchCloudflareAIUsage() {
  try {
    const r = await fetch('/api/cloudflare/ai-usage', {
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const data = await r.json();
    const neurons = data.result?.neurons_used ?? 0;
    return {
      id: 'cloudflare-ai',
      name: 'Cloudflare: AI Neurons',
      used: neurons,
      limit: 10000,
      percent: Math.min(100,
        Math.round((neurons / 10000) * 100)),
      period: 'daily'
    };
  } catch {
    return null;
  }
}

async function fetchAllLiveQuotas() {
  const [or, cf] = await Promise.all([
    fetchOpenRouterCredits(),
    fetchCloudflareAIUsage()
  ]);
  return [or, cf].filter(Boolean);
}
