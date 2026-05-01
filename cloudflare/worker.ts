// Layer 3: Cloudflare Worker entry for multi-agent coordination (#740)
// Routes requests to a per-fleet Durable Object instance.
// Deploy: cd cloudflare && wrangler deploy
import { CoordinatorDurableObject } from './durable-object';

export { CoordinatorDurableObject };

interface Env {
  COORDINATOR: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, layer: 3 }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    const fleetId = url.searchParams.get('fleet') || 'default';
    const stub = env.COORDINATOR.get(env.COORDINATOR.idFromName(fleetId));
    return stub.fetch(request);
  },
};
