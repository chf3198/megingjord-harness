// Phase 3 / #785 — Cloudflare Worker state-tools endpoints
// Extends #740 worker with cache-only state surface. GitHub remains canonical.
// All endpoints return: { value, source: 'cache'|'miss', stale: bool }

const STALE_TTL_MS = 60 * 1000;

interface CacheEntry<T = unknown> {
  value: T;
  written_at: number;
}

export async function handleStateRequest(
  request: Request,
  storage: DurableObjectStorage,
): Promise<Response | null> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const [resource, key] = parts;
  if (!['baton', 'assignee', 'branch', 'activity'].includes(resource)) return null;
  if (request.method === 'GET') return getCached(storage, resource, key);
  if (request.method === 'PUT') return setCached(storage, resource, key, await request.json());
  return new Response('method not allowed', { status: 405 });
}

async function getCached(
  storage: DurableObjectStorage,
  resource: string,
  key: string,
): Promise<Response> {
  const storageKey = `state:${resource}:${key}`;
  const entry = await storage.get<CacheEntry>(storageKey);
  if (!entry) {
    return Response.json({ value: null, source: 'miss', stale: false });
  }
  const stale = (Date.now() - entry.written_at) > STALE_TTL_MS;
  return Response.json({ value: entry.value, source: 'cache', stale });
}

async function setCached(
  storage: DurableObjectStorage,
  resource: string,
  key: string,
  body: unknown,
): Promise<Response> {
  const storageKey = `state:${resource}:${key}`;
  const entry: CacheEntry = { value: body, written_at: Date.now() };
  await storage.put(storageKey, entry);
  return Response.json({ ok: true });
}
