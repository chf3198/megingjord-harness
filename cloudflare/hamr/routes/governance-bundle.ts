// HAMR /governance-bundle — Worker KV writer for governance-bundle:<issue> (#2613).
// Mirrors the /substrate-health producer pattern (#943): DPoP + Ed25519-signed
// POST from the orchestrator; writes the bundle the read-only tool:governance-bundle
// dispatch (#2094) serves to fleet consultants. Operationalizes Epic #2094.
import type { Env } from '../worker';

function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ error: 'unauthorized', reason }), {
    status: 401, headers: { 'content-type': 'application/json' },
  });
}

function badRequest(reason: string): Response {
  return new Response(JSON.stringify({ error: 'bad_request', reason }), {
    status: 400, headers: { 'content-type': 'application/json' },
  });
}

function decodeKeyring(env: Env): Record<string, string> | null {
  if (!env.PUBLISHER_KEYRING) return null;
  try { return JSON.parse(env.PUBLISHER_KEYRING) as Record<string, string>; } catch { return null; }
}

async function verifyEd25519(spkiB64: string, canonical: string, sigB64: string): Promise<boolean> {
  try {
    const spki = Uint8Array.from(atob(spkiB64), (c) => c.charCodeAt(0));
    const data = new TextEncoder().encode(canonical);
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', spki, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, sig, data);
  } catch { return false; }
}

export async function governanceBundleWrite(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('DPoP ')) return unauthorized('missing_dpop');
  const sigHeader = request.headers.get('x-hamr-signature') ?? '';
  const keyId = request.headers.get('x-hamr-key-id') ?? '';
  const canonical = request.headers.get('x-hamr-canonical') ?? '';
  if (!sigHeader || !keyId || !canonical) return unauthorized('missing_signature_headers');

  const keyring = decodeKeyring(env);
  if (!keyring) return unauthorized('no_publisher_keyring_configured');
  const spkiB64 = keyring[keyId];
  if (!spkiB64) return unauthorized('unknown_key_id');
  if (!await verifyEd25519(spkiB64, canonical, sigHeader)) return unauthorized('bad_signature');

  let bundle: { issue?: number; content_hash?: string; schema?: string };
  try { bundle = await request.json(); } catch { return badRequest('invalid_json'); }
  if (!Number.isInteger(bundle.issue)) return badRequest('issue_required');
  if (!bundle.content_hash || !/^[0-9a-f]{64}$/.test(bundle.content_hash)) return badRequest('content_hash_required');
  if (bundle.schema !== 'governance-bundle/v1') return badRequest('unsupported_schema');

  const key = `governance-bundle:${bundle.issue}`;
  await env.HAMR_KV.put(key, canonical);
  return new Response(JSON.stringify({ ok: true, written: key, content_hash: bundle.content_hash }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}
