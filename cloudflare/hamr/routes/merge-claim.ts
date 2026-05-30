// HAMR /merge-claim/{acquire,release,status} — cross-team merge serialization (#2458).
// Phase-1 Move 3 of Epic #2451. KV-backed 60s TTL claims; DPoP auth per HAMR contract.
import type { Env } from '../worker';

const CLAIM_TTL_SECONDS = 60;

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

export async function mergeClaimAcquire(ticketN: string, request: Request, env: Env): Promise<Response> {
  if (!authOk(request)) return jerr(401, 'missing_dpop');
  const team = teamFrom(request);
  if (!team) return jerr(400, 'missing_team_header');
  if (!/^\d+$/.test(ticketN)) return jerr(400, 'bad_ticket');

  const key = `merge-claim:${ticketN}`;
  const existing = await env.HAMR_KV.get(key, 'json') as any;
  if (existing) {
    return jerr(409, 'claim_held', `held_by=${existing.team} expires_at=${existing.expires_at}`);
  }
  const claimId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CLAIM_TTL_SECONDS * 1000).toISOString();
  const record = { claim_id: claimId, team, ticket: ticketN, expires_at: expiresAt };
  await env.HAMR_KV.put(key, JSON.stringify(record), { expirationTtl: CLAIM_TTL_SECONDS });
  await env.HAMR_KV.put(`merge-claim-id:${claimId}`, ticketN, { expirationTtl: CLAIM_TTL_SECONDS });
  return jok({ claim_id: claimId, ttl_s: CLAIM_TTL_SECONDS, expires_at: expiresAt });
}

export async function mergeClaimRelease(claimId: string, request: Request, env: Env): Promise<Response> {
  if (!authOk(request)) return jerr(401, 'missing_dpop');
  const team = teamFrom(request);
  if (!team) return jerr(400, 'missing_team_header');
  const ticketN = await env.HAMR_KV.get(`merge-claim-id:${claimId}`);
  if (!ticketN) return jerr(404, 'claim_not_found');
  const key = `merge-claim:${ticketN}`;
  const existing = await env.HAMR_KV.get(key, 'json') as any;
  if (!existing) return jerr(404, 'claim_expired');
  if (existing.team !== team) return jerr(403, 'wrong_team');
  if (existing.claim_id !== claimId) return jerr(409, 'claim_id_mismatch');
  await env.HAMR_KV.delete(key);
  await env.HAMR_KV.delete(`merge-claim-id:${claimId}`);
  return jok({ released: true, ticket: ticketN });
}

export async function mergeClaimStatus(ticketN: string, env: Env): Promise<Response> {
  if (!/^\d+$/.test(ticketN)) return jerr(400, 'bad_ticket');
  const record = await env.HAMR_KV.get(`merge-claim:${ticketN}`, 'json') as any;
  if (!record) return jok({ held: false });
  return jok({ held: true, held_by_team: record.team, expires_at: record.expires_at });
}
