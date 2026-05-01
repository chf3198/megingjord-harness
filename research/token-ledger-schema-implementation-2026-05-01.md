# Token Ledger Schema Implementation (2026-05-01)

**Date:** 2026-05-01
**Ticket:** #770
**Status:** Implemented

## Summary

| Item | Decision |
|---|---|
| Canonical shape | Added in `scripts/global/token-ledger-schema.js` |
| Confidence enum | `exact_request`, `exact_aggregate`, `derived`, `estimated`, `unknown` |
| Write-time enforcement | Invalid/missing confidence is normalized by lane |
| Compatibility | Existing telemetry fields (`ts`, `lane`, `model`, etc.) preserved |

## Canonical Fields

Required normalized fields now emitted per routing telemetry write:

- `provider`
- `model`
- `timestamp`
- `input_tokens`
- `output_tokens`
- `cache_read_tokens`
- `cache_write_tokens`
- `reasoning_tokens`
- `total_tokens`
- `cost_usd`
- `confidence_level`
- `request_id`
- `source_kind`

## Confidence Policy Applied at Write-Time

- `haiku` / `premium` lanes default to `derived` when confidence is absent.
- Other lanes default to `estimated` when confidence is absent.
- Explicit confidence values are accepted only when they are in the canonical enum.

## Backward Compatibility

`scripts/global/model-routing-telemetry.js` still writes historical fields used by
current readers (`readTelemetry()`, `summarize()`). Canonical fields are appended
without removing legacy fields.

## Actionable Next Steps

1. Wire provider adapters (#771) to pass exact confidence where available.
2. Add dashboard/reporting surfaces (#773) to show confidence split.
3. Add reconciliation + drift alerting (#774) using canonical totals.

**Last updated:** 2026-05-01T23:55:00Z
