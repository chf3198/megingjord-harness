---
title: HAMR Wave 1 — S3 Live CF Worker + KV Latency Measurement
date: 2026-05-05
ticket: 891
parent_spike: 878
epic: 860
status: research-deliverable
---

# HAMR Wave 1 — S3 Live CF Worker + KV Latency Measurement

## 1. Summary

Live measurement of the v3.2 §R4 latency contract using a deployed
Cloudflare Worker bound to KV. Closes the warm-path RTT validity
gap from S3 analytical spike (#878).

| Path | p50 | p95 | v3.2 §R4 budget | Verdict |
|---|---|---|---|---|
| **Cold** (new TLS per call, n=30) | **114.6 ms** | **153.3 ms** | ≤180 ms p95 | ✅ within budget |
| **Warm** (HTTP keep-alive, n=29) | **37.4 ms** | **45.4 ms** | ≤80 ms p50 / ≤120 ms p95 | ✅ **beats budget by ~2×** |

**Decision: CONFIRM v3.2 §R4 (warm-only ≤80 ms claim with HTTP/2
keepalive + KV edge-cache).** Both cold and warm paths land
within or below the documented budget. The warm-path margin is
generous enough that the operator's `npx megingjord init` sample
output can use `40 ms p50 / 50 ms p95` as the published warm
figure (vs. v3.2's 54/80 ms estimate from S3 #878).

## 2. Methodology

### Substrate substitution: KV instead of R2

The original S3 follow-up planned to use R2 as the bound storage,
matching v3.2's stated substrate. R2 requires explicit ToS
acceptance via the Cloudflare dashboard (account-level, not
automatable through the API). The operator's Workers-Paid plan
includes both KV and (after dashboard ToS) R2, but the live spike
must run zero-touch.

KV was substituted because:

- Same account, same Workers-Paid plan, same edge-binding pattern.
- Same operator → Worker → bound-storage round-trip — the latency
  variable HAMR cares about.
- KV → Worker is typically 5–15 ms faster than R2 → Worker
  (smaller object, hotter edge cache); the warm-path margin is
  large enough that even adding +15 ms keeps R2 within v3.2 §R4.

### Deployment

```
Worker:    https://hamr-spike.chf3198.workers.dev (deleted post-measurement)
KV ns id:  8339d212c3c042bdbdf29fd8113c1edf      (deleted post-measurement)
Routes:    GET /healthz   → JSON timestamp
           GET /bundle    → KV-stored JSON object (103 bytes)
Cache hdr: cache-control: public, max-age=300, stale-while-revalidate=60
```

### Measurement

- **Cold path:** `bash measure.sh` runs `curl -s -o /dev/null -w
  '<curl-format>'` 30 times against `/bundle`. Each call opens a
  fresh TLS connection (no keep-alive). Captures `time_namelookup`
  (DNS), `time_connect` (TCP), `time_appconnect` (TLS handshake),
  `time_starttransfer` (TTFB), `time_total`.
- **Warm path:** `node measure-warm.js` makes 30 sequential
  HTTPS requests through a single `https.Agent({ keepAlive: true,
  maxSockets: 1 })`. Call 1 primes the TLS connection (200 ms
  cold-equivalent) and is dropped from stats; calls 2–30 reuse
  the connection (n=29).
- All 60 samples taken from operator host (Linux 6.6, Tailscale
  on, single CF PoP from operator's home connection).

### Tear-down evidence

- `wrangler delete --name hamr-spike --force` → "Successfully
  deleted hamr-spike".
- `wrangler kv namespace delete --namespace-id 8339d212c3c042bdbdf29fd8113c1edf` →
  "Deleted KV namespace id: 8339d212c3c042bdbdf29fd8113c1edf".
- Post-deletion verification: `curl
  https://hamr-spike.chf3198.workers.dev/healthz` returns
  `HTTP 404` (Worker gone).

Net subscription cost: **$0** (Workers Paid plan was already
active; KV usage was a few hundred operations during the spike,
covered by the included quota).

## 3. Measured data (sanitized)

### Cold path segment breakdown (n=30, p50 / p95)

| Segment | p50 (ms) | p95 (ms) | Notes |
|---|---|---|---|
| DNS lookup | 1.4 | 3.0 | local resolver hit |
| TCP connect | 26.0 | 33.5 | operator → CF edge |
| TLS handshake | 70.1 | 78.3 | CF edge cert handshake |
| TTFB | 113.4 | 153.2 | TLS done → first byte (Worker + KV read) |
| Total | 114.6 | 153.3 | full round-trip |

Connect-then-TLS overhead: ~70 ms p50. After the TLS finishes,
TTFB adds only ~43 ms p50 (~50 ms p95) — that's the actual
Worker compute + KV-read + first-byte time.

### Warm path (n=29, HTTP keep-alive, p50 / p95)

| Metric | p50 (ms) | p95 (ms) |
|---|---|---|
| TTFB | 37.4 | 45.4 |
| Total | 37.5 | 45.5 |

Prime call (call 1, dropped): TTFB 199 ms, total 200 ms — close
to the cold-path total p50 of 115 ms × ~2 (TCP+TLS+TTFB once
each), confirming the keep-alive amortization is real.

Warm TTFB ≈ Cold (TTFB − connect − TLS) + small jitter:
113.4 − 26.0 − 70.1 = 17.3 ms minimum cost. Measured warm p50 is
37.4 ms, so ~20 ms of warm overhead is Worker compute plus KV
read plus reverse RTT. That number is the **actual operator-
perceptible substrate cost** when keep-alive is honored.

## 4. Decisions

### D1 · CONFIRM v3.2 §R4 latency budget

- Warm p50 37 ms ≪ 80 ms budget — **±2×** margin.
- Warm p95 45 ms ≪ 120 ms budget — **±2.7×** margin.
- Cold p95 153 ms ≪ 180 ms budget — within margin.

The HAMR per-call substrate budget holds with measured numbers.
**No revision to v3.2 §R4 thresholds.**

### D2 · Revise `npx megingjord init` sample output

v3.2 §R4 directed updating the `npx megingjord init` 60 ms
sample (from v3) to S3 #878's derived 54 ms. With the now-
measured warm p50 of 37 ms, the published sample should be
**40 ms p50 / 50 ms p95** (rounded slightly conservative).

### D3 · HTTP/2 keepalive + KV edge-cache mandates ratified

The cold→warm ratio (114 → 37 ms p50, **3.1×**) is large enough
that HAMR's contract-grade behaviour requires the warm path. v3.2
§R4 already mandates HTTP/2 keepalive on operator → Worker and
KV edge-cache via Cache-Control headers; this measurement
ratifies both.

### D4 · R2 deferred to operator-authorized dashboard step

R2 enablement requires manual ToS acceptance in the CF dashboard
(per error code 10042 returned by `wrangler r2 bucket create`).
This is a **one-time operator action**, not a recurring cost.
Once R2 is enabled, the same measurement script will work
unchanged; expected R2 latency is +5–15 ms vs KV (still within
v3.2 §R4 budget on warm path).

Recommendation: add R2 ToS acceptance to the `hamr:doctor`
remediation list (#896) as a manual step with a dashboard URL.

## 5. Threats to validity

1. **Single operator geography.** All measurements from one
   operator's home connection in their assigned CF PoP. Enterprise
   deployments with traffic from multiple POPs may see different
   distributions.
2. **KV vs R2 substitution.** R2 fetches typically add 5–15 ms
   over KV at the same edge. The warm-path margin (45 ms p95 vs
   120 ms budget) absorbs this comfortably; cold path (153 vs
   180) has tighter slack — measure against R2 on next-iteration
   if conservative validation is needed.
3. **103-byte bundle.** Real HAMR bundles are 30 KB+; transfer
   time scales linearly. At 1 Gbps last-mile that's ~0.24 ms
   additional, immaterial. At 10 Mbps mobile that's ~24 ms
   additional — noticeable but still within budget for warm.
4. **Quota-tier KV.** Workers-Paid KV may have higher edge-cache
   priority than free-tier KV. Documented as an artifact of the
   paid environment; HAMR design assumes paid Workers tier.
5. **No fleet-host measurements yet.** This spike measured
   operator → CF only. Fleet-host → Tailscale was already covered
   by S3 #878 (5/11/64 ms p50 for windows-laptop / 36gbwinresource
   / penguin-1). The combined operator → CF → Tailscale path is
   not measured because Worker → Tailscale is not a HAMR design
   path; HAMR uses operator → CF for substrate state and operator
   → Tailscale (direct) for fleet inference.

## 6. Wiki ingest plan

- `raw/articles/hamr-wave1-s3-live-deploy-2026-05-05.md` — copy.
- `wiki/sources/hamr-wave1-s3-live-deploy-2026-05-05.md` — digest.
- entity candidates: extends `[[cloudflare-workers]]`,
  `[[cloudflare-kv]]`.
- concept candidates: extends `[[hamr-failover-map]]`.

## 7. References

- Parent spike (analytical): `research/hamr-spike-s3-latency-analysis-2026-05-04.md` (#878).
- HAMR v3.2 §3.R4 (latency contract): `research/hamr-v3-2-2026-05-04.md` (#890).
- Cloudflare Workers docs: <https://developers.cloudflare.com/workers/>.
- Cloudflare KV docs: <https://developers.cloudflare.com/kv/>.
- Cloudflare R2 ToS (operator one-time action): dashboard → R2.
- Spike artifacts (gitignored): `tmp/wave1/cf-spike/`.

Refs Epic #860, Wave 1 #891, parent spike #878, HAMR v3.2 #890.
