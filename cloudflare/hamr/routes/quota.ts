// HAMR /quota — production cache-hit-rate + provider-spillover state (#927).
// REPLACES Wave 2 placeholder. Reads KV cache-stats counter populated by Wave 4 child 3.
import type { Env } from '../worker';

const HIT_RATE_KEY = 'cache-stats:hit-rate-7d';
const STALE_KEY = 'cache-stats:hit-rate-7d:stale';
const PROVIDER_PREFIX = 'provider-spillover:';
const LAST_UPDATE_KEY = 'cache-stats:last-update-ms';
const PUSH_FAILURE_KEY = 'cache-stats:push-failure-count-24h';
const GOAL_HEALTH_KEY = 'goal-health-score:7d';
const FRESHNESS_SLO_MS = 12 * 60 * 60 * 1000;

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

async function readStale(env: Env): Promise<boolean> {
  const raw = await env.HAMR_KV.get(STALE_KEY);
  return raw === 'true';
}

async function readLastUpdateMs(env: Env): Promise<number | null> {
  const raw = await env.HAMR_KV.get(LAST_UPDATE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readPushFailureCount(env: Env): Promise<number> {
  const raw = await env.HAMR_KV.get(PUSH_FAILURE_KEY);
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readGoalHealth(env: Env): Promise<{ score: number | null; stale: boolean }> {
  const raw = await env.HAMR_KV.get(GOAL_HEALTH_KEY);
  if (!raw) return { score: null, stale: true };
  try {
    const parsed = JSON.parse(raw);
    const score = Number.isFinite(parsed.score) ? parsed.score : null;
    return { score, stale: parsed.stale === true || score === null };
  } catch { return { score: null, stale: true }; }
}

export async function quota(env: Env): Promise<Response> {
  const now = Date.now();
  const [hit_rate_7d, providers, stale, last_update_ms, push_failure_count_24h, goal_health] =
    await Promise.all([
      readHitRate(env), readProviderStates(env), readStale(env),
      readLastUpdateMs(env), readPushFailureCount(env), readGoalHealth(env),
    ]);
  const stale_age_ms = last_update_ms ? now - last_update_ms : null;
  const slo_breach = stale_age_ms !== null && stale_age_ms > FRESHNESS_SLO_MS;
  return new Response(JSON.stringify({
    schema_version: 4, ts: now, hit_rate_7d, providers, stale,
    last_update_ms, freshness_slo_ms: FRESHNESS_SLO_MS, stale_age_ms, slo_breach,
    push_failure_count_24h,
    goal_health_score_7d: goal_health.score,
    goal_health_stale: goal_health.stale,
    placeholder: false,
  }), { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
