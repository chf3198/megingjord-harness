// HAMR /mcp capability dispatch — Wave 5 child 4 (#935).
// Reads the request body's `capability` field and routes to the right handler.
import type { Env } from '../worker';
import { rotationCheck } from './rotation-check';
import { reviewRun } from './review-run';

const SUBSTRATE_HEALTH_KV_KEY = 'substrate-health:latest';
const MAILBOX_PREFIX = 'mailbox/';
const MAX_MAILBOX_RESULTS = 50;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function bundleFetch(env: Env, params: Record<string, unknown>): Promise<Response> {
  const tier = String(params.tier || 'fim-5kb');
  const obj = await env.HAMR_BUNDLES.get(`bundle/${tier}.txt`);
  if (!obj) return jsonResponse(404, { error: 'bundle_not_found', tier });
  return new Response(obj.body, { status: 200, headers: { 'content-type': 'text/plain', 'x-hamr-bundle-tier': tier } });
}

async function doctorProbe(env: Env): Promise<Response> {
  const raw = await env.HAMR_KV.get(SUBSTRATE_HEALTH_KV_KEY);
  if (!raw) return jsonResponse(200, { source: 'kv', present: false, hint: 'no substrate-health snapshot in KV; run hamr:health locally + push' });
  try { return jsonResponse(200, { source: 'kv', present: true, snapshot: JSON.parse(raw) }); }
  catch { return jsonResponse(200, { source: 'kv', present: true, raw }); }
}

async function mailboxRead(env: Env, params: Record<string, unknown>): Promise<Response> {
  const limitNum = Number(params.limit ?? 10);
  const limit = Math.min(MAX_MAILBOX_RESULTS, Math.max(1, limitNum));
  const list = await env.HAMR_BUNDLES.list({ prefix: MAILBOX_PREFIX, limit });
  if (!params.fetch_contents) {
    return jsonResponse(200, { count: list.objects.length, keys: list.objects.map((o) => o.key) });
  }
  const envelopes: Array<{ key: string; envelope: unknown; error?: string }> = [];
  for (const entry of list.objects) {
    const obj = await env.HAMR_BUNDLES.get(entry.key);
    if (!obj) { envelopes.push({ key: entry.key, envelope: null, error: 'object_missing' }); continue; }
    try {
      const text = await obj.text();
      envelopes.push({ key: entry.key, envelope: JSON.parse(text) });
    } catch { envelopes.push({ key: entry.key, envelope: null, error: 'invalid_json' }); }
  }
  return jsonResponse(200, { count: envelopes.length, envelopes });
}

export async function dispatch(request: Request, env: Env, keyId: string, slsaState: string): Promise<Response> {
  let body: { capability?: string; params?: Record<string, unknown> };
  try { body = await request.json(); } catch { return jsonResponse(400, { error: 'invalid_json' }); }
  const capability = String(body?.capability || '');
  const params = body?.params || {};
  const meta = { key_id: keyId, slsa_gate: slsaState, capability };
  switch (capability) {
    case 'bundle:fetch': {
      const r = await bundleFetch(env, params);
      r.headers.set('x-hamr-meta', JSON.stringify(meta));
      return r;
    }
    case 'doctor:probe': return doctorProbe(env).then((r) => { r.headers.set('x-hamr-meta', JSON.stringify(meta)); return r; });
    case 'mailbox:read': return mailboxRead(env, params).then((r) => { r.headers.set('x-hamr-meta', JSON.stringify(meta)); return r; });
    case 'rotation:check': {
      const result = rotationCheck(params as Parameters<typeof rotationCheck>[0]);
      const r = jsonResponse(200, result);
      r.headers.set('x-hamr-meta', JSON.stringify(meta));
      return r;
    }
    case 'review:run': {
      const result = reviewRun(params as Parameters<typeof reviewRun>[0]);
      const r = jsonResponse(200, result);
      r.headers.set('x-hamr-meta', JSON.stringify(meta));
      return r;
    }
    case '': return jsonResponse(200, { accepted: true, ...meta, hint: 'POST capability + params to invoke' });
    default: return jsonResponse(400, { error: 'unknown_capability', capability, supported: ['bundle:fetch', 'doctor:probe', 'mailbox:read', 'rotation:check', 'review:run'] });
  }
}
