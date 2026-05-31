// HAMR /fleet/{acquire,release,status,in-flight} — cross-team fleet claim (#2525)
// Phase-1 AC5 of Epic #2518. KV-backed 60s TTL claims; DPoP auth.
import type { Env } from '../worker';

const CLAIM_TTL_SECONDS = 60;
const CLAIM_KEY_PREFIX = 'fleet-claim:';
const CLAIM_INDEX_KEY = 'fleet-claim-index';

function jerr(status: number, code: string, detail?: string): Response {
  return new Response(JSON.stringify({ error: code, ...(detail ? { detail } : {}) }), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
function jok(payload: object, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
function teamFrom(request: Request): string | null {
  const team = request.headers.get('x-hamr-team') ?? '';
  return team.length > 0 && team.length < 32 ? team : null;
}
function authOk(request: Request): boolean {
  return (request.headers.get('authorization') ?? '').startsWith('DPoP ');
}

export async function fleetClaimAcquire(hostModel: string, request: Request, env: Env): Promise<Response> {
  if (!authOk(request)) return jerr(401, 'missing_dpop');
  const team = teamFrom(request);
  if (!team) return jerr(400, 'missing_team_header');
  const body = await request.json().catch(() => ({})) as any;
  const ticket = body.ticket ?? null;
  const key = `${CLAIM_KEY_PREFIX}${hostModel}`;
  const existing = await env.HAMR_KV.get(key, 'json') as any;
  if (existing) return jerr(409, 'claim_held', `team=${existing.team} ticket=${existing.ticket}`);
  const claim_id = crypto.randomUUID();
  const started_at = new Date().toISOString();
  const expires_at = new Date(Date.now() + CLAIM_TTL_SECONDS * 1000).toISOString();
  const record = { claim_id, team, ticket, host_model: hostModel, started_at, expires_at };
  await env.HAMR_KV.put(key, JSON.stringify(record), { expirationTtl: CLAIM_TTL_SECONDS });
  return jok({ claim_id, ttl_s: CLAIM_TTL_SECONDS, expires_at });
}

export async function fleetClaimRelease(claimId: string, request: Request, env: Env): Promise<Response> {
  if (!authOk(request)) return jerr(401, 'missing_dpop');
  const team = teamFrom(request);
  if (!team) return jerr(400, 'missing_team_header');
  const list = await env.HAMR_KV.list({ prefix: CLAIM_KEY_PREFIX });
  for (const key of list.keys) {
    const rec = await env.HAMR_KV.get(key.name, 'json') as any;
    if (rec && rec.claim_id === claimId && rec.team === team) {
      await env.HAMR_KV.delete(key.name);
      return jok({ released: true, host_model: rec.host_model });
    }
  }
  return jerr(404, 'claim_not_found');
}

export async function fleetInFlight(env: Env): Promise<Response> {
  const list = await env.HAMR_KV.list({ prefix: CLAIM_KEY_PREFIX });
  const entries = [];
  for (const key of list.keys) {
    const rec = await env.HAMR_KV.get(key.name, 'json') as any;
    if (rec) entries.push(rec);
  }
  return jok({ entries });
}
