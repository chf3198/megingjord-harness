// Layer 3 Durable Object — coordination state per fleet (#740)
// API surface mirrors Layer 4 scripts/global/agent-coord-local.js so the
// client wrapper can swap implementations without breaking callers.

const MS_PER_SEC = 1000;

interface LeaseRecord {
  key: string;
  agent_id: string;
  expires_at: number;
}

export class CoordinatorDurableObject {
  state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? await request.json() : {};
    if (url.pathname === '/lease/acquire') return this.acquire(body);
    if (url.pathname === '/lease/release') return this.release(body);
    if (url.pathname === '/heartbeat') return this.heartbeat(body);
    if (url.pathname === '/agents') return this.listAgents(url);
    return new Response('not found', { status: 404 });
  }

  async acquire(body: any): Promise<Response> {
    const { key, ttlSec, agentId } = body;
    const existing = await this.state.storage.get<LeaseRecord>(`lease:${key}`);
    const now = Date.now();
    if (existing && existing.expires_at > now) {
      return Response.json({ ok: false, reason: 'held' });
    }
    const record: LeaseRecord = { key, agent_id: agentId, expires_at: now + ttlSec * MS_PER_SEC };
    await this.state.storage.put(`lease:${key}`, record);
    return Response.json({ ok: true, handle: { key, agentId, expiresAt: record.expires_at } });
  }

  async release(body: any): Promise<Response> {
    const { key, agentId } = body;
    const existing = await this.state.storage.get<LeaseRecord>(`lease:${key}`);
    if (!existing || existing.agent_id !== agentId) {
      return Response.json({ ok: false, reason: 'not-held-by-agent' });
    }
    await this.state.storage.delete(`lease:${key}`);
    return Response.json({ ok: true });
  }

  async heartbeat(body: any): Promise<Response> {
    const { agentId } = body;
    await this.state.storage.put(`hb:${agentId}`, Date.now());
    return Response.json({ ok: true });
  }

  async listAgents(url: URL): Promise<Response> {
    const maxAgeSec = parseInt(url.searchParams.get('maxAgeSec') || '300', 10);
    const cutoff = Date.now() - maxAgeSec * MS_PER_SEC;
    const all = await this.state.storage.list<number>({ prefix: 'hb:' });
    const active = [];
    for (const [storageKey, lastSeen] of all.entries()) {
      if (lastSeen >= cutoff) {
        active.push({ agent_id: storageKey.slice(3), last_seen: lastSeen });
      }
    }
    return Response.json({ ok: true, active });
  }
}
