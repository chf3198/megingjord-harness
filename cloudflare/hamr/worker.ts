// HAMR core CF Worker (#910) — top-level router.
// Per HAMR v3.2 §5 child 1 + v3.2.1 §R9. Routes split into ./routes/* per ≤100-line policy.
// Coexists with existing cloudflare/worker.ts (megingjord-coord); HAMR is a NEW Worker.
import { healthz } from './routes/healthz';
import { bundle } from './routes/bundle';
import { mcp } from './routes/mcp';
import { mailboxRead, mailboxWrite } from './routes/mailbox';
import { quota } from './routes/quota';
import { cacheStats } from './routes/cache-stats';
import { substrateHealth } from './routes/substrate-health';
import { mergeClaimAcquire, mergeClaimRelease, mergeClaimStatus } from './routes/merge-claim';
import { scheduled as scheduledHandler } from './scheduled';

export interface Env {
  HAMR_KV: KVNamespace;
  HAMR_BUNDLES: R2Bucket;
  PUBLISHER_KEYRING?: string; // JSON {key_id: base64-spki} for DPoP/Ed25519 verify
  ENVIRONMENT?: 'production' | 'staging';
}

const SECURITY_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
};

function withSecurity(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'not_found' }), {
    status: 404, headers: { 'content-type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = request.method;
    const t0 = Date.now();
    let res: Response;
    try {
      if (url.pathname === '/healthz' && m === 'GET') res = await healthz(env);
      else if (url.pathname.startsWith('/bundle/') && m === 'GET') res = await bundle(url, env);
      else if (url.pathname === '/mcp' && m === 'POST') res = await mcp(request, env);
      else if (url.pathname === '/mailbox/read' && m === 'GET') res = await mailboxRead(request, env);
      else if (url.pathname === '/mailbox/write' && m === 'POST') res = await mailboxWrite(request, env);
      else if (url.pathname === '/quota' && m === 'GET') res = await quota(env);
      else if (url.pathname.startsWith('/merge-claim/acquire/') && m === 'POST') {
        const ticketN = url.pathname.slice('/merge-claim/acquire/'.length);
        res = await mergeClaimAcquire(ticketN, request, env);
      }
      else if (url.pathname.startsWith('/merge-claim/release/') && m === 'POST') {
        const claimId = url.pathname.slice('/merge-claim/release/'.length);
        res = await mergeClaimRelease(claimId, request, env);
      }
      else if (url.pathname.startsWith('/merge-claim/status/') && m === 'GET') {
        const ticketN = url.pathname.slice('/merge-claim/status/'.length);
        res = await mergeClaimStatus(ticketN, env);
      }
      else if (url.pathname === '/cache-stats' && m === 'POST') res = await cacheStats(request, env);
      else if (url.pathname === '/substrate-health' && m === 'POST') res = await substrateHealth(request, env);
      else res = notFound();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'internal_error';
      res = new Response(JSON.stringify({ error: 'internal_error', detail: msg.slice(0, 200) }), {
        status: 500, headers: { 'content-type': 'application/json' },
      });
    }
    const out = withSecurity(res);
    out.headers.set('x-hamr-elapsed-ms', String(Date.now() - t0));
    return out;
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await scheduledHandler(env);
  },
} satisfies ExportedHandler<Env>;
