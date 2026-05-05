// HAMR scheduled handler — Wave 6 child 1 (#941).
// Cron-fired freshness check: if cache-stats meta is older than 24h, sets
// `cache-stats:hit-rate-7d:stale=true` so /quota can advertise staleness.
import type { Env } from './worker';

const META_KEY = 'cache-stats:hit-rate-7d:meta';
const STALE_KEY = 'cache-stats:hit-rate-7d:stale';
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export async function scheduled(env: Env, now: number = Date.now()): Promise<{ stale: boolean; age_ms: number | null }> {
  const raw = await env.HAMR_KV.get(META_KEY);
  if (!raw) {
    await env.HAMR_KV.put(STALE_KEY, 'true');
    return { stale: true, age_ms: null };
  }
  let parsed: { ts?: number };
  try { parsed = JSON.parse(raw); } catch {
    await env.HAMR_KV.put(STALE_KEY, 'true');
    return { stale: true, age_ms: null };
  }
  const age = typeof parsed.ts === 'number' ? now - parsed.ts : null;
  const stale = age === null || age > STALE_THRESHOLD_MS;
  await env.HAMR_KV.put(STALE_KEY, stale ? 'true' : 'false');
  return { stale, age_ms: age };
}
