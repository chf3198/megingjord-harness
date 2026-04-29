#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OUT="$ROOT/logs/readability-drift.jsonl"

mkdir -p "$ROOT/logs"
SUMMARY="$(node "$ROOT/scripts/lint-readability.js" | head -n 2 | tail -n 1)"
COUNT="$(echo "$SUMMARY" | sed -E 's/[^0-9]*([0-9]+).*/\1/')"

printf '{"timestamp":"%s","warningCount":%s}\n' "$STAMP" "$COUNT" >> "$OUT"
echo "✅ Readability snapshot saved: $OUT (warnings=$COUNT)"
