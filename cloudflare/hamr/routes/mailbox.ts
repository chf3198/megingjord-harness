// HAMR /mailbox/{read,write} — production R2 JSONL + signed A2A envelopes (#918).
// REPLACES Wave 2 #910 501 placeholders. Per v3.2 §R2 + v3.2.1 §R9 (DC-1).
import type { Env } from '../worker';

const NONCE_TTL_FLOOR_S = 60;
const NONCE_TTL_CEILING_S = 24 * 60 * 60;
const ENVELOPE_FIELDS = ['headers', 'body'];
// signature lives in HTTP header `x-hamr-signature` per Wave 3 design (signed
// canonical-form-without-signature). Envelope-internal signature field deferred to
// future tighter-A2A-conformance work.
const HEADER_FIELDS = ['nonce', 'expires_at', 'publisher_key_id'];

function jerr(status: number, code: string, detail?: string): Response {
  return new Response(JSON.stringify({ error: code, ...(detail ? { detail } : {}) }), {
    status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function verifySig(spkiB64: string, canonical: string, sigB64: string): Promise<boolean> {
  try {
    const spki = Uint8Array.from(atob(spkiB64), (c) => c.charCodeAt(0));
    // Sign-payload is the canonical string itself (UTF-8 bytes), not a base64-decoded version.
    const data = new TextEncoder().encode(canonical);
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, sig, data);
  } catch { return false; }
}

function ringFor(env: Env): Record<string, string> | null {
  if (!env.PUBLISHER_KEYRING) return null;
  try { return JSON.parse(env.PUBLISHER_KEYRING) as Record<string, string>; } catch { return null; }
}

export async function mailboxWrite(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('DPoP ')) return jerr(401, 'missing_dpop');
  const env_keyId = request.headers.get('x-hamr-key-id') ?? '';
  const env_sig = request.headers.get('x-hamr-signature') ?? '';
  const env_canon = request.headers.get('x-hamr-canonical') ?? '';
  if (!env_keyId || !env_sig || !env_canon) return jerr(401, 'missing_signature_headers');
  const ring = ringFor(env);
  if (!ring) return jerr(401, 'no_publisher_keyring_configured');
  const spki = ring[env_keyId];
  if (!spki) return jerr(401, 'unknown_key_id');
  if (!await verifySig(spki, env_canon, env_sig)) return jerr(401, 'bad_signature');

  let envelope: any;
  try { envelope = await request.json(); } catch { return jerr(400, 'bad_json'); }
  for (const f of ENVELOPE_FIELDS) if (!envelope?.[f]) return jerr(400, `missing_field_${f}`);
  for (const f of HEADER_FIELDS) if (!envelope.headers?.[f]) return jerr(400, `missing_header_${f}`);
  const expiresAt = Date.parse(envelope.headers.expires_at);
  const now = Date.now();
  if (!Number.isFinite(expiresAt) || expiresAt < now) return jerr(400, 'expired_envelope');
  if (envelope.headers.publisher_key_id !== env_keyId) return jerr(400, 'key_id_mismatch');

  const nonceKey = `nonce:${envelope.headers.nonce}`;
  if (await env.HAMR_KV.get(nonceKey)) return jerr(409, 'replay_detected');
  const ttlS = Math.min(NONCE_TTL_CEILING_S, Math.max(NONCE_TTL_FLOOR_S, Math.floor((expiresAt - now) / 1000)));
  await env.HAMR_KV.put(nonceKey, '1', { expirationTtl: ttlS });

  const recipient = envelope.headers.recipient_key_id ?? envelope.headers.recipient ?? 'broadcast';
  const day = new Date(now).toISOString().slice(0, 10);
  const key = `mailboxes/${recipient}/${day}.jsonl`;
  const messageId = `msg-${envelope.headers.nonce}`;
  const line = JSON.stringify({ ...envelope, _written_at: now, _message_id: messageId }) + '\n';
  const existing = await env.HAMR_BUNDLES.get(key);
  const body = existing ? new Blob([await existing.arrayBuffer(), line]) : new Blob([line]);
  await env.HAMR_BUNDLES.put(key, body);
  return new Response(JSON.stringify({ accepted: true, message_id: messageId, recipient, key }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}

export async function mailboxRead(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const recipient = url.searchParams.get('recipient');
  const since = url.searchParams.get('since');
  if (!recipient) return jerr(400, 'missing_recipient');
  const sinceMs = since ? Date.parse(since) : 0;
  const list = await env.HAMR_BUNDLES.list({ prefix: `mailboxes/${recipient}/` });
  const messages: unknown[] = [];
  for (const obj of list.objects) {
    const o = await env.HAMR_BUNDLES.get(obj.key);
    if (!o) continue;
    const text = await o.text();
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const m = JSON.parse(line);
        if (m._written_at >= sinceMs) messages.push(m);
      } catch { /* skip malformed line */ }
    }
  }
  messages.sort((a: any, b: any) => a._written_at - b._written_at);
  return new Response(JSON.stringify({ messages, next_since: new Date().toISOString() }), {
    status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
