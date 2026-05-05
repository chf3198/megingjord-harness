// HAMR /mcp — MCP gateway with DPoP-style proof verification + SLSA gate (#927).
// REPLACES Wave 2 #910 503 placeholder with bundle-SHA SLSA verification per v3.2 §R3.
import type { Env } from '../worker';

const SLSA_ATTEST_KEY_PREFIX = 'slsa-attest:';

function unauthorized(reason: string): Response {
  return new Response(JSON.stringify({ error: 'unauthorized', reason }), {
    status: 401, headers: { 'content-type': 'application/json' },
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

async function checkSlsaAttestation(env: Env, bundleSha: string): Promise<{ ok: boolean; reason?: string }> {
  if (!bundleSha) return { ok: false, reason: 'no_bundle_sha_supplied' };
  // KV holds an attestation marker keyed by bundle SHA. Wave 4 child 6 (SLSA pipeline)
  // populates this on every release; missing key = not yet attested.
  const attestation = await env.HAMR_KV.get(`${SLSA_ATTEST_KEY_PREFIX}${bundleSha}`);
  if (!attestation) return { ok: false, reason: 'no_slsa_attestation_for_bundle' };
  // Parse marker; future-extend with cosign-bundle verify on the Worker side.
  try {
    const parsed = JSON.parse(attestation);
    if (parsed.verified === true) return { ok: true };
    return { ok: false, reason: parsed.reason ?? 'attestation_marker_not_verified' };
  } catch { return { ok: false, reason: 'attestation_marker_parse_failed' }; }
}

export async function mcp(request: Request, env: Env): Promise<Response> {
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

  // SLSA gate: if request advertises a bundle SHA via x-hamr-bundle-sha header,
  // verify the SLSA attestation marker exists in KV before serving.
  const bundleSha = request.headers.get('x-hamr-bundle-sha') ?? '';
  if (bundleSha) {
    const slsa = await checkSlsaAttestation(env, bundleSha);
    if (!slsa.ok) {
      return new Response(JSON.stringify({ error: 'slsa_gate_failed', reason: slsa.reason, bundle_sha: bundleSha }), {
        status: 503, headers: { 'content-type': 'application/json' },
      });
    }
  }

  // MCP serving placeholder for Wave 5 — for now, return 200 with a sanitized acceptance receipt.
  return new Response(JSON.stringify({
    accepted: true,
    key_id: keyId,
    slsa_gate: bundleSha ? 'verified' : 'skipped_no_bundle_advertised',
    mcp_serving: 'wave5_placeholder',
  }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });
}
