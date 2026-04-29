#!/usr/bin/env bash
set -euo pipefail

echo "🔎 pre-push: format and readability checks"
npm run format:check
npm run lint:readability:ci

echo "✅ pre-push checks passed"
