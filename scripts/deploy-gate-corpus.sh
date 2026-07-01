#!/usr/bin/env bash
# deploy-gate-corpus.sh — Refs #3446 (Epic #3411 T2.3)
# Sourced by deploy.sh; not executed directly.
# Ships scripts/global/ (gate corpus) to gateCorpusHome for cursor + antigravity.
#
# Design: ship-corpus chosen over MCP-delivery — deterministic, G5/G6 safe, no live dep.
# SSoT for gateCorpusHome: inventory/runtimes/{cursor,antigravity}.json deploy.gateCorpusHome
#   cursor      → ~/.cursor/scripts/global
#   antigravity → ~/.antigravity/scripts/global

deploy_gate_corpus() {
  local runtime="$1" dest_home="$2" src="$3" apply="$4"
  if [[ "$apply" == "true" ]]; then
    mkdir -p "$dest_home"
    rsync -a --exclude='*.local*' "$src/" "$dest_home/" 2>/dev/null || true
    echo "ok scripts/global/ -> $dest_home/ (gate corpus [$runtime], #3446)"
  else
    echo "(dry run) Would deploy scripts/global/ -> $dest_home/ (gate corpus [$runtime], #3446)"
  fi
}

deploy_antigravity() {
  local root="$1" apply="$2"
  "$apply" && { mkdir -p "$HOME/.antigravity"; rsync -a --exclude='*.local*' "$root/.antigravity/" "$HOME/.antigravity/" 2>/dev/null || true; echo "ok .antigravity/ -> ~/.antigravity/"; } || echo "(dry run) Would deploy .antigravity/ -> ~/.antigravity/"
  deploy_gate_corpus antigravity "$HOME/.antigravity/scripts/global" "$root/scripts/global" "$apply"
}

deploy_cursor() {
  local root="$1" apply="$2"
  "$apply" && { mkdir -p "$HOME/.cursor"; rsync -a --exclude='*.local*' "$root/.cursor/" "$HOME/.cursor/" 2>/dev/null || true; rsync -a --exclude='__pycache__' --exclude='state/' "$root/hooks/" "$HOME/.cursor/hooks/" 2>/dev/null || true; mkdir -p "$HOME/.cursor/agents"; rsync -a "$root/agents/" "$HOME/.cursor/agents/" 2>/dev/null || true; echo "ok .cursor/ -> ~/.cursor/ (+ hooks + agents, #1912 parity)"; } || echo "(dry run) Would deploy .cursor/ -> ~/.cursor/ and hooks/ -> ~/.cursor/hooks/ and agents/ -> ~/.cursor/agents/"
  deploy_gate_corpus cursor "$HOME/.cursor/scripts/global" "$root/scripts/global" "$apply"
}
