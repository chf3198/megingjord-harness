// HAMR /quota — production cache-hit-rate + provider-spillover state (#927).
// REPLACES Wave 2 placeholder. Reads KV cache-stats counter populated by Wave 4 child 3.
import type { Env } from '../worker';

const HIT_RATE_KEY = 'cache-stats:hit-rate-7d';
const PROVIDER_PREFIX = 'provider-spillover:';

interface ProviderState {
  rate_limited: boolean;
  reset_at: number | null;
}

async function readHitRate(env: Env): Promise<number | null> {
  const raw = await env.HAMR_KV.get(HIT_RATE_KEY);
  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readProviderStates(env: Env): Promise<Record<string, ProviderState>> {
  const list = await env.HAMR_KV.list({ prefix: PROVIDER_PREFIX });
  const out: Record<string, ProviderState> = {};
  for (const entry of list.keys) {
    const provider = entry.name.slice(PROVIDER_PREFIX.length);
    const raw = await env.HAMR_KV.get(entry.name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as ProviderState;
      out[provider] = parsed;
    } catch { /* skip malformed */ }
  }
  return out;
}

export async function quota(env: Env): Promise<Response> {
  const [hit_rate_7d, providers] = await Promise.all([readHitRate(env), readProviderStates(env)]);
  return new Response(JSON.stringify({
    schema_version: 2,
    ts: Date.now(),
    hit_rate_7d,
    providers,
    placeholder: false,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
